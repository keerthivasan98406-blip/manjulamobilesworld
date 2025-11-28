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
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
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

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customer: {
    name: String,
    phone: String,
    email: String,
    address: String
  },
  items: [{
    id: Number,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  total: Number,
  paymentMethod: String,
  status: { type: String, default: 'Pending' },
  orderDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// Socket.IO connection
let connectedClients = 0;
io.on('connection', (socket) => {
  connectedClients++;
  console.log('👤 Client connected:', socket.id);
  console.log('📊 Total connected clients:', connectedClients);
  
  socket.on('disconnect', (reason) => {
    connectedClients--;
    console.log('👋 Client disconnected:', socket.id, '- Reason:', reason);
    console.log('📊 Total connected clients:', connectedClients);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Product Routes

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 });
    // Transform MongoDB _id to id for client compatibility
    const transformedProducts = products.map(p => ({
      ...p.toObject(),
      id: p._id.toString()
    }));
    res.json(transformedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new product
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    const transformedProduct = {
      ...product.toObject(),
      id: product._id.toString()
    };
    io.emit('product-added', transformedProduct);
    res.json(transformedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a product
app.patch('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },   // patch updates only given fields
      { new: true }
    );

    console.log("product id: ", product._id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const transformedProduct = {
      ...product.toObject(),
      id: product._id.toString()
    };

    io.emit('product-updated', transformedProduct);

    res.json(transformedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    io.emit('product-deleted', { id: req.params.id });

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

// Order Routes
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    io.emit('order-added', order);
    console.log('✅ New order saved to database:', order.orderId);
    res.json(order);
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      req.body,
      { new: true }
    );
    io.emit('order-updated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    await Order.findOneAndDelete({ orderId: req.params.orderId });
    io.emit('order-deleted', { orderId: req.params.orderId });
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
