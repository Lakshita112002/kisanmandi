const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Get user's orders
router.get('/', auth, async (req, res) => {
  try {
    const userType = req.user.userType;

    const orders = await Order.find({})
      .populate('product')
      .populate('buyer', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// Add order details (handlePlaceOrder)
router.post('/', auth, async (req, res) => {
  try {
    const { product, quantity, totalAmount, paymentMethod, deliveryAddress} = req.body;

    // Create a new order
    const newOrder = new Order({
      product,
      buyer: req.user.id,
      quantity,
      amount:totalAmount,
      paymentMethod,
      deliveryAddress:deliveryAddress,
      status: 'pending',
    });
    const products = await Product.findById(product);
    products.quantity -= quantity;
    await products.save();
    // Save the order
    const order = await newOrder.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Error placing order' });
  }
});

// Update order status (for farmers)
router.patch('/:orderId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only farmers can update order status
    if (req.user.userType !== 'farmer') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Error updating order' });
  }
});

module.exports = router;
