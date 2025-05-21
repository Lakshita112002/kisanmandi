const express = require('express');
const router = express.Router();
const stripe = require('stripe')('your_stripe_secret_key');
// const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
// Create payment intent
router.post('/create-payment', async (req, res) => {
  try {
    const { amount, productId, quantity } = req.body;

    // Check product availability
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to paisa
      currency: 'inr',
      metadata: {
        productId,
        quantity,
        buyerId: req.user.id
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Payment processing failed' });
  }
});

// Webhook to handle successful payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      'your_webhook_secret'
    );
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { productId, quantity, buyerId } = paymentIntent.metadata;

    try {
      // Update product quantity
      await Product.findByIdAndUpdate(productId, {
        $inc: { quantity: -quantity }
      });

      // Create order
      await Order.create({
        product: productId,
        buyer: buyerId,
        quantity: quantity,
        amount: paymentIntent.amount / 100, // Convert from paisa to rupees
        paymentId: paymentIntent.id,
        status: 'paid'
      });
    } catch (error) {
      console.error('Order creation error:', error);
    }
  }

  res.json({ received: true });
});

module.exports = router;
