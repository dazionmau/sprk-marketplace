const { Review } = require('../models/review');
const { Product } = require('../models/product');
const { User } = require('../models/user');

exports.leaveReview = async function (req, res) {
  try {
    const user = await User.findById(req.body.user);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const review = await new Review({
      ...req.body,
      userName: user.name,
    }).save();
    if (!review) {
      return res.status(500).json({ message: 'The Review could not be added' });
    }

    /// Because we have the pre('save') hook, let's use save
    // const product = await Product.findByIdAndUpdate(
    //   req.params.id,
    //   { $push: { reviews: review.id } },
    //   { new: true }
    // );
    let product = await Product.findById(req.params.id);
    product.reviews.push(review.id);
    product = product.save();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.status(201).json({ product, review });
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};

exports.getProductReviews = async function (req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const page = req.query.page || 1; // Default to page 1 if not specified
    const pageSize = 10; // Number of reviews per page, adjust as needed

    const reviews = await Review.find({
      _id: { $in: product.reviews },
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const processedReviews = [];
    if (!reviews) return res.status(200).json([]);
    for (const review of reviews) {
      const user = await User.findById(review.user);
      if (!user) processedReviews.push(review);
      review.userName = user.name;
      const newReview = await review.save();
      processedReviews.push(newReview);
    }
    return res.json(processedReviews);
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};
