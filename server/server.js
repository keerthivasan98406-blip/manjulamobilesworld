const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
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

// Serve static files from client directory
const clientPath = path.join(__dirname, '../client');
console.log('📁 Serving static files from:', clientPath);
app.use(express.static(clientPath));

// MongoDB Connection with optimized settings
const MONGODB_URI = process.env.MONGO_URI;

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 20, // Increased for faster concurrent requests
  minPoolSize: 5,  // More ready connections
  serverSelectionTimeoutMS: 10000, // Increased to 10 seconds
  socketTimeoutMS: 30000, // Increased to 30 seconds
  connectTimeoutMS: 10000, // Increased to 10 seconds
  family: 4 // Use IPv4, skip trying IPv6
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('📊 Connection pool size: 10');
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, index: true },
  category: { type: String, index: true },
  price: Number,
  originalPrice: Number,
  image: String,
  imageUrl: String,
  imageUrl2: String,
  rating: Number,
  reviews: Number,
  inStock: { type: Boolean, index: true },
  badge: String,
  qrId: String,
  qrPassword: String,
  trackingStatus: String,
  ownerGender: String
}, { 
  timestamps: true,
  // Optimize for read performance
  autoIndex: true
});

// Add compound index for common queries
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ createdAt: 1 });

const Product = mongoose.model('Product', productSchema);

// Drop the problematic 'id' index if it exists
Product.collection.dropIndex('id_1').then(() => {
  console.log('✅ Dropped id_1 index');
}).catch(err => {
  if (err.code === 27) {
    console.log('ℹ️ Index id_1 does not exist (this is fine)');
  } else {
    console.log('ℹ️ Could not drop index:', err.message);
  }
});

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
  orderDate: { type: Date, default: Date.now },
  paymentScreenshot: {
    imageUrl: String, // URL to the uploaded image (local or cloud)
    data: String, // Base64 data as backup
    fileName: String,
    uploadTime: String
  }
}, { 
  timestamps: true,
  strict: false // Allow additional fields that might not be in schema
});

const Order = mongoose.model('Order', orderSchema);

// Image upload to cloud storage - DISABLED (no file saving)
const uploadImageToCloud = async (base64Data, fileName) => {
  try {
    // File saving disabled - screenshots only stored in database as base64
    console.log('📸 File saving disabled - screenshots stored in database only');
    return null; // No file URL returned
    
    /* File saving functionality disabled
    const base64Image = base64Data.split(',')[1];
    console.log('📸 Using local storage for image upload');
    return await saveImageLocally(base64Data, fileName);
    */
  } catch (error) {
    console.error('❌ Cloud upload disabled');
    return null;
  }
};

// File saving disabled - screenshots only stored in database
const saveImageLocally = async (base64Data, fileName) => {
  console.log('📸 File saving disabled - screenshots stored in database only');
  return null; // No file saving
  
  /* File saving functionality disabled
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Remove the data:image/...;base64, prefix
    const base64Image = base64Data.split(',')[1];
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'png';
    const uniqueFileName = `screenshot-${timestamp}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Save file
    fs.writeFileSync(filePath, buffer);
    
    // Return URL path
    return `/uploads/${uniqueFileName}`;
  } catch (error) {
    console.error('❌ Local save failed:', error);
    throw error;
  }
  */
};

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DIRECT TEST - Add this button to test screenshot saving directly
app.post('/api/direct-test', async (req, res) => {
  try {
    console.log('🧪 DIRECT TEST: Creating order with screenshot...');
    
    const testOrder = {
      orderId: 'DIRECT-TEST-' + Date.now(),
      customer: {
        name: 'Test User',
        phone: '1234567890',
        email: 'test@test.com',
        address: 'Test Address'
      },
      items: [{
        id: 1,
        name: 'Test Item',
        price: 100,
        quantity: 1
      }],
      total: 100,
      paymentMethod: 'UPI Payment (Screenshot Uploaded)',
      status: 'Payment Verification Pending',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test-screenshot.png',
        uploadTime: new Date().toISOString()
      }
    };
    
    console.log('🧪 Test order object:', {
      orderId: testOrder.orderId,
      hasScreenshot: !!testOrder.paymentScreenshot,
      screenshotDataLength: testOrder.paymentScreenshot.data.length
    });
    
    const order = new Order(testOrder);
    const savedOrder = await order.save();
    
    console.log('✅ DIRECT TEST: Order saved successfully:', {
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length,
      allFields: Object.keys(savedOrder.toObject())
    });
    
    res.json({
      success: true,
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length
    });
    
  } catch (error) {
    console.error('❌ DIRECT TEST FAILED:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Test endpoint to see what data we receive
app.post('/api/debug-order', (req, res) => {
  console.log('🔍 DEBUG: Received request body keys:', Object.keys(req.body));
  console.log('🔍 DEBUG: Has paymentScreenshot:', !!req.body.paymentScreenshot);
  console.log('🔍 DEBUG: PaymentScreenshot keys:', req.body.paymentScreenshot ? Object.keys(req.body.paymentScreenshot) : 'none');
  console.log('🔍 DEBUG: Screenshot data length:', req.body.paymentScreenshot?.data?.length);
  console.log('🔍 DEBUG: Full request body structure:', JSON.stringify(req.body, null, 2).substring(0, 1000));
  res.json({ received: true, hasScreenshot: !!req.body.paymentScreenshot });
});

// Test endpoint to verify schema works with screenshot data
app.post('/api/test-screenshot', async (req, res) => {
  try {
    console.log('🧪 Testing screenshot save capability...');
    
    const testOrder = new Order({
      orderId: 'TEST-' + Date.now(),
      customer: { name: 'Test User', phone: '1234567890', email: 'test@test.com', address: 'Test Address' },
      items: [{ id: 1, name: 'Test Item', price: 100, quantity: 1 }],
      total: 100,
      paymentMethod: 'Test Payment',
      status: 'Test',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test.png',
        uploadTime: new Date().toISOString()
      }
    });
    
    const saved = await testOrder.save();
    console.log('✅ Test order saved with screenshot:', !!saved.paymentScreenshot);
    
    // Clean up test order
    await Order.deleteOne({ orderId: saved.orderId });
    
    res.json({ success: true, hasScreenshot: !!saved.paymentScreenshot });
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// Simple in-memory cache for products
let productsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 60 seconds - longer cache for speed

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check cache first
    const now = Date.now();
    if (productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving products from cache (instant)');
      // Set cache headers for browser caching
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(productsCache);
    }

    console.log('📡 Fetching products from database...');
    // Use lean() for faster queries (returns plain JS objects)
    const products = await Product.find()
      .lean()
      .select('-__v -updatedAt -createdAt') // Exclude unnecessary fields for speed
      .limit(100) // Limit results for faster loading
      .sort({ _id: -1 }); // Sort by _id is faster than createdAt
    
    // Transform MongoDB _id to id for client compatibility
    const transformedProducts = products.map(p => ({
      ...p,
      id: p._id.toString()
    }));
    
    // Update cache
    productsCache = transformedProducts;
    cacheTimestamp = now;
    
    const duration = Date.now() - startTime;
    console.log(`✅ Returning ${transformedProducts.length} products (took ${duration}ms)`);
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60');
    res.json(transformedProducts);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    
    // If timeout, send specific error
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(504).json({ 
        error: 'Database query timeout - please try again',
        timeout: true 
      });
    }
    
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
    
    // Invalidate cache
    productsCache = null;
    
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

    // Invalidate cache
    productsCache = null;

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

    // Invalidate cache
    productsCache = null;

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
    
    console.log('📤 [SERVER] Sending orders to client:', {
      totalOrders: orders.length,
      ordersWithScreenshots: orders.filter(o => o.paymentScreenshot?.data).length
    });
    
    // Debug each order's screenshot data
    orders.forEach((order, index) => {
      if (order.paymentScreenshot) {
        console.log(`📋 [SERVER] Order ${index + 1} screenshot:`, {
          orderId: order.orderId,
          hasScreenshotData: !!order.paymentScreenshot.data,
          screenshotDataLength: order.paymentScreenshot.data?.length,
          fileName: order.paymentScreenshot.fileName
        });
      }
    });
    
    res.json(orders);
  } catch (error) {
    console.error('❌ [SERVER] Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    console.log('📥 Received order data:', {
      orderId: req.body.orderId,
      hasScreenshot: !!req.body.paymentScreenshot,
      screenshotDataLength: req.body.paymentScreenshot?.data?.length,
      screenshotDataType: typeof req.body.paymentScreenshot?.data,
      screenshotDataPreview: req.body.paymentScreenshot?.data?.substring(0, 50),
      paymentMethod: req.body.paymentMethod,
      fileName: req.body.paymentScreenshot?.fileName
    });
    
    // Validate screenshot data if present
    if (req.body.paymentScreenshot && req.body.paymentScreenshot.data) {
      if (!req.body.paymentScreenshot.data.startsWith('data:image/')) {
        console.error('❌ Invalid screenshot data format');
        return res.status(400).json({ error: 'Invalid screenshot data format' });
      }
      
      if (req.body.paymentScreenshot.data.length > 10 * 1024 * 1024) { // 10MB limit
        console.error('❌ Screenshot data too large:', req.body.paymentScreenshot.data.length);
        return res.status(400).json({ error: 'Screenshot data too large' });
      }
    }
    
    // Create order object explicitly
    const orderData = {
      orderId: req.body.orderId,
      customer: req.body.customer,
      items: req.body.items,
      total: req.body.total,
      paymentMethod: req.body.paymentMethod,
      status: req.body.status || 'Pending',
      orderDate: req.body.orderDate || new Date()
    };
    
    // Process screenshot data if present - store base64 directly in database only (no file saving)
    if (req.body.paymentScreenshot && req.body.paymentScreenshot.data) {
      console.log('📸 Processing screenshot - storing in database only (no file saving)...');
      
      orderData.paymentScreenshot = {
        data: req.body.paymentScreenshot.data, // Store base64 directly in database only
        fileName: req.body.paymentScreenshot.fileName,
        uploadTime: req.body.paymentScreenshot.uploadTime
      };
      
      console.log('📸 Screenshot stored in database only:', {
        hasData: !!orderData.paymentScreenshot.data,
        fileName: orderData.paymentScreenshot.fileName,
        dataLength: orderData.paymentScreenshot.data.length,
        note: 'No file saved to disk'
      });
    }
    
    const order = new Order(orderData);
    const savedOrder = await order.save();
    
    console.log('✅ Order saved to MongoDB:', {
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      hasImageUrl: !!savedOrder.paymentScreenshot?.imageUrl,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length,
      screenshotSavedCorrectly: savedOrder.paymentScreenshot?.data?.startsWith('data:image/'),
      allFields: Object.keys(savedOrder.toObject())
    });
    
    io.emit('order-added', savedOrder);
    console.log('📡 Order broadcasted via socket');
    
    res.json(savedOrder);
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
    console.log('🗑️ Deleting order:', req.params.orderId);
    const deletedOrder = await Order.findOneAndDelete({ orderId: req.params.orderId });
    
    if (!deletedOrder) {
      console.log('⚠️ Order not found:', req.params.orderId);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('✅ Order deleted successfully:', req.params.orderId);
    io.emit('order-deleted', { orderId: req.params.orderId });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to process screenshot without saving to file
app.post('/api/test-image-upload', async (req, res) => {
  try {
    const { imageData, fileName } = req.body;
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Missing imageData or fileName' });
    }
    
    console.log('🧪 Testing image processing (no file saving):', {
      fileName: fileName,
      dataLength: imageData.length,
      isValidFormat: imageData.startsWith('data:image/')
    });
    
    // Process image data without saving to file
    console.log('✅ Image processed successfully (stored in memory only)');
    
    res.json({
      success: true,
      originalFileName: fileName,
      dataLength: imageData.length,
      message: 'Image processed successfully - no file saved to disk'
    });
  } catch (error) {
    console.error('❌ Test image processing failed:', error);
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
