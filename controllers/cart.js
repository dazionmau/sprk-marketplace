const { default: mongoose } = require('mongoose');
const { CartProduct } = require('../models/cart_product');
const { User } = require('../models/user');
const { Product } = require('../models/product');

exports.getUserCart = async function (req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const cartProducts = await CartProduct.find({
      _id: { $in: user.cart },
    });
    if (!cartProducts) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    const cart = [];
    for (const cartProduct of cartProducts) {
      const product = await Product.findById(cartProduct.product);
      const currentCartProductData = {
        product: cartProduct.product,
        quantity: cartProduct.quantity,
        selectedSize: cartProduct.selectedSize,
        selectedColour: cartProduct.selectedColour,
        productName: cartProduct.productName,
        productImage: cartProduct.productImage,
        productPrice: cartProduct.productPrice,
      };
      if (!product) {
        // since I don't want the reserved and reservation expiry my only option here would be to manually input each field I want
        cart.push({
          ...currentCartProductData,
          productExists: false,
          productOutOfStock: false,
        });
      } else {
        currentCartProductData['productName'] = product.name;
        currentCartProductData['productImage'] = product.image;
        currentCartProductData['productPrice'] = product.price;
        if (
          !cartProduct.reserved &&
          product.countInStock < cartProduct.quantity
        ) {
          cart.push({
            ...currentCartProductData,
            productExists: true,
            productOutOfStock: true,
          });
        } else {
          cart.push({
            ...currentCartProductData,
            productExists: true,
            productOutOfStock: false,
          });
        }
      }
    }
    return res.json(cart);
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};

exports.getUserCartCount = async function (req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ cartCount: user.cart.length });
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};

exports.addToCart = async function (req, res) {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if the user's cart already contains a CartProduct with the same productId,
    // selectedSize, and selectedColour

    // first we get the user's cart, now you can do this once with User.findById(req.params.id).populate('cart')
    // but for tutorial purposes, so you can see how to do the advanced querying with the $in operator, we will
    // do it this way
    const userCartProducts = await CartProduct.find({
      _id: { $in: user.cart },
    });
    const existingCartItem = userCartProducts.find(
      (item) =>
        item.product.equals(new mongoose.Types.ObjectId(productId)) &&
        item.selectedSize === req.body.selectedSize &&
        item.selectedColour === req.body.selectedColour
    );

    if (existingCartItem) {
      // If the same product with the same size and colour exists, increment the quantity
      existingCartItem.quantity += 1;
      await existingCartItem.save();
      return res.status(200).end();
    }

    // If not, create a new CartProduct
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const cartProduct = await new CartProduct({
      ...req.body,
      product: productId,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
    }).save();

    if (!cartProduct) {
      return res
        .status(500)
        .json({ message: 'The Product could not be added to your cart' });
    }

    user.cart.push(cartProduct.id);
    await user.save();

    // Deduct from countInStock and save, handling concurrency
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, countInStock: { $gte: cartProduct.quantity } },
      { $inc: { countInStock: -cartProduct.quantity } },
      { new: true } // Return the updated document
    );

    if (!updatedProduct) {
      // Handle insufficient stock or concurrency issues
      // Delete the newly created cart product from the database
      await CartProduct.findByIdAndDelete(cartProduct.id);

      // Rollback changes in user cart
      user.cart.pull(cartProduct.id);
      await user.save();

      return res
        .status(400)
        .json({ message: 'Insufficient stock or concurrency issue' });
    }
    return res.status(201).json(cartProduct);
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};

exports.modifyProductQuantity = async function (req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const cartProduct = await CartProduct.findByIdAndUpdate(
      req.params.cartProductId,
      req.body,
      { new: true }
    );
    if (!cartProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(cartProduct);
  } catch (err) {
    console.log('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};


exports.getCartProductById = async function (req, res) {
  try {
    const cartProduct = await CartProduct.findById(req.params.cartProductId);
    if (!cartProduct) {
      return res.status(404).json({ message: 'Cart Product not found!.' });
    }
    let cartProductData;
    const product = await Product.findById(cartProduct.product);
    // since I don't want the reserved and reservation expiry my only option here would be to manually input each field I want
    const currentCartProductData = {
      product: cartProduct.product,
      quantity: cartProduct.quantity,
      selectedSize: cartProduct.selectedSize,
      selectedColour: cartProduct.selectedColour,
      productName: cartProduct.productName,
      productImage: cartProduct.productImage,
      productPrice: cartProduct.productPrice,
    };
    if (!product) {
      cartProductData = {
        ...currentCartProductData,
        productExists: false,
        productOutOfStock: false,
      };
    } else {
      currentCartProductData['productName'] = product.name;
      currentCartProductData['productImage'] = product.image;
      currentCartProductData['productPrice'] = product.price;
      if (
        !cartProduct.reserved &&
        product.countInStock < cartProduct.quantity
      ) {
        cartProductData = {
          ...currentCartProductData,
          productExists: true,
          productOutOfStock: true,
        };
      } else {
        cartProductData = {
          ...currentCartProductData,
          productExists: true,
          productOutOfStock: false,
        };
      }
    }
    return res.json(cartProductData);
  } catch (err) {
    return res.status(500).json({ type: err.name, message: err.message });
  }
};

exports.removeFromCart = async function (req, res) {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.cart.includes(req.params.cartProductId)) {
      return res.status(400).json({ message: 'Product not in user cart' });
    }
    // Find the cart item to be removed
    const cartItemToRemove = CartProduct.findById(req.params.cartProductId);

    if (!cartItemToRemove) {
      // If the cart item doesn't exist, return a 404 status
      return res.status(404).json({ message: 'Cart item not found' });
    }

    // Increment countInStock and save, handling concurrency
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId },
      { $inc: { countInStock: cartItemToRemove.quantity } },
      { new: true } // Return the updated document
    );

    if (!updatedProduct) {
      console.error('Failed to update product stock due to concurrency issues');
      // Handle concurrency issues
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    // Remove the cart item from the user's cart
    user.cart.pull(cartItemToRemove.id);
    await user.save();

    // Remove the cart item from the database
    await CartProduct.findByIdAndDelete(cartItemToRemove.id);

    return res.status(200).json({ message: 'Cart item removed successfully' });
  } catch (err) {
    console.error('ERROR OCCURRED: ', err);
    return res.status(500).json({ type: err.name, message: err.message });
  }
};
