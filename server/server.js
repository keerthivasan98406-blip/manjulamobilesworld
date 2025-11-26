const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for images
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('../client'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGO_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  category: String,
  price: Number,
  originalPrice: Number,
  image: String,
  imageUrl: String,
  rating: Number,
  reviews: Number,
  inStock: Boolean,
  badge: String,
  qrId: String,
  qrPassword: String,
  trackingStatus: String,
  ownerGender: String
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Tracking Schema
const trackingSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true },
  qrPassword: String,
  customerName: String,
  productName: String,
  deviceModel: String,
  contact: String,
  status: String,
  issue: String,
  estimatedDays: Number,
  createdAt: String,
  lastUpdated: String
}, { timestamps: true });

const Tracking = mongoose.model('Tracking', trackingSchema);

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('👤 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 Client disconnected:', socket.id);
  });
});

// Product Routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ id: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    io.emit('product-added', product);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      req.body,
      { new: true }
    );
    io.emit('product-updated', product);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: parseInt(req.params.id) });
    io.emit('product-deleted', { id: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tracking Routes
app.get('/api/tracking', async (req, res) => {
  try {
    const tracking = await Tracking.find().sort({ createdAt: -1 });
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tracking', async (req, res) => {
  try {
    const tracking = new Tracking(req.body);
    await tracking.save();
    io.emit('tracking-added', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tracking/:qrId', async (req, res) => {
  try {
    const tracking = await Tracking.findOneAndUpdate(
      { qrId: req.params.qrId },
      req.body,
      { new: true }
    );
    io.emit('tracking-updated', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tracking/:qrId', async (req, res) => {
  try {
    await Tracking.findOneAndDelete({ qrId: req.params.qrId });
    io.emit('tracking-deleted', { qrId: req.params.qrId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SMS notification endpoint
app.post('/api/send-order-sms', async (req, res) => {
  try {
    const { orderDetails, ownerPhone } = req.body;
    
    // Prepare SMS message
    const itemsList = orderDetails.items.map(item => 
      `${item.name} x${item.quantity} = Rs${item.price * item.quantity}`
    ).join(', ');
    
    const smsMessage = `New Order #${orderDetails.id}
Customer: ${orderDetails.customer.name}
Phone: ${orderDetails.customer.phone}
Address: ${orderDetails.customer.address}
Items: ${itemsList}
Total: Rs${orderDetails.total}
Payment: ${orderDetails.paymentMethod}`;
    
    // Log order details (SMS will be sent via SMS service)
    console.log('📱 New Order - SMS to be sent:');
    console.log('To:', ownerPhone);
    console.log('Message:', smsMessage);
    console.log('---');
    
    // TODO: Integrate with SMS service (Fast2SMS, Twilio, MSG91, etc.)
    // Example with Fast2SMS (you'll need to sign up and get API key):
    /*
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': 'YOUR_FAST2SMS_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: smsMessage,
        language: 'english',
        flash: 0,
        numbers: ownerPhone
      })
    });
    */
    
    // For now, just log and return success
    res.json({ 
      success: true, 
      message: 'Order received and SMS queued',
      orderId: orderDetails.id 
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
