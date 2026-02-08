// Manjula Mobile World - Complete JavaScript Application with MongoDB
class ManjulaMobilesApp {
  constructor() {
    this.currentPage = "home"
    this.cart = []
    this.cartOpen = false
    this.productSearch = ""
    this.mobileMenuOpen = false
    this.orders = [];
    this.serviceSubMenuOpen = false;
    this.mobileServiceSubMenuOpen = false;
    this.upiLink = "keerthivasan98406@okhdfcbank"
    
    // MongoDB API URL - Auto-detect local vs production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    // Use Render backend for GitHub Pages deployment
    const baseURL = isLocalhost 
      ? 'http://localhost:3001' 
      : isGitHubPages 
        ? 'https://manjulamobilesworld.onrender.com'  // Your Render backend URL
        : window.location.origin;
    this.API_URL = `${baseURL}/api`
    
    // Socket.IO connection for real-time updates with reconnection
    if (typeof io !== 'undefined') {
      this.socket = io(baseURL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      })
      this.setupSocketListeners()
    } else {
      console.warn('⚠️ Socket.IO not loaded, real-time updates disabled');
      this.socket = null;
    }
    
    // Carousel properties
    this.carouselImages = [
      "./public/assets/images/1.jpg",
      "./public/assets/images/2.jpg",
      "./public/assets/images/3.jpg",
      "./public/assets/images/4.jpg"
    ];
    this.currentCarouselIndex = 0;
    this.carouselInterval = null;
    
    this.products = [];
    this.trackingData = [];
    
    // Store interval ID for cleanup
    this.refreshInterval = null;
    
    // Safety check to ensure scrolling is never stuck
    this.scrollCheckInterval = null;
    
    this.init()
    
    // Auto-refresh products every 30 seconds (reduced from 5 seconds to prevent lag)
    // Only if Socket.IO is not available for real-time updates
    if (!this.socket) {
      this.refreshInterval = setInterval(() => {
        if (this.currentPage === 'products') {
          console.log('⏰ [MAIN WEBSITE] Auto-refreshing products...');
          this.loadProductsFromDatabase();
        }
      }, 30000); // 30 seconds instead of 5
    }
    
    // Safety check every 10 seconds to ensure scrolling is not stuck
    this.scrollCheckInterval = setInterval(() => {
      // Check if any modal is open
      const galleryModal = document.getElementById('galleryModal');
      const isModalOpen = galleryModal && galleryModal.classList.contains('active');
      
      // If no modal is open but body overflow is hidden, restore it
      if (!isModalOpen && document.body.style.overflow === 'hidden') {
        console.log('⚠️ Detected stuck scroll, restoring...');
        document.body.style.overflow = '';
        document.body.style.overflowY = '';
      }
    }, 10000); // Check every 10 seconds
  }

  // Calculate years of experience dynamically based on business start year
  getYearsOfExperience() {
    const businessStartYear = 2017; // Manjula Mobile World started in 2017
    const currentYear = new Date().getFullYear();
    return currentYear - businessStartYear;
  }

  // Socket.IO Real-time Listeners
  setupSocketListeners() {
    if (!this.socket) {
      console.warn('⚠️ No socket connection, skipping listeners');
      return;
    }
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to server for real-time updates');
      console.log('Socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
      // Reload data after reconnection
      this.loadProductsFromStorage();
      this.loadTrackingFromStorage();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('product-added', (product) => {
      console.log('📦 [MAIN WEBSITE] New product added via socket:', product);
      // Check for duplicates using both id and _id
      const exists = this.products.find(p => 
        String(p.id) === String(product.id) || 
        String(p._id) === String(product._id) ||
        String(p.id) === String(product._id) ||
        String(p._id) === String(product.id)
      );
      if (!exists) {
        this.products.push(product);
        console.log('✅ [MAIN WEBSITE] Product added to local array, total products:', this.products.length);
        if (this.currentPage === 'products') {
          console.log('🔄 [MAIN WEBSITE] Re-rendering products page');
          this.renderPage(this.currentPage);
        }
      } else {
        console.log('⚠️ [MAIN WEBSITE] Product already exists, skipping duplicate');
      }
    });

    this.socket.on('product-updated', (product) => {
      console.log('🔄 Product updated:', product);
      const index = this.products.findIndex(p => p.id === product.id || p._id === product._id);
      if (index !== -1) {
        this.products[index] = product;
        if (this.currentPage === 'products') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('product-deleted', (data) => {
      console.log('🗑️ Product deleted:', data.id);
      this.products = this.products.filter(p => p.id !== data.id && p._id !== data.id);
      if (this.currentPage === 'products') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('tracking-added', (tracking) => {
      console.log('📍 [MAIN WEBSITE] New tracking added via socket:', tracking);
      const exists = this.trackingData.find(t => t.qrId === tracking.qrId);
      if (!exists) {
        this.trackingData.push(tracking);
        console.log('✅ [MAIN WEBSITE] Tracking added to local array, total tracking:', this.trackingData.length);
        if (this.currentPage === 'tracking' || this.currentPage === 'tracking-page') {
          console.log('🔄 [MAIN WEBSITE] Re-rendering tracking page');
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-updated', (tracking) => {
      console.log('🔄 Tracking updated:', tracking);
      const index = this.trackingData.findIndex(t => t.qrId === tracking.qrId);
      if (index !== -1) {
        this.trackingData[index] = tracking;
        if (this.currentPage === 'tracking' || this.currentPage === 'tracking-page') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-deleted', (data) => {
      console.log('🗑️ Tracking deleted:', data.qrId);
      this.trackingData = this.trackingData.filter(t => t.qrId !== data.qrId);
      if (this.currentPage === 'tracking' || this.currentPage === 'tracking-page') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('order-added', (order) => {
      console.log('🛒 New order received:', order);
      const exists = this.orders.find(o => o.orderId === order.orderId);
      if (!exists) {
        this.orders.push(order);
        if (this.currentPage === 'dashboard') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-updated', (order) => {
      console.log('🔄 Order updated:', order);
      const index = this.orders.findIndex(o => o.orderId === order.orderId);
      if (index !== -1) {
        this.orders[index] = order;
        if (this.currentPage === 'dashboard') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-deleted', (data) => {
      console.log('🗑️ Order deleted:', data.orderId);
      this.orders = this.orders.filter(o => o.orderId !== data.orderId);
      if (this.currentPage === 'dashboard') {
        this.renderPage(this.currentPage);
      }
    });
  }

  // Product Management Methods - Database ONLY
  async loadProductsFromStorage() {
    try {
      console.log('📡 [MAIN WEBSITE] Loading products from database...');
      
      const response = await fetch(`${this.API_URL}/products`);
      if (response.ok) {
        this.products = await response.json();
        console.log('✅ [MAIN WEBSITE] Loaded products from database:', this.products.length);
        console.log('📊 [MAIN WEBSITE] Product names:', this.products.map(p => p.name));
      } else {
        console.log('⚠️ [MAIN WEBSITE] Failed to load from database');
        this.products = [];
      }
    } catch (error) {
      console.error('❌ [MAIN WEBSITE] Error loading products:', error);
      this.products = [];
    }
  }

  // Background method to load from database
  async loadProductsFromDatabase() {
    try {
      console.log('📡 [MAIN WEBSITE] Loading products from database...');
      
      const response = await fetch(`${this.API_URL}/products`);
      if (response.ok) {
        const dbProducts = await response.json();
        console.log('📦 [MAIN WEBSITE] Received products from database:', dbProducts.length);
        
        // Check if there are new products
        const oldCount = this.products.length;
        const newCount = dbProducts.length;
        
        // Use database products directly (no localStorage)
        this.products = dbProducts;
        
        console.log('✅ [MAIN WEBSITE] Products loaded from database:', this.products.length);
        console.log('📊 [MAIN WEBSITE] Product names:', this.products.map(p => p.name));
        
        // Show notification if new products were added
        if (newCount > oldCount && oldCount > 0) {
          console.log('🆕 [MAIN WEBSITE] New products detected!');
          this.showNotification(`🆕 ${newCount - oldCount} new product(s) added!`);
        }
        
        // Re-render products page if currently viewing it
        if (this.currentPage === 'products') {
          console.log('🔄 [MAIN WEBSITE] Re-rendering products page');
          this.renderPage(this.currentPage);
        }
      } else {
        console.error('❌ [MAIN WEBSITE] Failed to load products from database');
      }
    } catch (error) {
      console.error('❌ [MAIN WEBSITE] Database load error:', error);
    }
  }

  // Show notification to user
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; font-size: 14px; font-weight: 600;">
        ${message}
      </div>
    `;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  getDefaultProducts() {
    return [
      {
        id: 1,
        name: "Samsung Galaxy S23",
        category: "Smartphones",
        price: 45000,
        originalPrice: 50000,
        image: "📱",
        imageUrl: "./public/assets/images/1.jpg",
        imageUrl2: "./public/assets/images/2.jpg",
        rating: 4.8,
        reviews: 234,
        inStock: true,
        badge: "Best Seller",
        qrId: "",
        qrPassword: "",
        trackingStatus: "Received",
        ownerGender: "none"
      }
  ];
  }

  // Tracking Management Methods - MongoDB API
  async loadTrackingFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/tracking`);
      if (response.ok) {
        this.trackingData = await response.json();
        console.log('✅ Loaded tracking from MongoDB:', this.trackingData.length);
      } else {
        this.trackingData = [];
      }
    } catch (error) {
      console.error('❌ Error loading tracking:', error);
      this.trackingData = [];
    }
  }

  async saveTrackingToStorage() {
    // Tracking is saved individually via API
  }

  // Orders Management Methods - MongoDB API
  async loadOrdersFromStorage() {
    try {
      // Load from database via API
      const response = await fetch(`${this.API_URL}/orders`);
      if (response.ok) {
        this.orders = await response.json();
        console.log('✅ Loaded orders from database:', this.orders.length);
      } else {
        console.log('⚠️ No orders found in database');
        this.orders = [];
      }
    } catch (error) {
      console.error('❌ Error loading orders:', error);
      this.orders = [];
    }
  }

  saveOrdersToStorage() {
    // Orders are saved individually via saveSingleOrder
  }

  async saveSingleOrder(order) {
    try {
      console.log('📡 Sending order to server:', {
        orderId: order.id,
        hasScreenshot: !!order.paymentScreenshot,
        screenshotDataLength: order.paymentScreenshot?.data?.length,
        paymentMethod: order.paymentMethod,
        screenshotDataPreview: order.paymentScreenshot?.data?.substring(0, 100)
      });
      
      // Create the request body explicitly
      const requestBody = {
        orderId: order.id,
        customer: order.customer,
        items: order.items,
        total: order.total,
        paymentMethod: order.paymentMethod,
        status: order.status || 'Pending',
        orderDate: order.date || new Date().toISOString()
      };
      
      // Add screenshot data if it exists
      if (order.paymentScreenshot && order.paymentScreenshot.data) {
        requestBody.paymentScreenshot = {
          data: order.paymentScreenshot.data,
          fileName: order.paymentScreenshot.fileName,
          uploadTime: order.paymentScreenshot.uploadTime
        };
        console.log('📸 Adding screenshot to request:', {
          hasData: !!requestBody.paymentScreenshot.data,
          dataLength: requestBody.paymentScreenshot.data.length,
          fileName: requestBody.paymentScreenshot.fileName
        });
      } else {
        console.log('⚠️ No screenshot data found in order object');
      }
      
      console.log('📤 Final request body structure:', {
        orderId: requestBody.orderId,
        hasCustomer: !!requestBody.customer,
        hasItems: !!requestBody.items,
        hasScreenshot: !!requestBody.paymentScreenshot,
        allKeys: Object.keys(requestBody)
      });
      
      // DEBUG: Send to debug endpoint first to see what server receives
      try {
        const debugResponse = await fetch(`${this.API_URL}/debug-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        const debugResult = await debugResponse.json();
        console.log('🔍 DEBUG endpoint response:', debugResult);
      } catch (debugError) {
        console.log('⚠️ Debug endpoint failed:', debugError);
      }
      
      // Save to database via API
      const response = await fetch(`${this.API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response error:', errorText);
        throw new Error(`Failed to save order to database: ${errorText}`);
      }

      const savedOrder = await response.json();
      console.log('✅ Order saved to database:', {
        orderId: savedOrder.orderId,
        hasScreenshot: !!savedOrder.paymentScreenshot,
        screenshotDataLength: savedOrder.paymentScreenshot?.data?.length
      });
      
      // Add to local array
      this.orders.push(savedOrder);
      
      return savedOrder;
    } catch (error) {
      console.error('❌ Error saving order:', error);
      // Still add to local array as fallback
      this.orders.push(order);
      throw error;
    }
  }

  updateOrderStatus(orderId, newStatus) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
    }
  }

  async deleteOrderFromStorage(orderId) {
    try {
      // Find the order to get the correct orderId
      console.log('🔍 Looking for order with ID:', orderId);
      console.log('📋 All orders:', this.orders.map(o => ({ id: o.id, orderId: o.orderId })));
      
      // Convert to string for comparison (handles both string and number IDs)
      const orderIdStr = String(orderId);
      const order = this.orders.find(o => String(o.id) === orderIdStr || String(o.orderId) === orderIdStr || String(o._id) === orderIdStr);
      
      if (!order) {
        console.error('❌ Order not found in local array');
        console.error('❌ Searched for ID:', orderIdStr);
        console.error('❌ Available IDs:', this.orders.map(o => ({ id: String(o.id), orderId: String(o.orderId), _id: String(o._id) })));
        throw new Error('Order not found in local array');
      }
      
      console.log('✅ Found order:', order);

      // Use the orderId field from the order (this is what's stored in database)
      const dbOrderId = order.orderId || order.id;
      
      console.log('🗑️ Deleting order from database:', dbOrderId);
      console.log('📡 API URL:', `${this.API_URL}/orders/${dbOrderId}`);
      
      // Delete from database via API
      const response = await fetch(`${this.API_URL}/orders/${dbOrderId}`, {
        method: 'DELETE'
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Failed to delete order: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Order deleted from database:', result);
      
      // Remove from local array
      this.orders = this.orders.filter(o => o.id !== orderId && o.orderId !== orderId && o.id !== dbOrderId && o.orderId !== dbOrderId);
      console.log('✅ Order removed from local array');
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      throw error;
    }
  }

  async init() {
    try {
      console.log('🚀 Initializing app...');
      
      // Show loading screen immediately
      this.showLoadingScreen();
      
      console.log('📋 Setting up event listeners...');
      // Setup event listeners
      this.setupEventListeners();
      console.log('✅ Event listeners attached');
      
      console.log('📦 Loading products from database...');
      
      // Load products from database - wait up to 7 seconds
      await this.loadProductsFromStorage();
      
      console.log('✅ Products loaded or timeout reached');
      
      console.log('✅ Products loaded:', this.products.length);
      
      console.log('🎨 Rendering home page...');
      // Render page with products from database
      await this.renderPage("home");
      console.log('✅ Home page rendered');
      
      // Load other data in background
      Promise.all([
        this.loadTrackingFromStorage(),
        this.loadOrdersFromStorage()
      ]).catch(error => {
        console.error('❌ Error loading data:', error);
      });
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      // Don't show error screen - just use default products and continue
      console.warn('⚠️ Website will continue with default products');
    }
  }

  showLoadingScreen() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
            <!-- Mobile Phone Icon with Animation -->
            <div class="mobile-icon-wrapper">
              <div class="mobile-phone">
                <div class="phone-screen">
                  <div class="loading-bars">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                </div>
                <div class="phone-button"></div>
              </div>
              <div class="signal-waves">
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="wave"></div>
              </div>
            </div>
            
            <!-- Digital Circuit Pattern -->
            <div class="circuit-pattern">
              <div class="circuit-line line-1"></div>
              <div class="circuit-line line-2"></div>
              <div class="circuit-line line-3"></div>
              <div class="circuit-dot dot-1"></div>
              <div class="circuit-dot dot-2"></div>
              <div class="circuit-dot dot-3"></div>
            </div>
            
            <!-- Loading Text -->
            <div class="loading-text">
              <h2>Manjula Mobile World</h2>
              <p class="loading-subtitle">Mobile Repair & Parts</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
                            <p class="loading-time">⏱️ Maximum wait: 7 seconds</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  showErrorScreen(error) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div style="color: #dc2626; font-size: 48px;">⚠️</div>
          <p style="color: #dc2626; font-weight: 600;">Failed to load products from database</p>
          <p style="font-size: 14px; color: #6b7280; margin: 16px 0;">${error.message}</p>
          <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: left; max-width: 400px;">
            <p style="font-size: 13px; color: #000; margin: 8px 0;"><strong>Possible causes:</strong></p>
            <ul style="font-size: 12px; color: #374151; margin: 8px 0; padding-left: 20px;">
              <li>Server is not running</li>
              <li>MongoDB connection is slow or down</li>
              <li>Internet connection issues</li>
              <li>Database query timeout (> 2 seconds)</li>
            </ul>
            <p style="font-size: 13px; color: #000; margin: 8px 0;"><strong>Solutions:</strong></p>
            <ul style="font-size: 12px; color: #374151; margin: 8px 0; padding-left: 20px;">
              <li>Check if server is running: <code>node server.js</code></li>
              <li>Check MongoDB connection in server console</li>
              <li>Check your internet connection</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
          <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">Retry</button>
        </div>
      `;
    }
  }

  setupEventListeners() {
    const app = document.getElementById("app")
    
    if (!app) {
      console.error('❌ App container not found!');
      return;
    }
    
    console.log('✅ App container found, attaching event listeners...');
    
    // Event delegation for all click events
    app.addEventListener("click", async (e) => {
      // Navigation and page routing - check both target and closest parent
      const pageElement = e.target.closest('[data-page]');
      if (pageElement && pageElement.dataset.page) {
        e.preventDefault()
        console.log('📄 Navigating to page:', pageElement.dataset.page);
        this.closeMobileMenu()
        this.closeServiceSubMenu()
        await this.renderPage(pageElement.dataset.page)
      }
      
      // Action elements (buttons with data-action)
      const actionElement = e.target.closest('[data-action]');
      
      // Cart actions
      if (actionElement && actionElement.dataset.action === "add-to-cart") {
        const productId = actionElement.dataset.productId // Keep as string
        this.addToCart(productId)
      }
      if (actionElement && actionElement.dataset.action === "buy-now") {
        const productId = actionElement.dataset.productId // Keep as string
        this.buyNow(productId)
      }
      if (actionElement && actionElement.dataset.action === "toggle-cart") {
        this.toggleCart()
      }
      if (actionElement && actionElement.dataset.action === "checkout") {
        this.checkout()
      }
      if (actionElement && actionElement.dataset.action === "remove-item") {
        const itemId = actionElement.dataset.itemId // Keep as string
        this.removeFromCart(itemId)
      }
      if (actionElement && actionElement.dataset.action === "increase-quantity") {
        const itemId = actionElement.dataset.itemId // Keep as string
        this.increaseQuantity(itemId)
      }
      if (actionElement && actionElement.dataset.action === "decrease-quantity") {
        const itemId = actionElement.dataset.itemId // Keep as string
        this.decreaseQuantity(itemId)
      }
      
      // Payment actions
      if (actionElement && actionElement.dataset.action === "pay") {
        const method = actionElement.dataset.method
        this.processPayment(method)
      }
      if (actionElement && actionElement.dataset.action === "cancel-payment") {
        this.renderPage("checkout")
      }
      if (actionElement && actionElement.dataset.action === "whatsapp-order") {
        this.whatsappOrder()
      }
      if (actionElement && actionElement.dataset.action === "upload-screenshot") {
        this.handleScreenshotUpload()
      }
      
      // Mobile menu
      if (actionElement && actionElement.dataset.action === "toggle-mobile-menu") {
        this.toggleMobileMenu()
      }
      
      // Tracking actions
      if (actionElement && actionElement.dataset.action === "track-order") {
        this.trackOrder()
      }
      if (actionElement && actionElement.dataset.action === "save-new-tracking") {
        this.saveNewTracking()
      }
      if (actionElement && actionElement.dataset.action === "toggle-tracking-form") {
        this.toggleTrackingForm()
      }
      
      // Carousel actions
      if (actionElement && actionElement.dataset.action === "prev-slide") {
        this.prevCarouselSlide()
      }
      if (actionElement && actionElement.dataset.action === "next-slide") {
        this.nextCarouselSlide()
      }
      if (actionElement && actionElement.dataset.action === "go-to-slide") {
        const slideIndex = Number.parseInt(actionElement.dataset.slideIndex)
        this.goToCarouselSlide(slideIndex)
      }
      
      // Floating cart - toggle cart sidebar
      if (e.target.closest('.floating-cart')) {
        console.log('Floating cart clicked! Toggling cart...');
        this.toggleCart()
      }
      
      // Close mobile menu when clicking on links
      if (e.target.closest('.nav-link') || e.target.closest('.mobile-nav-link')) {
        this.closeMobileMenu()
      }
      
      // Service submenu
      if (actionElement && actionElement.dataset.action === "toggle-service-submenu") {
        this.toggleServiceSubMenu()
      }
      
      // Mobile service submenu
      if (actionElement && actionElement.dataset.action === "toggle-mobile-service-submenu") {
        this.toggleMobileServiceSubMenu()
      }
      
      // Image modal
      if (actionElement && actionElement.dataset.action === "open-image-modal") {
        const imageUrl = actionElement.dataset.imageUrl
        this.openImageModal(imageUrl)
      }
      
      if (actionElement && actionElement.dataset.action === "close-image-modal") {
        this.closeImageModal()
      }
      
      // Gallery modal
      if (actionElement && actionElement.dataset.action === "open-gallery-modal") {
        console.log('🖼️ Opening gallery modal...');
        // Get the current displayed image from the img element
        const imgElement = actionElement.tagName === 'IMG' ? actionElement : actionElement.querySelector('img');
        
        if (imgElement) {
          const currentImageUrl = imgElement.src;
          const img1 = imgElement.dataset.img1 || imgElement.dataset.imageUrl;
          const img2 = imgElement.dataset.img2 || imgElement.dataset.imageUrl2;
          const currentIndex = parseInt(imgElement.dataset.current) || 1;
          
          console.log('📸 Image 1:', img1);
          console.log('📸 Image 2:', img2);
          console.log('📍 Current index:', currentIndex);
          
          // Open modal with the currently displayed image
          this.openGalleryModal(currentImageUrl, img2, currentIndex, img1)
        } else {
          // Fallback for non-image elements
          const imageUrl = actionElement.dataset.imageUrl;
          const imageUrl2 = actionElement.dataset.imageUrl2;
          console.log('📸 Fallback - Image 1:', imageUrl);
          console.log('📸 Fallback - Image 2:', imageUrl2);
          this.openGalleryModal(imageUrl, imageUrl2, 1, imageUrl)
        }
      }
      
      if (actionElement && actionElement.dataset.action === "close-gallery-modal") {
        // Only close if clicking the modal background, not the content
        if (e.target.id === 'galleryModal' || e.target.classList.contains('gallery-modal-close')) {
          this.closeGalleryModal()
        }
      }
      
      // Image navigation arrows
      if (actionElement && actionElement.dataset.action === "switch-image-prev") {
        e.stopPropagation(); // Prevent modal from opening
        this.switchToImage(actionElement, 'prev', e)
      }
      
      if (actionElement && actionElement.dataset.action === "switch-image-next") {
        e.stopPropagation(); // Prevent modal from opening
        this.switchToImage(actionElement, 'next', e)
      }
      
      // Image dots
      if (actionElement && actionElement.dataset.action === "switch-to-image-dot") {
        e.stopPropagation(); // Prevent modal from opening
        const index = parseInt(actionElement.dataset.imgIndex);
        const img1 = actionElement.dataset.img1;
        const img2 = actionElement.dataset.img2;
        this.switchToImageByDot(actionElement, index, img1, img2, e)
      }
    })

    // Handle Enter key in search inputs
    app.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (e.target.id === 'productSearch') {
          this.handleProductSearch()
        }
      }
    })

    // Secret keyboard shortcut to access owner portal (Ctrl+Shift+A)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        if (confirm('Access Owner Portal?')) {
          window.location.href = 'owner.html';
        }
      }
    })
  }

  // Carousel Methods
  startCarousel() {
    this.carouselInterval = setInterval(() => {
      this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.carouselImages.length;
      this.updateCarousel();
    }, 4000);
  }

  stopCarousel() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }

  updateCarousel() {
    const carouselTrack = document.querySelector('.hero-carousel-track');
    if (carouselTrack) {
      carouselTrack.style.transform = `translateX(-${this.currentCarouselIndex * 100}%)`;
    }
    
    const indicators = document.querySelectorAll('.carousel-indicator');
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === this.currentCarouselIndex);
    });
  }

  prevCarouselSlide() {
    this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.carouselImages.length) % this.carouselImages.length;
    this.updateCarousel();
  }

  nextCarouselSlide() {
    this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.carouselImages.length;
    this.updateCarousel();
  }

  goToCarouselSlide(index) {
    this.currentCarouselIndex = index;
    this.updateCarousel();
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen
    const mobileMenu = document.querySelector(".mobile-nav-menu")
    const menuToggle = document.querySelector(".mobile-menu-toggle")

    if (mobileMenu) {
      if (this.mobileMenuOpen) {
        mobileMenu.classList.add("active")
        menuToggle.classList.add("active")
      } else {
        mobileMenu.classList.remove("active")
        menuToggle.classList.remove("active")
      }
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false
    const mobileMenu = document.querySelector(".mobile-nav-menu")
    const menuToggle = document.querySelector(".mobile-menu-toggle")

    if (mobileMenu) {
      mobileMenu.classList.remove("active")
      menuToggle.classList.remove("active")
    }
  }

  toggleServiceSubMenu() {
    this.serviceSubMenuOpen = !this.serviceSubMenuOpen
    const serviceSubMenu = document.querySelector(".service-submenu")
    
    if (serviceSubMenu) {
      if (this.serviceSubMenuOpen) {
        serviceSubMenu.classList.add("active")
      } else {
        serviceSubMenu.classList.remove("active")
      }
    }
  }

  closeServiceSubMenu() {
    this.serviceSubMenuOpen = false
    const serviceSubMenu = document.querySelector(".service-submenu")
    
    if (serviceSubMenu) {
      serviceSubMenu.classList.remove("active")
    }
  }

  toggleMobileServiceSubMenu() {
    this.mobileServiceSubMenuOpen = !this.mobileServiceSubMenuOpen
    const mobileServiceSubMenu = document.querySelector(".mobile-service-submenu")
    
    if (mobileServiceSubMenu) {
      if (this.mobileServiceSubMenuOpen) {
        mobileServiceSubMenu.classList.add("active")
      } else {
        mobileServiceSubMenu.classList.remove("active")
      }
    }
  }

  async handleAdminLogin() {
    const phone = document.getElementById("adminPhone")?.value || ""
    const password = document.getElementById("adminPassword")?.value || ""

    if (phone === "9840694616" && password === "admin123") {
      this.isAdminLoggedIn = true
      // Save login state to localStorage so it persists
      localStorage.setItem('manjula_admin_logged_in', 'true')
      console.log('✅ Admin logged in - state saved to localStorage')
      await this.renderPage("admin")
    } else {
      alert("Invalid password.")
    }
  }

  async handleAdminLogout() {
    this.isAdminLoggedIn = false
    // Remove login state from localStorage
    localStorage.removeItem('manjula_admin_logged_in')
    console.log('✅ Admin logged out - state removed from localStorage')
    await this.renderPage("home")
  }

  async saveProduct() {
    const name = document.getElementById("productName")?.value;
    const category = document.getElementById("productCategory")?.value;
    const price = Number.parseInt(document.getElementById("productPrice")?.value || 0);
    const originalPrice = Number.parseInt(document.getElementById("productOriginalPrice")?.value || 0);
    const imageUrl = document.getElementById("productImageUrl")?.value?.trim();
    const imageUrl2 = document.getElementById("productImageUrl2")?.value?.trim();
    const emoji = document.getElementById("productImage")?.value?.trim();
    const inStock = document.getElementById("productInStock")?.checked || false;

    // Debug: Log form data
    console.log('Saving product with:');
    console.log('Name:', name);
    console.log('ImageURL 1:', imageUrl);
    console.log('ImageURL 2:', imageUrl2);
    console.log('Emoji:', emoji);

    if (!name || !category || !price) {
      alert("Please fill all required fields");
      return;
    }

    // Validate image URL length - increased limit for base64 images
    // Base64 images can be large, so we allow up to 500KB (approximately 700,000 characters)
    if (imageUrl && imageUrl.length > 700000) {
      alert("❌ Image file is too large. Please use a smaller image (max 500KB).");
      return;
    }
    if (imageUrl2 && imageUrl2.length > 700000) {
      alert("❌ Image 2 file is too large. Please use a smaller image (max 500KB).");
      return;
    }

    try {
      if (this.editingProductId) {
        // Update existing product
        const updatedProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          image: emoji || "📦",
          inStock
        };

        // Find the product to get its MongoDB _id
        const editingIdStr = String(this.editingProductId);
        const existingProduct = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
        const mongoId = existingProduct ? (existingProduct._id || existingProduct.id) : this.editingProductId;

        // Update in database via API
        const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        });

        if (!response.ok) {
          throw new Error('Failed to update product in database');
        }

        const savedProduct = await response.json();
        
        // Update local array
        const productIndex = this.products.findIndex((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
        if (productIndex !== -1) {
          this.products[productIndex] = savedProduct;
        }
        
        // Save to localStorage as backup
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        this.editingProductId = null;
        
        alert("✅ Product updated successfully!");
      } else {
        // Create new product - Don't send 'id', let MongoDB generate _id
        const newProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          image: emoji || "📦",
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          rating: 4.5,
          reviews: 0,
          inStock,
          badge: null,
          qrId: "",
          qrPassword: "",
          trackingStatus: "Received",
          ownerGender: "none"
        };

        // Debug: Log what's being saved
        console.log('=== Saving New Product to Database ===');
        console.log('Product:', newProduct);
        console.log('ImageURL 1 length:', newProduct.imageUrl.length);
        console.log('ImageURL 2 length:', newProduct.imageUrl2.length);
        console.log('API URL:', `${this.API_URL}/products`);
        console.log('======================================');

        // Save to database via API
        console.log('📤 Sending POST request to:', `${this.API_URL}/products`);
        const response = await fetch(`${this.API_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });

        console.log('📥 Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server error response:', errorText);
          throw new Error(`Failed to save product to database: ${errorText}`);
        }

        const savedProduct = await response.json();
        console.log('✅ Product saved to database successfully!');
        console.log('📦 Saved product data:', savedProduct);
        
        // Check if product already exists before adding (prevent duplicates)
        const exists = this.products.find(p => 
          String(p.id) === String(savedProduct.id) || 
          String(p._id) === String(savedProduct._id) ||
          String(p.id) === String(savedProduct._id) ||
          String(p._id) === String(savedProduct.id)
        );
        
        if (!exists) {
          // Add to local array
          this.products.push(savedProduct);
          
          // Save to localStorage as backup
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
          console.log('✅ Product added to local array');
        } else {
          console.log('⚠️ Product already exists in local array, skipping');
        }
        
        alert("✅ Product saved successfully to database!");
      }

      // Stay in admin panel instead of going to products page
      this.renderPage("admin");
    } catch (error) {
      console.error('❌ Error saving product:', error);
      alert(`❌ Error: ${error.message}\n\nPlease check your internet connection and try again.`);
    }
  }



  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        // Find the product to get its MongoDB _id
        const productIdStr = String(productId);
        const product = this.products.find(p => String(p.id) === productIdStr || String(p._id) === productIdStr);
        if (!product) {
          alert('Product not found');
          return;
        }

        // Use MongoDB _id for deletion
        const mongoId = product._id || product.id;
        
        // Delete from database via API
        const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete product from database');
        }

        console.log('✅ Product deleted from database:', mongoId);
        
        // Remove from local array
        this.products = this.products.filter((p) => String(p.id) !== productIdStr && String(p._id) !== productIdStr);
        
        // Save to localStorage as backup
        localStorage.setItem('manjula_products', JSON.stringify(this.products));

        this.renderPage("admin");
        alert('✅ Product deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        alert('❌ Error deleting product. Please check your internet connection and try again.');
      }
    }
  }

  // Updated tracking methods for MongoDB
  async saveNewTracking() {
    const qrId = document.getElementById("newTrackingQRId")?.value?.trim();
    const password = document.getElementById("newTrackingPassword")?.value?.trim();
    const customer = document.getElementById("newTrackingCustomer")?.value?.trim();
    const device = document.getElementById("newTrackingDevice")?.value?.trim();
    const contact = document.getElementById("newTrackingContact")?.value?.trim();
    const issue = document.getElementById("newTrackingIssue")?.value?.trim();
    const status = document.getElementById("newTrackingStatus")?.value;
    const days = document.getElementById("newTrackingDays")?.value;

    if (!qrId || !password || !customer || !device || !issue) {
      alert("Please fill all required fields: QR ID, Password, Customer Name, Device Model, and Issue Description");
      return;
    }

    // Check if QR ID already exists
    if (this.trackingData.find((t) => t.qrId === qrId)) {
      alert("This QR ID already exists. Please use a unique QR ID.");
      return;
    }

    try {
      // Create new tracking entry
      const newTracking = {
        qrId: qrId,
        qrPassword: password,
        customerName: customer,
        productName: device,
        deviceModel: device,
        contact: contact,
        status: status,
        issue: issue,
        estimatedDays: Number.parseInt(days) || 2,
        createdAt: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        lastUpdated: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // Save to MongoDB
      const response = await fetch(`${this.API_URL}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTracking)
      });

      if (!response.ok) throw new Error('Failed to save tracking');

      const savedTracking = await response.json();
      
      // Don't push here - Socket.IO will handle it to avoid duplicates
      // this.trackingData.push(savedTracking);
      
      // Clear form
      document.getElementById("newTrackingQRId").value = "";
      document.getElementById("newTrackingPassword").value = "";
      document.getElementById("newTrackingCustomer").value = "";
      document.getElementById("newTrackingDevice").value = "";
      document.getElementById("newTrackingContact").value = "";
      document.getElementById("newTrackingIssue").value = "";
      document.getElementById("newTrackingDays").value = "2";
      
      this.toggleTrackingForm();
      alert("✅ Tracking record created successfully!\n\nQR ID: " + qrId + "\nPassword: " + password + "\n\nShare these details with your customer for tracking.");
      this.renderPage("admin");
    } catch (error) {
      console.error('Error saving tracking:', error);
      alert('Error saving tracking. Please try again.');
    }
  }

  async editTracking(qrId) {
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    if (!tracking) return;

    // Show status update modal
    this.showStatusModal(tracking);
  }

  showStatusModal(tracking) {
    const statuses = [
      { value: 'Received', label: '📥 Received', desc: 'Device received at service center' },
      { value: 'Diagnostics', label: '🔍 Diagnostics', desc: 'Checking device issues' },
      { value: 'In Progress', label: '🔧 In Progress', desc: 'Repair work in progress' },
      { value: 'Parts Ordered', label: '📦 Parts Ordered', desc: 'Waiting for replacement parts' },
      { value: 'Quality Check', label: '✅ Quality Check', desc: 'Final testing' },
      { value: 'Ready for Pickup', label: '📢 Ready for Pickup', desc: 'Ready for collection' },
      { value: 'Completed', label: '🎉 Completed', desc: 'Service completed' }
    ];

    const modalHTML = `
      <div class="status-modal" id="statusModal">
        <div class="status-modal-content">
          <div class="status-modal-header">
            <div class="status-modal-title">Update Repair Status</div>
            <div class="status-modal-subtitle">
              QR: ${tracking.qrId} | Device: ${tracking.productName} | Customer: ${tracking.customerName}
            </div>
          </div>
          
          <div class="status-select-group">
            <label class="status-select-label">Select New Status</label>
            <select class="status-select" id="newStatusSelect">
              ${statuses.map(s => `
                <option value="${s.value}" ${s.value === tracking.status ? 'selected' : ''}>
                  ${s.label} - ${s.desc}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="status-modal-actions">
            <button class="status-btn status-btn-cancel" onclick="app.closeStatusModal()">Cancel</button>
            <button class="status-btn status-btn-save" onclick="app.saveTrackingStatus('${tracking.qrId}')">Update Status</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    const existingModal = document.getElementById('statusModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
      modal.remove();
    }
  }

  async saveTrackingStatus(qrId) {
    const newStatus = document.getElementById('newStatusSelect').value;
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    
    if (!tracking) return;

    tracking.status = newStatus;
    tracking.lastUpdated = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    try {
      // Update in MongoDB
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, lastUpdated: tracking.lastUpdated })
      });
      
      if (!response.ok) throw new Error('Failed to update tracking');
      
      this.closeStatusModal();
      this.renderPage("admin");
      alert(`✅ Status updated to: ${newStatus}`);
    } catch (error) {
      console.error('Error updating tracking:', error);
      alert('Error updating tracking. Please try again.');
    }
  }

  async deleteTracking(qrId) {
    if (confirm("Are you sure you want to delete this tracking record?")) {
      try {
        // Delete from MongoDB
        const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete tracking');
        
        // Remove from local array
        this.trackingData = this.trackingData.filter((t) => t.qrId !== qrId);
        
        this.renderPage("admin");
        alert('✅ Tracking deleted successfully!');
      } catch (error) {
        console.error('Error deleting tracking:', error);
        alert('Error deleting tracking. Please try again.');
      }
    }
  }

  trackOrder() {
    const qrId = document.getElementById("orderId").value.trim()
    const password = document.getElementById("orderPassword").value.trim()
    const result = document.getElementById("trackResult")

    if (!qrId || !password) {
      alert("Please enter both QR ID and Password")
      return
    }

    const trackingEntry = this.trackingData.find((t) => t.qrId === qrId && t.qrPassword === password)

    if (trackingEntry) {
      document.getElementById("resultOrderId").textContent = qrId
      document.getElementById("resultCustomer").textContent = trackingEntry.customerName || 'Customer'
      document.getElementById("resultDevice").textContent = trackingEntry.productName
      document.getElementById("resultIssue").textContent = trackingEntry.issue || "Mobile Repair Service"
      document.getElementById("resultEstDays").textContent = `${trackingEntry.estimatedDays} days`
      document.getElementById("resultLastUpdated").textContent = trackingEntry.lastUpdated || trackingEntry.createdAt
      
      // Generate timeline
      this.renderTrackingTimeline(trackingEntry.status)
      
      result.style.display = "block"
      
      // Scroll to result
      result.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      alert("❌ Invalid QR ID or Password. Please check and try again.\n\nIf you don't have these details, please contact the service center.")
    }
  }

  renderTrackingTimeline(currentStatus) {
    const statuses = [
      { name: 'Received', emoji: '📥', desc: 'Device received at service center' },
      { name: 'Diagnostics', emoji: '🔍', desc: 'Checking device issues' },
      { name: 'In Progress', emoji: '🔧', desc: 'Repair work in progress' },
      { name: 'Parts Ordered', emoji: '📦', desc: 'Waiting for replacement parts' },
      { name: 'Quality Check', emoji: '✅', desc: 'Final testing and verification' },
      { name: 'Ready for Pickup', emoji: '📢', desc: 'Device ready for collection' },
      { name: 'Completed', emoji: '🎉', desc: 'Service completed' }
    ];

    const currentIndex = statuses.findIndex(s => s.name === currentStatus);
    
    const timelineHTML = statuses.map((status, index) => {
      const isCompleted = index < currentIndex;
      const isCurrent = index === currentIndex;
      const isPending = index > currentIndex;
      
      const dotClass = isCompleted ? 'completed' : (isCurrent ? 'current' : 'pending');
      const lineClass = isCompleted ? 'completed' : '';
      const statusClass = isCompleted ? 'completed' : (isCurrent ? 'current' : 'pending');
      
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}"></div>
          <div class="timeline-line ${lineClass}"></div>
          <div class="timeline-content">
            <div class="timeline-status ${statusClass}">
              ${status.emoji} ${status.name}
            </div>
            <div class="timeline-date">${status.desc}</div>
          </div>
        </div>
      `;
    }).join('');

    const timelineContainer = document.getElementById("trackingTimeline");
    if (timelineContainer) {
      timelineContainer.innerHTML = `<div class="tracking-timeline">${timelineHTML}</div>`;
    }
  }

  getStatusEmoji(status) {
    const emojiMap = {
      'Received': '📥',
      'Diagnostics': '🔍',
      'In Progress': '🔧',
      'Parts Ordered': '📦',
      'Quality Check': '✅',
      'Ready for Pickup': '📢',
      'Completed': '🎉'
    }
    return emojiMap[status] || '📱'
  }

  toggleTrackingForm() {
    const form = document.getElementById("trackingForm")
    if (form) {
      form.style.display = form.style.display === "none" ? "block" : "none"
    }
  }

  // UPDATED: proceedToPayment method - store order data but don't save yet
  proceedToPayment() {
    const fullName = document.getElementById("fullName").value
    const email = document.getElementById("email").value
    const phone = document.getElementById("phone").value
    const address = document.getElementById("address").value
    const city = document.getElementById("city").value
    const postalCode = document.getElementById("postalCode").value

    if (!fullName || !email || !phone || !address || !city || !postalCode) {
        alert("Please fill all fields")
        return
    }

    // Store order data temporarily (don't save to database yet)
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const orderId = Date.now()
    this.pendingOrder = {
      id: orderId,
      date: new Date().toISOString(), // Store as ISO string for proper date handling
      customer: {
        name: fullName,
        email: email,
        phone: phone,
        address: `${address}, ${city}, ${postalCode}`
      },
      items: this.cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: cartTotal,
      status: 'Pending Payment',
      paymentMethod: 'Pending'
    }
    
    // Redirect to payment page (order not saved yet)
    this.renderPage("payment")
  }

  async renderPage(page) {
    const app = document.getElementById("app")
    this.currentPage = page

    // Load orders from database when viewing orders page
    if (page === "dashboard") {
      console.log('📦 Loading orders from database...');
      await this.loadOrdersFromStorage();
      console.log('✅ Orders loaded:', this.orders.length);
    }

    let html = this.renderNavigation()

    if (page === "home") {
      html += this.renderHome()
    } else if (page === "products") {
      html += this.renderProducts()
    } else if (page === "about") {
      html += this.renderAbout()
    } else if (page === "dashboard") {
      html += this.renderDashboard()
    } else if (page === "checkout") {
      html += this.renderCheckout()
    } else if (page === "shop-location") {
      html += this.renderShopLocation()
    } else if (page === "tracking-page") {
      html += this.renderTrackingPage()
    } else if (page === "services-hardware") {
      html += this.renderServicesPage("hardware")
    } else if (page === "services-software") {
      html += this.renderServicesPage("software")
    } else if (page === "join-with-us") {
      html += this.renderJoinWithUs()
    } else if (page === "help-desk") {
      html += this.renderHelpDesk()
    } else if (page === "payment") {
      html += this.renderPaymentPage()
    }

    html += this.renderFooter()

    // Add floating cart to products page
    if (page === "products") {
      html += this.renderFloatingCart()
    }

    app.innerHTML = html
    
    // Start carousel if on home page
    if (page === "home") {
      this.startCarousel();
    } else {
      this.stopCarousel();
    }

    // Generate QR code for payment page
    if (page === "payment") {
      setTimeout(() => {
        this.generatePaymentQRCode(this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
      }, 100);
    }
  }

  renderFloatingCart() {
    const cartItemCount = this.cart.reduce((total, item) => total + item.quantity, 0);
    
    return `
      <div class="floating-cart">
        <div class="floating-cart-icon">
          🛒
          ${cartItemCount > 0 ? `<span class="floating-cart-badge">${cartItemCount}</span>` : ''}
        </div>
        <div class="floating-cart-text">
          ${cartItemCount > 0 ? `View Cart (${cartItemCount})` : 'Cart Empty'}
        </div>
      </div>
    `;
  }

  renderNavigation() {
    const cartItemCount = this.cart.reduce((total, item) => total + item.quantity, 0)
    const currentPage = this.currentPage
    
    return `
      <nav>
        <div class="nav-content">
          <div class="nav-brand" style="cursor: pointer; display: flex; align-items: center; gap: 12px;">
            <div class="nav-logo">
              <img src="https://i.pinimg.com/736x/e3/6f/79/e36f793e016dd6b35cd27f84030b7487.jpg" alt="Manjula Mobile World Logo" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px;" onerror="this.innerHTML='<div style=&quot;width:50px;height:50px;background:linear-gradient(135deg,#dc2626,#b91c1c);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;&quot;>📱</div>'">
            </div>
            <div class="nav-title" data-page="home">
              <div style="font-size: 16px; font-weight: 700; white-space: nowrap;">MANJULA MOBIL WORLD</div>
              <div style="font-size: 10px; font-weight: 500; margin-top: 1px;">the final world of mobile services</div>
            </div>
          </div>
          
          <ul class="nav nav-pills">
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'home' ? 'active' : ''}" data-page="home">Home</a>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'shop-location' ? 'active' : ''}" data-page="shop-location">Shop Location</a>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'products' ? 'active' : ''}" data-page="products">Products</a>
            </li>
            <li class="nav-item" style="position: relative;">
              <a class="nav-link ${currentPage.startsWith('services-') ? 'active' : ''}" data-action="toggle-service-submenu">Services</a>
              <div class="service-submenu">
                <a class="nav-link" data-page="services-hardware">Hardware Repair</a>
                <a class="nav-link" data-page="services-software">Software Repair</a>
              </div>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'tracking-page' ? 'active' : ''}" data-page="tracking-page">Track Repair</a>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'about' ? 'active' : ''}" data-page="about">About</a>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'join-with-us' ? 'active' : ''}" data-page="join-with-us">Join With Us</a>
            </li>
            <li class="nav-item">
              <a class="nav-link ${currentPage === 'help-desk' ? 'active' : ''}" data-page="help-desk">Help Desk</a>
            </li>
            <li class="nav-item">
              <a class="nav-link cart-pill" data-action="toggle-cart">
                🛒 Cart ${cartItemCount > 0 ? `<span class="cart-badge">${cartItemCount}</span>` : ''}
              </a>
            </li>

          </ul>
          
          <button class="mobile-menu-toggle" data-action="toggle-mobile-menu">
            Menu
          </button>
        </div>
      </nav>
      
      <div class="mobile-nav-menu">
        <ul class="mobile-nav-pills">
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'home' ? 'active' : ''}" data-page="home">Home</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'shop-location' ? 'active' : ''}" data-page="shop-location">Shop Location</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'products' ? 'active' : ''}" data-page="products">Products</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage.startsWith('services-') ? 'active' : ''}" data-action="toggle-mobile-service-submenu">Services</a>
            <div class="mobile-service-submenu">
              <a class="nav-link" data-page="services-hardware">Hardware Repair</a>
              <a class="nav-link" data-page="services-software">Software Repair</a>
            </div>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'tracking-page' ? 'active' : ''}" data-page="tracking-page">Track Repair</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'about' ? 'active' : ''}" data-page="about">About</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'join-with-us' ? 'active' : ''}" data-page="join-with-us">Join With Us</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${currentPage === 'help-desk' ? 'active' : ''}" data-page="help-desk">Help Desk</a>
          </li>
          <li class="nav-item">
            <a class="nav-link cart-pill" data-action="toggle-cart">
              🛒 Cart ${cartItemCount > 0 ? `(${cartItemCount})` : ''}
            </a>
          </li>

        </ul>
      </div>
    `
  }

  renderHome() {
    return `
      <section class="hero">
        <div class="hero-bg"></div>
        <div class="hero-carousel">
          <div class="hero-carousel-container">
            <div class="hero-carousel-track">
              ${this.carouselImages.map((image, index) => `
                <div class="hero-carousel-slide ${index === 0 ? 'active' : ''}">
                  <img src="${image}" alt="Mobile Repair Service ${index + 1}" loading="lazy">
                </div>
              `).join('')}
            </div>
            
            <div class="carousel-indicators">
              ${this.carouselImages.map((_, index) => `
                <button class="carousel-indicator ${index === 0 ? 'active' : ''}" 
                        data-action="go-to-slide" 
                        data-slide-index="${index}"></button>
              `).join('')}
            </div>
            
            <button class="carousel-nav carousel-prev" data-action="prev-slide">‹</button>
            <button class="carousel-nav carousel-next" data-action="next-slide">›</button>
          </div>
        </div>
        
        <div class="hero-content">
          <div class="hero-grid">
            <div class="hero-text-content">
              <h2>Your Trusted Mobile Repair Partner</h2>
              <p>Expert technicians, genuine parts, and fast service for all your mobile repair needs</p>
              <div class="hero-buttons">
                <button class="btn btn-primary" data-page="tracking-page">Track Your Device</button>
                <button class="btn btn-secondary" data-page="products">Browse Products</button>
              </div>
            </div>
            <div></div> <!-- Empty column for spacing -->
          </div>
        </div>
      </section>

      ${this.renderServicesGrid()}
      ${this.renderSearchSection()}
      ${this.renderCarouselSection()}
      ${this.renderStatsSection()}
    `
  }

  renderServicesGrid() {
    const services = [
      {
        title: "Mobile Repair",
        description: "Expert repairs for all brands. Screen replacement, battery issues, software problems, and more.",
        icon: "🔧",
        features: ["Fast turnaround", "Certified techs", "smart work"],
      },
      {
        title: "Genuine Parts",
        description: "Original batteries, screens, charging ports, and components. Quality guaranteed." ,
        icon: "📦",
        features: ["100% authentic", "Bulk orders", "Wholesale rates"],
      },
      {
        title: "Premium Products",
        description: "Wide range of phones, accessories, cases, and chargers. Best prices guaranteed.",
        icon: "📱",
        features: ["Best prices", "Wide selection", "Free shipping"],
        
      },
      {
        title: "Chip Level Repair",
        description: "Wide range of phones, accessories, cases, and chargers. Best prices guaranteed.",
        icon: "💻",
        features: ["Dead & Data Recovery", "EMMC Reprograming", "CPU Reballing"],
        
      },
    ]

    return `
      <section class="services-section">
        <div class="container">
          <div class="section-header">
            <h2>Our Services</h2>
            <p>Comprehensive solutions for all your mobile needs</p>
          </div>
          <div class="services-grid">
            ${services
              .map(
                (service, idx) => `
                <div class="service-card" style="animation-delay: ${idx * 100}ms;">
                  <div class="service-icon">${service.icon}</div>
                  <h3>${service.title}</h3>
                  <p>${service.description}</p>
                  <ul class="service-features">
                    ${service.features.map((f) => `<li><span class="feature-dot"></span>${f}</li>`).join("")}
                  </ul>
                </div>
              `,
              )
              .join("")}
          </div>
        </div>
      </section>
    `
  }

  renderSearchSection() {
    return `
      <section class="search-section">
        <div class="search-container">
          <h2>Find Your Perfect Product</h2>
          <p>Search through our extensive collection of mobile devices, accessories, and repair services</p>
          <div class="search-input-group">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products, accessories, services..." 
              id="productSearch"
              oninput="app.handleProductSearch()"
            >
            <button class="btn btn-primary" data-page="products">View All</button>
          </div>
        </div>
      </section>
    `
  }

  handleProductSearch() {
    const searchTerm = document.getElementById("productSearch").value.toLowerCase();
    const filteredProducts = this.products.filter(product =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      (product.badge && product.badge.toLowerCase().includes(searchTerm))
    );
    
    // Update the products grid with filtered results
    const productsGrid = document.querySelector('.products-grid');
    if (productsGrid) {
      if (filteredProducts.length > 0) {
        productsGrid.innerHTML = filteredProducts.map(product => this.renderProductCard(product)).join('');
      } else {
        productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 32px 16px; color: #000000ff; font-size: 14px;">No products found matching your search.</div>';
      }
    }
  }

  manualRefresh() {
    // Reload products from localStorage and refresh the page
    this.loadProductsFromStorage().then(() => {
      this.renderPage(this.currentPage);
      console.log('Products refreshed:', this.products.length);
    });
  }

  // Debug function to clear localStorage (for testing)
  clearStorage() {
    localStorage.removeItem('manjula_products');
    console.log('Storage cleared');
    this.loadProductsFromStorage().then(() => {
      this.renderPage(this.currentPage);
    });
  }

  // Function to reset products with new imageUrl2 field
  resetProductsWithImages() {
    localStorage.removeItem('manjula_products');
    this.products = this.getDefaultProducts();
    localStorage.setItem('manjula_products', JSON.stringify(this.products));
    console.log('✅ Products reset with imageUrl2 field');
    this.renderPage(this.currentPage);
  }

  renderCarouselSection() {
    const mobileBrands = [
      { 
        name: "Samsung", 
        image: "https://www.logo.wine/a/logo/Samsung/Samsung-Logo.wine.svg"
      },
      { 
        name: "Apple", 
        image: "https://www.logo.wine/a/logo/Apple_Inc./Apple_Inc.-Logo.wine.svg"
      },
      { 
        name: "Xiaomi", 
        image: "https://www.logo.wine/a/logo/Xiaomi/Xiaomi-Logo.wine.svg"
      },
      { 
        name: "OnePlus", 
        image: "https://www.logo.wine/a/logo/OnePlus/OnePlus-Logo.wine.svg"
      },
      { 
        name: "Oppo", 
        image: "https://www.logo.wine/a/logo/Oppo/Oppo-Logo.wine.svg"
      },
      { 
        name: "Vivo", 
        image: "https://www.logo.wine/a/logo/Vivo_(technology_company)/Vivo_(technology_company)-Logo.wine.svg"
      },
      { 
        name: "poco", 
        image: "https://i.pinimg.com/1200x/37/ee/19/37ee197558a970e5e916cdd8de79f55e.jpg"
      },
     
      { 
        name: "Nokia", 
        image: "https://www.logo.wine/a/logo/Nokia/Nokia-Logo.wine.svg"
      },
      { 
        name: "iqoo", 
        image: "https://i.pinimg.com/1200x/c8/55/03/c85503ffac45d4b8b14ba397f4b44ce9.jpg"
      },

      { 
        name: "motoroal", 
        image: "https://i.pinimg.com/1200x/70/5e/77/705e7798624abe4400185d3bc224d213.jpg"
      
      },
      { 
        name: "tecno", 
        image: "https://i.pinimg.com/736x/4b/44/9b/4b449baf9a14ddce95e5932ef1b01ab2.jpg"
      }
    ];

    // Duplicate the array to create seamless loop
    const carouselItems = [...mobileBrands, ...mobileBrands];

    return `
      <section class="brand-carousel-section">
        <div class="brand-carousel-header">
          <h2>Brands We Support</h2>
          <p>We repair and provide accessories for all major mobile brands</p>
        </div>
        <div class="brand-carousel-container">
          <div class="brand-carousel-track">
            ${carouselItems.map((brand, index) => `
              <div class="brand-carousel-item">
                <div class="brand-carousel-image">
                  <img src="${brand.image}" alt="${brand.name}" loading="lazy">
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `
  }

  renderStatsSection() {
    return `
      <section class="stats-section">
        <div class="container">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">5000+</div>
              <div class="stat-label">Devices Repaired</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">99%</div>
              <div class="stat-label">Satisfaction Rate</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">24hrs</div>
              <div class="stat-label">Express Service</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${this.getYearsOfExperience()}+</div>
              <div class="stat-label">years experience</div>
            </div>
          </div>
        </div>
      </section>
    `
  }

  renderProducts() {
    const searchTerm = (document.getElementById("productSearch")?.value || "").toLowerCase()
    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) || product.category.toLowerCase().includes(searchTerm),
    )

    const html = `
      <div class="products-section">
        <div class="products-header">
          <h1>Repair Services & Parts</h1>
          <p>Professional mobile repair services, genuine parts, and accessories</p>
          
          <div style="margin-top: 24px; display: flex; gap: 8px; width: 100%; box-sizing: border-box; flex-wrap: wrap;">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products..." 
              id="productSearch"
              style="flex: 1; min-width: 200px; box-sizing: border-box;"
              oninput="app.handleProductSearch()"
            >
            <button class="btn btn-secondary" style="white-space: nowrap; padding: 10px 12px; font-size: 12px;" onclick="document.getElementById('productSearch').value = ''; app.handleProductSearch()">Clear</button>
          </div>
        </div>
        <div style="display: flex; position: relative; overflow-x: hidden;">
          <div style="flex: 1; width: 100%; overflow-x: hidden;">
            <div class="products-grid">
              ${
                filteredProducts.length > 0
                  ? filteredProducts.map((product) => this.renderProductCard(product)).join("")
                  : '<div style="grid-column: 1/-1; text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 14px;">No products found matching your search.</div>'
              }
            </div>
          </div>
          ${this.renderShoppingCart()}
        </div>
        
        <div class="gallery-modal" id="galleryModal" data-action="close-gallery-modal">
          <div class="gallery-modal-content">
            <button class="gallery-modal-close" data-action="close-gallery-modal">✕</button>
            <img src="" alt="Product Image" class="gallery-modal-image" id="galleryModalImage">
          </div>
        </div>
      </div>
    `
    return html
  }

  openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-overlay" data-action="close-image-modal"></div>
      <div class="image-modal-content">
        <button class="image-modal-close" data-action="close-image-modal">✕</button>
        <img src="${imageUrl}" alt="Product Image" class="image-modal-img">
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
  }

  closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }



  openGalleryModal(currentImageUrl, imageUrl2 = null, currentIndex = 1, imageUrl1 = null) {
    console.log('🖼️ Opening gallery modal...');
    console.log('Current Image:', currentImageUrl);
    console.log('Image 2:', imageUrl2);
    console.log('Current Index:', currentIndex);
    
    const modal = document.getElementById('galleryModal');
    const modalContent = modal.querySelector('.gallery-modal-content');
    
    if (!modal) {
      console.error('❌ Gallery modal not found!');
      return;
    }
    
    if (!modalContent) {
      console.error('❌ Modal content not found!');
      return;
    }
    
    // Check if product has multiple images
    const hasMultipleImages = imageUrl2 && imageUrl2.trim() !== "";
    const img1 = imageUrl1 || currentImageUrl;
    
    console.log('Has multiple images:', hasMultipleImages);
      
      if (hasMultipleImages) {
        // Create image slider for modal - start with the currently displayed image
        modalContent.innerHTML = `
          <button class="gallery-modal-close" data-action="close-gallery-modal">✕</button>
          <div class="gallery-image-container" style="position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;">
            <img src="${currentImageUrl}" alt="Product Image" class="gallery-modal-image" id="galleryModalImage" data-img1="${img1}" data-img2="${imageUrl2}" data-current="${currentIndex}">
            
            <!-- Previous Arrow -->
            <button class="gallery-nav-arrow gallery-prev-arrow" onclick="app.switchGalleryImage('prev')" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.8); color: white; border: 2px solid white; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; font-weight: bold;">
              ‹
            </button>
            
            <!-- Next Arrow -->
            <button class="gallery-nav-arrow gallery-next-arrow" onclick="app.switchGalleryImage('next')" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.8); color: white; border: 2px solid white; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; font-weight: bold;">
              ›
            </button>
            
            <!-- Dots Indicator -->
            <div class="gallery-dots" style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; z-index: 999;">
              <span class="gallery-dot ${currentIndex === 1 ? 'active' : ''}" onclick="app.goToGalleryImage(1)" style="width: 12px; height: 12px; border-radius: 50%; background: ${currentIndex === 1 ? 'white' : 'rgba(255,255,255,0.4)'}; cursor: pointer; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></span>
              <span class="gallery-dot ${currentIndex === 2 ? 'active' : ''}" onclick="app.goToGalleryImage(2)" style="width: 12px; height: 12px; border-radius: 50%; background: ${currentIndex === 2 ? 'white' : 'rgba(255,255,255,0.4)'}; cursor: pointer; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></span>
            </div>
          </div>
        `;
    } else {
      // Single image
      modalContent.innerHTML = `
        <button class="gallery-modal-close" data-action="close-gallery-modal">✕</button>
        <img src="${currentImageUrl}" alt="Product Image" class="gallery-modal-image" id="galleryModalImage">
      `;
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log('✅ Gallery modal opened');
  }

  switchGalleryImage(direction) {
    console.log('🔄 Switching gallery image:', direction);
    const img = document.getElementById('galleryModalImage');
    if (!img) {
      console.error('❌ Gallery modal image not found!');
      return;
    }
    
    const dots = document.querySelectorAll('.gallery-dot');
    let currentIndex = parseInt(img.getAttribute('data-current')) || 1;
    console.log('📍 Current index:', currentIndex);
    
    // Calculate new index
    if (direction === 'next') {
      currentIndex = currentIndex === 1 ? 2 : 1;
    } else if (direction === 'prev') {
      currentIndex = currentIndex === 1 ? 2 : 1;
    }
    console.log('📍 New index:', currentIndex);
    
    // Get the image URL
    const img1 = img.getAttribute('data-img1');
    const img2 = img.getAttribute('data-img2');
    const newImageUrl = currentIndex === 1 ? img1 : img2;
    console.log('🖼️ Switching to:', newImageUrl);
    
    if (!newImageUrl) {
      console.error('❌ Image URL not found!');
      return;
    }
    
    // Change image with fade effect
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newImageUrl;
      img.setAttribute('data-current', currentIndex);
      img.style.opacity = '1';
      console.log('✅ Image switched successfully');
    }, 150);
    
    // Update dots
    dots.forEach((dot, index) => {
      if (index + 1 === currentIndex) {
        dot.classList.add('active');
        dot.style.background = 'white';
      } else {
        dot.classList.remove('active');
        dot.style.background = 'rgba(255,255,255,0.4)';
      }
    });
  }

  goToGalleryImage(index) {
    console.log('🎯 Going to gallery image:', index);
    const img = document.getElementById('galleryModalImage');
    if (!img) {
      console.error('❌ Gallery modal image not found!');
      return;
    }
    
    const dots = document.querySelectorAll('.gallery-dot');
    const img1 = img.getAttribute('data-img1');
    const img2 = img.getAttribute('data-img2');
    const newImageUrl = index === 1 ? img1 : img2;
    console.log('🖼️ Going to:', newImageUrl);
    
    if (!newImageUrl) {
      console.error('❌ Image URL not found!');
      return;
    }
    
    // Change image with fade effect
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newImageUrl;
      img.setAttribute('data-current', index);
      img.style.opacity = '1';
      console.log('✅ Navigated to image', index);
    }, 150);
    
    // Update dots
    dots.forEach((dot, i) => {
      if (i + 1 === index) {
        dot.classList.add('active');
        dot.style.background = 'white';
      } else {
        dot.classList.remove('active');
        dot.style.background = 'rgba(255,255,255,0.4)';
      }
    });
  }

  closeGalleryModal() {
    const modal = document.getElementById('galleryModal');
    
    if (modal) {
      modal.classList.remove('active');
    }
    
    // Always restore scrolling, even if modal doesn't exist
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    
    console.log('✅ Gallery modal closed, scrolling restored');
  }

  switchProductImage(dotElement, imageUrl) {
    // Find the image element
    const slider = dotElement.closest('.product-image-slider');
    const img = slider.querySelector('.product-img-main');
    
    // Change image with fade effect
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = imageUrl;
      img.style.opacity = '1';
    }, 150);
    
    // Update active dot
    const dots = slider.querySelectorAll('.img-dot');
    dots.forEach(dot => dot.classList.remove('active'));
    dots.forEach(dot => {
      if (dot.getAttribute('onclick').includes(imageUrl)) {
        dot.classList.add('active');
        dot.style.background = '#dc2626';
      } else {
        dot.classList.remove('active');
        dot.style.background = 'rgba(255,255,255,0.5)';
      }
    });
  }

  switchToImage(arrowElement, direction, e) {
    console.log('🔄 switchToImage called:', direction);
    if (e) e.stopPropagation(); // Prevent modal from opening
    
    // Find the slider and image element
    const slider = arrowElement.closest('.product-image-slider');
    if (!slider) {
      console.error('❌ Slider not found');
      return;
    }
    
    const img = slider.querySelector('.product-img-main');
    if (!img) {
      console.error('❌ Image not found');
      return;
    }
    
    const dots = slider.querySelectorAll('.img-dot');
    
    // Get current image index
    let currentIndex = parseInt(img.getAttribute('data-current')) || 1;
    console.log('📍 Current index:', currentIndex);
    
    // Calculate new index based on direction
    if (direction === 'next') {
      currentIndex = currentIndex === 1 ? 2 : 1;
    } else if (direction === 'prev') {
      currentIndex = currentIndex === 1 ? 2 : 1;
    }
    console.log('📍 New index:', currentIndex);
    
    // Get the image URLs
    const img1 = img.getAttribute('data-img1');
    const img2 = img.getAttribute('data-img2');
    const newImageUrl = currentIndex === 1 ? img1 : img2;
    
    console.log('🖼️ Image 1:', img1);
    console.log('🖼️ Image 2:', img2);
    console.log('🖼️ Switching to:', newImageUrl);
    
    if (!newImageUrl) {
      console.error('❌ New image URL not found');
      return;
    }
    
    // Change image with fade effect
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newImageUrl;
      img.setAttribute('data-current', currentIndex);
      img.style.opacity = '1';
      console.log('✅ Image switched successfully');
    }, 150);
    
    // Update dots
    dots.forEach((dot, index) => {
      if (index + 1 === currentIndex) {
        dot.classList.add('active');
        dot.style.background = '#dc2626';
      } else {
        dot.classList.remove('active');
        dot.style.background = 'rgba(255,255,255,0.5)';
      }
    });
  }

  switchToImageByDot(dotElement, index, img1, img2, e) {
    if (e) e.stopPropagation(); // Prevent modal from opening
    
    const slider = dotElement.closest('.product-image-slider');
    if (!slider) return;
    
    const img = slider.querySelector('.product-img-main');
    if (!img) return;
    
    const dots = slider.querySelectorAll('.img-dot');
    
    const newImageUrl = index === 1 ? img1 : img2;
    if (!newImageUrl) return;
    
    // Change image with fade effect
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newImageUrl;
      img.setAttribute('data-current', index);
      img.style.opacity = '1';
    }, 150);
    
    // Update dots
    dots.forEach((dot, i) => {
      if (i + 1 === index) {
        dot.classList.add('active');
        dot.style.background = '#dc2626';
      } else {
        dot.classList.remove('active');
        dot.style.background = 'rgba(255,255,255,0.5)';
      }
    });
  }

  // Switch main image when clicking thumbnails (Amazon-style)
  switchMainImage(productId, imageUrl, index) {
    console.log('🖼️ Switching main image for product:', productId, 'to index:', index);
    
    const mainImg = document.getElementById(`mainImg-${productId}`);
    if (!mainImg) {
      console.error('❌ Main image not found');
      return;
    }
    
    // Find all thumbnails in this product card
    const card = mainImg.closest('.product-card');
    if (!card) return;
    
    const thumbnails = card.querySelectorAll('.thumbnail-item');
    
    // Fade out, change image, fade in
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = imageUrl;
      mainImg.setAttribute('data-current', index); // Update current index for modal
      mainImg.style.opacity = '1';
      console.log('✅ Main image switched to:', imageUrl);
    }, 150);
    
    // Update thumbnail borders
    thumbnails.forEach((thumb, i) => {
      if (i + 1 === index) {
        thumb.style.borderColor = '#dc2626';
        thumb.style.borderWidth = '2px';
        thumb.classList.add('active');
      } else {
        thumb.style.borderColor = '#e5e7eb';
        thumb.style.borderWidth = '2px';
        thumb.classList.remove('active');
      }
    });
  }



  renderProductCard(product) {
    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    
    // Get product ID (use _id if id doesn't exist)
    const productId = product.id || product._id || 'unknown';
    
    // Check if product has multiple images
    const hasMultipleImages = product.imageUrl && product.imageUrl2 && 
                              product.imageUrl.trim() !== "" && product.imageUrl2.trim() !== "";
    
    // Create image gallery HTML
    let imageGalleryHTML = "";
    
    if (product.imageUrl && product.imageUrl.trim() !== "") {
      if (hasMultipleImages) {
        // Modern card layout with image indicator
        imageGalleryHTML = `
          <div class="modern-product-image-wrapper">
            <img src="${product.imageUrl}" 
                 alt="${product.name}" 
                 class="modern-product-image" 
                 id="mainImg-${productId}"
                 data-action="open-gallery-modal"
                 data-image-url="${product.imageUrl}"
                 data-image-url2="${product.imageUrl2}"
                 data-img1="${product.imageUrl}"
                 data-img2="${product.imageUrl2}"
                 data-current="1"
                 style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;">
            <div class="image-indicator">+2 More</div>
          </div>
        `;
      } else {
        // Single image
        imageGalleryHTML = `
          <div class="modern-product-image-wrapper">
            <img src="${product.imageUrl}" 
                 alt="${product.name}" 
                 class="modern-product-image"
                 data-action="open-gallery-modal"
                 data-image-url="${product.imageUrl}"
                 data-image-url2=""
                 style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;">
          </div>
        `;
      }
    } else if (product.image && product.image.trim() !== "" && product.image !== "📦") {
      // Use emoji if no URL
      imageGalleryHTML = `<div class="modern-product-image-wrapper"><span style="font-size: 64px; display: flex; align-items: center; justify-content: center; height: 100%;">${product.image}</span></div>`;
    } else {
      // Use default image
      imageGalleryHTML = `
        <div class="modern-product-image-wrapper">
          <img src="./public/assets/images/1.jpg" alt="${product.name}" class="modern-product-image" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
      `;
    }
    
    // Calculate discount badge color
    const discountBadgeColor = discountPercent >= 50 ? '#ff6b35' : discountPercent >= 20 ? '#f59e0b' : '#10b981';
    
    return `
      <div class="modern-product-card">
        <div class="modern-product-image-container">
          ${imageGalleryHTML}
          ${discountPercent > 0 ? `
            <div class="modern-discount-badge" style="background: ${discountBadgeColor};">
              <span class="discount-icon">⚡</span>
              <span class="discount-text">${discountPercent}% - 25m - 17s</span>
            </div>
          ` : ''}
        </div>
        
        <div class="modern-product-details">
          <h3 class="modern-product-title">${product.name}</h3>
          
          <div class="modern-price-section">
            <span class="modern-current-price">₹${product.price.toLocaleString()}</span>
            ${product.originalPrice > product.price ? `
              <span class="modern-original-price">₹${product.originalPrice.toLocaleString()}</span>
              <span class="modern-discount-percent">${discountPercent}% off</span>
            ` : ''}
          </div>
          
          <div class="modern-delivery-badge">Free Delivery</div>
          
          <div class="modern-rating-section">
            <span class="modern-rating-badge">${product.rating}★</span>
            <span class="modern-reviews-count">${product.reviews.toLocaleString()} Reviews</span>
          </div>
          
          <div class="modern-product-actions">
            <button class="modern-btn modern-btn-cart" data-action="add-to-cart" data-product-id="${productId}" ${!product.inStock ? "disabled" : ""}>
              🛒 Add to Cart
            </button>
            <button class="modern-btn modern-btn-buy" data-action="buy-now" data-product-id="${productId}" ${!product.inStock ? "disabled" : ""}>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `
  }

  renderShoppingCart() {
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const cartHTML = `
      <div class="shopping-cart ${this.cartOpen ? "active" : ""}">
        <div class="cart-header">
          <span class="cart-title">Shopping Cart (${this.cart.length})</span>
          <button class="cart-close" data-action="toggle-cart">✕</button>
        </div>
        <div class="cart-items">
          ${
            this.cart.length === 0
              ? '<p style="color: #94a3b8; text-align: center; margin-top: 24px;">Your cart is empty</p>'
              : this.cart
                  .map(
                    (item) => `
              <div class="cart-item">
                <div class="cart-item-image">${item.image}</div>
                <div class="cart-item-details">
                  <div class="cart-item-name">${item.name}</div>
                  <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
                  <div class="cart-item-controls">
                    <button class="cart-item-btn" data-action="decrease-quantity" data-item-id="${item.id}">-</button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="cart-item-btn" data-action="increase-quantity" data-item-id="${item.id}">+</button>
                  </div>
                </div>
                <button class="cart-item-remove" data-action="remove-item" data-item-id="${item.id}">✕</button>
              </div>
            `,
                  )
                  .join("")
          }
        </div>
        ${
          this.cart.length > 0 ?
          `
            <div class="cart-footer">
              <div class="cart-total">
                <span class="cart-total-label">Total:</span>
                <span class="cart-total-amount">₹${cartTotal.toLocaleString()}</span>
              </div>
              <button class="cart-button" data-action="checkout">Proceed to Checkout</button>
            </div>
          ` : ''
        }
      </div>
    `
    return cartHTML
  }

  addToCart(productId) {
    // Convert to string for comparison since MongoDB _id is a string
    const productIdStr = String(productId);
    const product = this.products.find((p) => String(p.id) === productIdStr || String(p._id) === productIdStr)
    if (product) {
      const existingItem = this.cart.find((item) => String(item.id) === productIdStr || String(item._id) === productIdStr)
      if (existingItem) {
        existingItem.quantity += 1
      } else {
        this.cart.push({ ...product, quantity: 1 })
      }
      this.renderPage("products")
      this.showCartNotification("Item added to cart!")
    } else {
      console.error('Product not found:', productId, 'Available products:', this.products.map(p => ({id: p.id, _id: p._id, name: p.name})));
      alert('Product not found. Please refresh the page.');
    }
  }

  buyNow(productId) {
    // Convert to string for comparison since MongoDB _id is a string
    const productIdStr = String(productId);
    const product = this.products.find((p) => String(p.id) === productIdStr || String(p._id) === productIdStr)
    if (product) {
      // Add to cart if not already there
      const existingItem = this.cart.find((item) => String(item.id) === productIdStr || String(item._id) === productIdStr)
      if (existingItem) {
        existingItem.quantity += 1
      } else {
        this.cart.push({ ...product, quantity: 1 })
      }
      // Go directly to checkout
      this.renderPage("checkout")
    } else {
      console.error('Product not found:', productId, 'Available products:', this.products.map(p => ({id: p.id, _id: p._id, name: p.name})));
      alert('Product not found. Please refresh the page.');
    }
  }

  removeFromCart(itemId) {
    const itemIdStr = String(itemId);
    this.cart = this.cart.filter((item) => String(item.id) !== itemIdStr && String(item._id) !== itemIdStr)
    this.renderPage("products")
  }

  increaseQuantity(itemId) {
    const itemIdStr = String(itemId);
    const item = this.cart.find((item) => String(item.id) === itemIdStr || String(item._id) === itemIdStr)
    if (item) {
      item.quantity += 1
      this.renderPage("products")
    }
  }

  decreaseQuantity(itemId) {
    const itemIdStr = String(itemId);
    const item = this.cart.find((item) => String(item.id) === itemIdStr || String(item._id) === itemIdStr)
    if (item) {
      if (item.quantity > 1) {
        item.quantity -= 1
      } else {
        this.cart = this.cart.filter((item) => String(item.id) !== itemIdStr && String(item._id) !== itemIdStr)
      }
      this.renderPage("products")
    }
  }

  toggleCart() {
    this.cartOpen = !this.cartOpen
    const cart = document.querySelector('.shopping-cart')
    if (cart) {
      if (this.cartOpen) {
        cart.classList.add('active')
      } else {
        cart.classList.remove('active')
      }
    } else {
      // If cart doesn't exist, re-render the page
      this.renderPage("products")
    }
  }

  showCartNotification(message) {
    const notification = document.createElement('div')
    notification.className = 'cart-notification'
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 2000)
  }

  checkout() {
    if (this.cart.length > 0) {
      this.renderPage("checkout")
    } else {
      alert("Your cart is empty!")
    }
  }

  renderCheckout() {
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const cartItems = this.cart.reduce((sum, item) => sum + item.quantity, 0)

    return `
      <div class="checkout-section">
        <div class="checkout-container">
          <button class="back-button" data-page="products">← Back to Products</button>
          <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 12px;">Checkout</h1>
          <p style="color: #94a3b8; font-size: 18px; margin-bottom: 48px;">Complete your repair service order</p>

          <div class="checkout-grid">
            <div>
              <div class="checkout-form">
                <h2>Delivery Information</h2>
                <div class="form-field">
                  <label class="form-label">Full Name *</label>
                  <input type="text" class="input" placeholder="Enter your full name" id="fullName" required>
                </div>
                <div class="form-group-row">
                  <div class="form-field">
                    <label class="form-label">Email *</label>
                    <input type="email" class="input" placeholder="your@email.com" id="email" required>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Phone Number *</label>
                    <input type="tel" class="input" placeholder="+91 XXXXX XXXXX" id="phone" required>
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label">Address *</label>
                  <input type="text" class="input" placeholder="Street address and apartment/suite" id="address" required>
                </div>
                <div class="form-group-row">
                  <div class="form-field">
                    <label class="form-label">City *</label>
                    <input type="text" class="input" placeholder="Your city" id="city" required>
                  </div>
                  <div class="form-field">
                    <label class="form-label">Postal Code *</label>
                    <input type="text" class="input" placeholder="Postal code" id="postalCode" required>
                  </div>
                </div>
                <button class="btn btn-primary" style="width: 100%; padding: 16px; font-size: 16px;" onclick="app.proceedToPayment()">Continue to Payment</button>
              </div>
            </div>
            <div>
              <div class="checkout-summary">
                <h2>Order Summary</h2>
                <div class="summary-items">
                  ${this.cart
                    .map(
                      (item) => `
                      <div class="summary-item">
                        <div>
                          <div class="summary-item-name">${item.name}</div>
                          <div class="summary-item-qty">Qty: ${item.quantity}</div>
                        </div>
                        <div class="summary-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
                      </div>
                    `,
                    )
                    .join("")}
                </div>
                <div class="summary-totals">
                  <div class="summary-row">
                    <span class="summary-label">Subtotal:</span>
                    <span>₹${cartTotal.toLocaleString()}</span>
                  </div>
                  <div class="summary-total">
                    <span>Total:</span>
                    <span class="summary-total-amount">₹${cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${this.renderPaymentModal(cartTotal, cartItems)}
      </div>
    `
  }

  renderPaymentModal(cartTotal, cartItems) {
    return `
      <div id="paymentModal" class="modal">
        <div class="modal-content">
          <h2 class="modal-title">Select Payment Method</h2>
          <div class="payment-info">
            <div class="payment-label">Total Amount to Pay</div>
            <div class="payment-amount">₹${cartTotal.toLocaleString()}</div>
            <div class="payment-details">${cartItems} items</div>
          </div>
          <div class="payment-methods">
            <!-- Cash on Delivery -->
            <button class="payment-method" data-action="pay" data-method="Cash on Delivery">
              <span class="payment-icon">�<//span>
              <span class="payment-name">Cash on Delivery</span>
              <span class="payment-arrow">→</span>
            </button>
          </div>
          <button class="modal-cancel" data-action="cancel-payment">Cancel</button>
        </div>
      </div>
    `
  }

  renderPaymentPage() {
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartItems = this.cart.reduce((total, item) => total + item.quantity, 0);
    
    const orderItems = this.cart.map(item => 
      `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span>${item.name} x ${item.quantity}</span>
        <span>₹${(item.price * item.quantity).toLocaleString()}</span>
      </div>`
    ).join('');

    return `
      <div style="min-height: 100vh; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 50%, #fef2f2 100%); padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 800px;">
          <button class="back-button" data-page="checkout" style="margin-bottom: 24px; background: #6b7280; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">← Back to Checkout</button>
          
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #fecaca;">
            <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; text-align: center; color: #000;">💳 Payment Options</h1>
            
            <!-- Order Summary -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
              <h3 style="color: #000; margin-bottom: 16px; font-size: 20px; text-align: center;">Order Summary</h3>
              ${orderItems}
              <div style="display: flex; justify-content: space-between; padding: 16px 0; border-top: 2px solid #dc2626; margin-top: 16px; font-weight: bold; color: #000; font-size: 20px;">
                <span>Total Amount:</span>
                <span style="color: #dc2626;">₹${cartTotal.toLocaleString()}</span>
              </div>
              <p style="text-align: center; color: #666; font-size: 14px; margin-top: 8px;">${cartItems} items</p>
            </div>
            
            <!-- QR Code Section -->
            <div style="text-align: center; margin-bottom: 32px; padding: 24px; background: #fef2f2; border-radius: 12px; border: 2px solid #dc2626;">
              <h3 style="color: #dc2626; margin-bottom: 16px; font-size: 20px;">📱 Scan QR Code to Pay</h3>
              <div id="paymentQrCode" style="display: flex; justify-content: center; margin-bottom: 16px;"></div>
              <p style="color: #666; font-size: 16px; font-weight: 600;">Amount: ₹${cartTotal.toLocaleString()}</p>
              <p style="color: #666; font-size: 14px; margin-top: 8px;">UPI ID: +91 82484 54841</p>
            </div>
            
            <!-- Direct Payment App Links -->
            <div style="margin-bottom: 32px;">
              <h3 style="color: #000; margin-bottom: 16px; font-size: 18px; text-align: center;">Pay Directly via Apps:</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
                <button onclick="app.openPaymentApp('gpay', ${cartTotal})" style="background: white; color: #333; border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Pay_%28GPay%29_Logo.svg" alt="Google Pay" style="width: 24px; height: 24px;" onerror="this.src='https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/googlepay.svg'">
                  <span>Google Pay</span>
                </button>
                <button onclick="app.openPaymentApp('phonepe', ${cartTotal})" style="background: white; color: #333; border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/0/09/PhonePe_logo.svg" alt="PhonePe" style="width: 24px; height: 24px;" onerror="this.src='https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/phonepe.svg'">
                  <span>PhonePe</span>
                </button>
                <button onclick="app.openPaymentApp('paytm', ${cartTotal})" style="background: white; color: #333; border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" alt="Paytm" style="width: 24px; height: 24px;" onerror="this.src='https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/paytm.svg'">
                  <span>Paytm</span>
                </button>
              </div>
            </div>
            
            <!-- Payment Instructions -->
            <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
              <h4 style="color: #92400e; font-size: 16px; margin-bottom: 12px; font-weight: 700;">📋 Payment Instructions:</h4>
              <ul style="color: #92400e; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Pay ₹${cartTotal.toLocaleString()} to: <strong>+91 82484 54841</strong></li>
                <li>Use any UPI app or scan the QR code above</li>
                <li>Take a screenshot of the payment confirmation</li>
                <li>Upload the screenshot below to complete your order</li>
              </ul>
            </div>
            
            <!-- Action Buttons -->
            <div id="actionButtons" style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" data-action="upload-screenshot" style="background: #10b981; border-color: #10b981; padding: 16px 32px; font-size: 16px; font-weight: 700;">
                📷 Upload Payment Screenshot
              </button>
            </div>
            
            <!-- Hidden Confirm Order Button (will show after screenshot upload) -->
            <div id="confirmOrderSection" style="display: none; text-align: center; margin-top: 32px;">
              <div id="uploadedScreenshotPreview" style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <!-- Screenshot preview will be inserted here -->
              </div>
              <button id="confirmOrderBtn" class="btn btn-primary" style="background: #dc2626; border-color: #dc2626; padding: 20px 40px; font-size: 18px; font-weight: 700;">
                ✅ Confirm Order
              </button>
            </div>
            
            <!-- Help Section -->
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-top: 32px; text-align: center;">
              <p style="font-weight: 600; margin-bottom: 8px; color: #000;">Need help?</p>
              <p style="color: #666; margin-bottom: 16px; font-size: 14px;">If you face any issues with the payment, contact us:</p>
              <a href="https://wa.me/918248454841" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 12px 24px;">
                📱 Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  whatsappOrder() {
    const fullName = document.getElementById("fullName")?.value || "Customer";
    const phone = document.getElementById("phone")?.value || "";
    const address = document.getElementById("address")?.value || "";
    
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderItems = this.cart.map(item => 
      `• ${item.name} - ₹${item.price} x ${item.quantity} = ₹${item.price * item.quantity}`
    ).join('%0A');

    const whatsappMessage = `*New Order Request*%0A%0A*Customer Details:*%0AName: ${fullName}%0APhone: ${phone}%0AAddress: ${address}%0A%0A*Order Items:*%0A${orderItems}%0A%0A*Total Amount: ₹${cartTotal}*%0A%0APlease confirm this order and provide payment details.`;

    const whatsappUrl = `https://wa.me/918248454841?text=${whatsappMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Close payment modal
    document.getElementById('paymentModal').classList.remove('active');
    
    alert('WhatsApp opened with your order details. Please send the message to confirm your order.');
  }

  async finalizeOrder(paymentMethod) {
    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const city = document.getElementById("city").value;
    const postalCode = document.getElementById("postalCode").value;
    
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // Create order object
    const order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: new Date().toLocaleDateString(),
      customer: {
        name: fullName,
        email: email,
        phone: phone,
        address: `${address}, ${city}, ${postalCode}`
      },
      items: [...this.cart],
      total: cartTotal,
      paymentMethod: paymentMethod,
      status: "Processing"
    };
    
    // Save order to MongoDB
    await this.saveSingleOrder(order);
    
    alert(
      `Order placed successfully!\n\nOrder ID: #${order.id}\nPayment Method: ${paymentMethod}\n\nThank you for your order!`,
    );
    
    this.cart = [];
    this.renderPage("home");
  }

  async processPayment(method) {
    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const city = document.getElementById("city").value;
    const postalCode = document.getElementById("postalCode").value;
    
    // Validate required fields
    if (!fullName || !phone || !address || !city) {
      alert("Please fill in all required fields");
      return;
    }
    
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // Create order object
    const order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: new Date().toLocaleDateString(),
      customer: {
        name: fullName,
        email: email,
        phone: phone,
        address: `${address}, ${city}, ${postalCode}`
      },
      items: [...this.cart],
      total: cartTotal,
      paymentMethod: method,
      status: "Processing"
    };
    
    try {
      // Save order to MongoDB (will appear in Owner Portal automatically)
      await this.saveSingleOrder(order);
      
      // Show success message to customer
      alert(
        `✅ Order Placed Successfully!\n\nOrder ID: #${order.id}\n\nYour order details have been sent to us.\nWe will contact you shortly.\n\nThank you for your order!`
      );
      
      // Clear cart and go to home
      this.cart = [];
      this.renderPage("home");
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('There was an error processing your order. Please try again or contact us directly.');
    }
  }

  // Handle screenshot upload for payment proof
  handleScreenshotUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size should be less than 5MB');
          return;
        }
        
        // Create preview and show confirmation
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target.result;
          console.log('📸 File read successfully:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dataLength: imageData.length,
            dataPreview: imageData.substring(0, 50),
            isValidFormat: imageData.startsWith('data:image/')
          });
          this.showScreenshotPreview(imageData, file.name);
        };
        reader.onerror = (e) => {
          console.error('❌ Error reading file:', e);
          alert('Error reading the image file. Please try again.');
        };
        reader.readAsDataURL(file);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  showScreenshotPreview(imageSrc, fileName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 100%; text-align: center;">
        <h3 style="margin-bottom: 16px; color: #000;">Payment Screenshot Preview</h3>
        <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 16px; border: 2px solid #fecaca;">
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">File: ${fileName}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="confirmScreenshot" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">✅ Use This Screenshot</button>
          <button id="cancelUpload" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle confirm screenshot button
    document.getElementById('confirmScreenshot').onclick = () => {
      document.body.removeChild(modal);
      this.showConfirmOrderButton(imageSrc, fileName);
    };
    
    // Handle cancel button
    document.getElementById('cancelUpload').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  showConfirmOrderButton(imageSrc, fileName) {
    // Hide the action buttons
    const actionButtons = document.getElementById('actionButtons');
    if (actionButtons) {
      actionButtons.style.display = 'none';
    }
    
    // Show the confirm order section with screenshot preview
    const confirmSection = document.getElementById('confirmOrderSection');
    const screenshotPreview = document.getElementById('uploadedScreenshotPreview');
    
    if (confirmSection && screenshotPreview) {
      screenshotPreview.innerHTML = `
        <h4 style="color: #10b981; margin-bottom: 12px; font-size: 16px;">✅ Payment Screenshot Uploaded</h4>
        <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 200px; max-height: 120px; border-radius: 8px; border: 2px solid #10b981;">
        <p style="color: #666; font-size: 12px; margin-top: 8px;">📎 ${fileName}</p>
      `;
      
      confirmSection.style.display = 'block';
      
      // Store screenshot data for order finalization
      this.currentScreenshot = {
        data: imageSrc,
        fileName: fileName
      };
      
      // Handle confirm order button click
      document.getElementById('confirmOrderBtn').onclick = () => {
        this.finalizeOrderWithScreenshot(imageSrc, fileName);
      };
    }
  }

  showOrderConfirmation(imageSrc, fileName) {
    // Render as full-screen page instead of modal
    this.renderOrderConfirmationPage(imageSrc, fileName);
  }

  renderOrderConfirmationPage(imageSrc, fileName) {
    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const city = document.getElementById("city").value;
    const postalCode = document.getElementById("postalCode").value;
    
    // Validate required fields
    if (!fullName || !phone || !address || !city) {
      alert("Please fill in all required fields before confirming order");
      return;
    }
    
    const cartTotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderItems = this.cart.map(item => 
      `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span>${item.name} x ${item.quantity}</span>
        <span>₹${(item.price * item.quantity).toLocaleString()}</span>
      </div>`
    ).join('');

    const app = document.getElementById("app");
    app.innerHTML = `
      <div style="min-height: 100vh; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 50%, #fef2f2 100%); padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 800px;">
          <button class="back-button" data-page="payment" style="margin-bottom: 24px; background: #6b7280; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">← Back to Payment</button>
          
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #fecaca;">
            <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; text-align: center; color: #000;">Confirm Your Order</h1>
            
            <!-- Customer Details -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #000; margin-bottom: 16px; font-size: 20px;">Customer Details</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <p style="margin: 8px 0; color: #666;"><strong>Name:</strong> ${fullName}</p>
                <p style="margin: 8px 0; color: #666;"><strong>Phone:</strong> ${phone}</p>
                <p style="margin: 8px 0; color: #666;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 8px 0; color: #666; grid-column: 1 / -1;"><strong>Address:</strong> ${address}, ${city}, ${postalCode}</p>
              </div>
            </div>
            
            <!-- Order Items -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #000; margin-bottom: 16px; font-size: 20px;">Order Items</h3>
              ${orderItems}
              <div style="display: flex; justify-content: space-between; padding: 16px 0; border-top: 2px solid #dc2626; margin-top: 16px; font-weight: bold; color: #000; font-size: 24px;">
                <span>Total Amount:</span>
                <span style="color: #dc2626;">₹${cartTotal.toLocaleString()}</span>
              </div>
            </div>
            
            <!-- Payment Screenshot -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
              <h3 style="color: #000; margin-bottom: 16px; font-size: 20px;">Payment Screenshot</h3>
              <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 300px; max-height: 200px; border-radius: 12px; border: 2px solid #dc2626; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <p style="color: #666; font-size: 14px; margin-top: 12px; font-weight: 600;">📎 ${fileName}</p>
              <p style="color: #10b981; font-size: 14px; margin-top: 8px; font-weight: 600;">✅ Payment screenshot uploaded successfully!</p>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
              <button id="confirmFinalOrder" style="background: #dc2626; color: white; border: none; padding: 20px 40px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
                ✅ Confirm Order
              </button>
              <button data-page="payment" style="background: #6b7280; color: white; border: none; padding: 20px 40px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 18px;">
                ← Go Back
              </button>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 14px; margin-top: 24px; line-height: 1.6;">
              By confirming, your order will be sent to Manjula Mobile World for processing.<br>
              We will verify your payment and contact you shortly.
            </p>
          </div>
        </div>
      </div>
    `;
    
    // Store screenshot data for later use
    this.currentScreenshot = {
      data: imageSrc,
      fileName: fileName
    };
    
    // Handle confirm final order button
    document.getElementById('confirmFinalOrder').onclick = () => {
      this.finalizeOrderWithScreenshot(imageSrc, fileName);
    };
  }

  showCashOnDeliveryConfirm() {
    // Hide the action buttons
    const actionButtons = document.getElementById('actionButtons');
    if (actionButtons) {
      actionButtons.style.display = 'none';
    }
    
    // Show the confirm order section for Cash on Delivery
    const confirmSection = document.getElementById('confirmOrderSection');
    const screenshotPreview = document.getElementById('uploadedScreenshotPreview');
    
    if (confirmSection && screenshotPreview) {
      screenshotPreview.innerHTML = `
        <h4 style="color: #dc2626; margin-bottom: 12px; font-size: 16px;">💵 Cash on Delivery Selected</h4>
        <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="color: #dc2626; font-size: 14px; margin: 0; font-weight: 600;">
            📦 You will pay when your order is delivered to your address.
          </p>
        </div>
        <p style="color: #666; font-size: 12px;">No advance payment required</p>
      `;
      
      confirmSection.style.display = 'block';
      
      // Handle confirm order button click for Cash on Delivery
      document.getElementById('confirmOrderBtn').onclick = () => {
        this.processPayment("Cash on Delivery");
      };
    }
  }

  generatePaymentQRCode(amount) {
    const upiPaymentUrl = `upi://pay?pa=${this.upiLink}&pn=ManjulaMobiles&am=${amount}&tr=ORDER-${Date.now()}&tn=Payment%20for%20Manjula%20Mobiles%20Order`;
    
    const qrContainer = document.getElementById('paymentQrCode');
    if (qrContainer && typeof QRCode !== 'undefined') {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: upiPaymentUrl,
        width: 150,
        height: 150,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else if (qrContainer) {
      // Fallback if QRCode library is not available
      qrContainer.innerHTML = `
        <div style="width: 150px; height: 150px; background: #f3f4f6; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center; border-radius: 8px; margin: 0 auto;">
          <span style="color: #6b7280; font-size: 12px; text-align: center;">QR Code<br>Loading...</span>
        </div>
      `;
    }
  }

  openPaymentApp(appType, amount) {
    const upiId = this.upiLink;
    const merchantName = "ManjulaMobiles";
    const transactionNote = "Payment for Manjula Mobiles Order";
    const transactionId = `ORDER-${Date.now()}`;
    
    let paymentUrl = '';
    let appName = '';
    
    switch(appType) {
      case 'gpay':
        // Google Pay deep link
        paymentUrl = `tez://upi/pay?pa=${upiId}&pn=${merchantName}&am=${amount}&tr=${transactionId}&tn=${transactionNote}`;
        appName = 'Google Pay';
        break;
      case 'phonepe':
        // PhonePe deep link
        paymentUrl = `phonepe://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&tr=${transactionId}&tn=${transactionNote}`;
        appName = 'PhonePe';
        break;
      case 'paytm':
        // Paytm deep link
        paymentUrl = `paytmmp://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&tr=${transactionId}&tn=${transactionNote}`;
        appName = 'Paytm';
        break;
    }
    
    // Create a temporary link element to trigger the app
    const link = document.createElement('a');
    link.href = paymentUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Try to open the app
    try {
      link.click();
      
      // Show success message immediately
      setTimeout(() => {
        alert(`Opening ${appName}...\n\nIf ${appName} doesn't open automatically:\n\n1. Open ${appName} manually\n2. Pay ₹${amount.toLocaleString()} to: ${upiId}\n3. Take a screenshot of payment confirmation\n4. Come back and upload the screenshot`);
      }, 500);
      
    } catch (error) {
      // Fallback if deep link fails
      alert(`Please open ${appName} manually and pay:\n\nUPI ID: ${upiId}\nAmount: ₹${amount.toLocaleString()}\n\nAfter payment, take a screenshot and upload it here.`);
    } finally {
      // Clean up
      document.body.removeChild(link);
    }
    
    // For mobile devices, try alternative method
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // Try to open using window.location for better mobile support
      setTimeout(() => {
        try {
          window.location.href = paymentUrl;
        } catch (e) {
          console.log('Deep link failed, user will need to open app manually');
        }
      }, 100);
    }
  }

  async finalizeOrderWithScreenshot(screenshotData, fileName) {
    console.log('🔍 Processing order with screenshot:', {
      hasData: !!screenshotData,
      dataLength: screenshotData?.length,
      fileName: fileName,
      dataStart: screenshotData?.substring(0, 30)
    });
    
    // Use the pending order data that was stored during proceedToPayment
    if (!this.pendingOrder) {
      alert("Order data not found. Please go back and fill the delivery information again.");
      this.renderPage("checkout");
      return;
    }
    
    // Validate screenshot data
    if (!screenshotData || !fileName) {
      alert("Screenshot data is missing. Please upload the screenshot again.");
      return;
    }
    
    // Create order with actual screenshot data
    const order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: new Date().toLocaleDateString(),
      customer: this.pendingOrder.customer,
      items: this.pendingOrder.items,
      total: this.pendingOrder.total,
      paymentMethod: "UPI Payment (Screenshot Uploaded)",
      status: "Payment Verification Pending",
      paymentScreenshot: {
        data: screenshotData, // Use actual screenshot data
        fileName: fileName,
        uploadTime: new Date().toISOString()
      }
    };
    
    console.log('📸 Order with screenshot:', {
      orderId: order.id,
      hasScreenshot: !!order.paymentScreenshot,
      screenshotDataLength: order.paymentScreenshot.data.length,
      isValidImageData: order.paymentScreenshot.data.startsWith('data:image/')
    });
    
    try {
      // Save order with screenshot
      await this.saveSingleOrder(order);
      
      alert(`✅ Order Placed Successfully! 
      
Order ID: #${order.id}
Payment Method: UPI Payment (Screenshot Uploaded)
Status: Payment Verification Pending

Your payment screenshot has been uploaded and saved. We will verify your payment and contact you shortly.

Thank you for choosing Manjula Mobile World!`);
      
      // Clear cart and go to home
      this.cart = [];
      this.pendingOrder = null;
      this.renderPage("home");
    } catch (error) {
      console.error('❌ Error processing order:', error);
      alert('Failed to place order. Error: ' + error.message + '\n\nPlease try again or contact support.');
    }
  }

  renderDashboard() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 48px;">Order Tracking</h1>
          <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 32px;">
            <p style="color: #94a3b8; text-align: center; font-size: 16px;">Use the order tracking form in the home page to check your device status.</p>
          </div>
        </div>
      </div>
    `
  }

  renderAbout() {
    return `
      <div class="about-section">
        <div class="container" style="padding-top: 96px; padding-bottom: 80px;">
          <div class="about-grid">
            <div class="about-content">
              <div style="display: inline-block; padding: 8px 16px; background-color: rgba(30, 41, 59, 0.5); border: 1px solid rgba(251, 146, 60, 0.3); border-radius: 9999px; margin-bottom: 24px;">
                <span style="color: #fb923c; font-size: 14px; font-weight: 500;">About Us</span>
              </div>
              <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 24px; line-height: 1.2;">Manjula Mobile World</h1>
              <p style="font-size: 18px; color: #94a3b8; margin-bottom: 24px; line-height: 1.6;">Your trusted mobile repair and parts center in Ramapuram, Tamil Nadu. We specialize in professional device repairs, genuine parts supply, and premium mobile accessories with expert technicians and 24/7 support.</p>
              
              <div style="margin-bottom: 32px;">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Why Choose Us?</h3>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px;">
                  <li style="display: flex; align-items: center; gap: 12px;"><span style="color: #fb923c; font-weight: 700;">✓</span> <span>Expert technicians with ${this.getYearsOfExperience()}+ years experience</span></li>
                  <li style="display: flex; align-items: center; gap: 12px;"><span style="color: #fb923c; font-weight: 700;">✓</span> <span>100% genuine spare parts and accessories</span></li>
                  <li style="display: flex; align-items: center; gap: 12px;"><span style="color: #fb923c; font-weight: 700;">✓</span> <span>24-hour express service available</span></li>
                  <li style="display: flex; align-items: center; gap: 12px;"><span style="color: #fb923c; font-weight: 700;">✓</span> <span>6-month warranty on all repairs</span></li>
                  <li style="display: flex; align-items: center; gap: 12px;"><span style="color: #fb923c; font-weight: 700;">✓</span> <span>All major brands supported</span></li>
                </ul>
              </div>

              <div style="display: flex; gap: 16px; margin-bottom: 32px;">
                <button class="btn btn-primary" data-page="products">Shop Now</button>
                <a href="https://maps.app.goo.gl/UEpa2L38EWea9JD67" target="_blank" class="btn btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Visit Us</a>
              </div>

              <div class="contact-info" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Get In Touch</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <p style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 20px;">📍</span> <span><strong>Melmaruvathur, Vandavasi Rd, Ramapuram, Tamil Nadu 603201</strong></span></p>
                  <p style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 20px;">📞</span> <span style="color: #22d3ee;"><strong>+91 82484 54841</strong></span></p>
                  <p style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 20px;">✉️</span> <span style="color: #22d3ee;"><strong>info@manjulamobiles.com</strong></span></p>
                  <p style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 20px;">🕐</span> <span>Mon - Sun: 9:00 AM - 10:00 PM<br>Holidays: 10:00 AM - 8:00 PM</span></p>
                </div>
              </div>
            </div>
            <div class="about-image">
              <div class="shop-image-container">
                <img src="https://images.unsplash.com/photo-1632765486500-24795490f399?w=400&h=400&fit=crop" alt="Mobile Repair Shop" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; margin-bottom: 16px;">
                <div style="background: linear-gradient(to bottom right, rgba(251, 146, 60, 0.2), rgba(239, 68, 68, 0.2)); padding: 32px; border-radius: 12px; text-align: center;">
                  <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Manjula Mobile World</h3>
                  <p style="color: #94a3b8; font-size: 14px; margin-bottom: 16px;">Professional Mobile Repair & Parts Center - Ramapuram</p>
                  <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
                    <span style="background-color: rgba(251, 146, 60, 0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; color: #fb923c;">Expert Service</span>
                    <span style="background-color: rgba(251, 146, 60, 0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; color: #fb923c;">Genuine Parts</span>
                    <span style="background-color: rgba(251, 146, 60, 0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; color: #fb923c;">24/7 Support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderShopLocation() {
    return `
      <div style="min-height: 100vh; background-color: #f8f8f8ff; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 48px; text-align: center;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Visit Our Shop</h1>
            <p style="color: #000000ff; font-size: 18px;">Manjula Mobile World Service Center - Ramapuram, Tamil Nadu</p>
          </div>

          <div style="max-width: 900px; margin: 0 auto;">
            <!-- Map Section - Centered -->
            <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #e01123ff; border-radius: 12px; overflow: hidden; height: 500px; position: relative; cursor: pointer; margin-bottom: 32px;" onclick="window.open('https://maps.app.goo.gl/UEpa2L38EWea9JD67', '_blank')">
              <iframe src="https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d1332.6836960168596!2d79.7577830285442!3d12.468113512373563!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e6!4m5!1s0x3a5319fc59689b47%3A0x9c923c48fdc1fb6b!2sMelmaruvathur!3m2!1d12.4268234!2d79.82995919999999!4m5!1s0x3a531020aa862667%3A0xe25d880e8f98bf09!2sVandavasi%20Rd%2C%20Ramapuram%2C%20Tamil%20Nadu%20603201!3m2!1d12.4451387!2d79.81148309999999!5e1!3m2!1sen!2sin!4v1762845054152!5m2!1sen!2sin" width="100%" height="100%" style="border:0; pointer-events: none;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>

            <!-- Contact Information - Below Map -->
            <div style="background: linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(239, 68, 68, 0.2)); border: 1px solid rgba(251, 146, 60, 0.3); border-radius: 12px; padding: 32px;">
              <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px; text-align: center;">Contact Information</h2>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px;">
                <div>
                  <div style="color: #fb923c; font-weight: 600; margin-bottom: 8px;">📍 Address</div>
                  <p style="color: #000000ff; line-height: 1.6;">Melmaruvathur, Vandavasi Rd, Ramapuram, Tamil Nadu 603201, India</p>
                </div>

                <div>
                  <div style="color: #fb923c; font-weight: 600; margin-bottom: 8px;">📞 Phone</div>
                  <a href="tel:+918248454841" style="color: #87e087ff; text-decoration: none; font-weight: 500; display: block;">+91 82484 54841</a>
                </div>

                <div>
                  <div style="color: #fb923c; font-weight: 600; margin-bottom: 8px;">✉️ Email</div>
                  <a href="mailto:info@manjulamobiles.com" style="color: #87e087ff; text-decoration: none; font-weight: 500; display: block;">info@manjulamobiles.com</a>
                </div>

                <div>
                  <div style="color: #fb923c; font-weight: 600; margin-bottom: 8px;">🕐 Working Hours</div>
                  <p style="color: #000000ff; margin: 4px 0;">Mon - Sun: 9:00 AM - 10:00 PM</p>
                  <p style="color: #d80719ff; margin: 4px 0;">Holidays: 10:00 AM - 8:00 PM</p>
                  <p style="color: #5bde4aff; margin: 8px 0; font-weight: 600;">24/7 Emergency Service</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAdminLogin() {
    return `
      <div style="min-height: 100vh; background-color: #e43838ff; padding-top: 96px; padding-bottom: 80px; display: flex; align-items: center; justify-content: center;">
        <div class="container" style="max-width: 400px;">
          <div style="background-color: rgba(0, 0, 0, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 48px;">
            <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 8px; text-align: center;">Owner Portal</h1>
            <p style="color: #94a3b8; text-align: center; margin-bottom: 32px;">Enter your credentials to access</p>
            
            <div class="form-field">
              <label class="form-label">Phone Number</label>
              <input type="tel" class="input" placeholder="Enter your phone number" id="adminPhone">
            </div>

            <div class="form-field">
              <label class="form-label">Password</label>
              <input type="password" class="input" placeholder="Enter your password" id="adminPassword">
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="admin-login">Login</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="home">Back to Home</button>
          </div>
        </div>
      </div>
    `
  }

  renderOrdersSection() {
    return `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3 class="admin-section-title">Customer Orders</h3>
          <span class="order-count">${this.orders.length} orders</span>
        </div>
        <div class="orders-list" style="max-height: 400px; overflow-y: auto;">
          ${
            this.orders.length > 0
              ? this.orders.map(order => `
                  <div class="order-item" style="border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                      <div>
                        <div style="font-weight: 700; margin-bottom: 4px;">Order #${order.id}</div>
                        <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">
                          📅 ${order.orderDate ? new Date(order.orderDate).toLocaleString('en-IN', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          }) : order.date || 'Date not available'}
                        </div>
                        <div style="color: #fb923c; font-weight: 600;">₹${order.total.toLocaleString()}</div>
                      </div>
                      <span class="status-badge status-${order.status.toLowerCase().replace(/\s+/g, "-")}" style="font-size: 11px; padding: 4px 8px;">${order.status}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <div style="font-weight: 600; margin-bottom: 4px;">${order.customer.name}</div>
                      <div style="color: #94a3b8; font-size: 12px;">${order.customer.email} • ${order.customer.phone}</div>
                      <div style="color: #94a3b8; font-size: 12px;">${order.customer.address}</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <div style="font-weight: 600; margin-bottom: 8px;">Order Items:</div>
                      <div style="background: rgba(30, 41, 59, 0.5); border-radius: 6px; padding: 12px;">
                        ${order.items.map(item => `
                          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                            <span style="color: #e2e8f0;">${item.name} × ${item.quantity}</span>
                            <span style="color: #fb923c; font-weight: 600;">₹${(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        `).join('')}
                        <div style="border-top: 1px solid #334155; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 700;">
                          <span style="color: #e2e8f0;">Total:</span>
                          <span style="color: #fb923c; font-size: 16px;">₹${order.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px; padding: 8px; background: rgba(251, 146, 60, 0.1); border-radius: 6px; border: 1px solid rgba(251, 146, 60, 0.3);">
                      <div style="font-size: 12px; color: #fb923c; font-weight: 600;">Payment Method: ${order.paymentMethod}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; flex: 1;" onclick="app.updateOrderStatus('${order.id}')">Update Status</button>
                      <button class="btn" style="padding: 6px 12px; font-size: 12px; flex: 1; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 6px; cursor: pointer;" onclick="app.deleteOrder('${order.id}')">Delete</button>
                    </div>
                  </div>
                `).join('')
              : `<div style="padding: 24px; text-align: center; color: #94a3b8;">No orders yet</div>`
          }
        </div>
      </div>
    `
  }

  async updateOrderStatus(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const newStatus = prompt(
      "Enter new order status:\n\nProcessing\nShipped\nDelivered\nCancelled",
      order.status
    );

    if (newStatus) {
      const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
      if (validStatuses.includes(newStatus)) {
        order.status = newStatus;
        await this.updateOrderStatus(orderId, newStatus);
        this.renderPage("admin");
      } else {
        alert("Invalid status. Please use one of the suggested statuses.");
      }
    }
  }

  async deleteOrder(orderId) {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        console.log('🚀 Starting delete process for order:', orderId);
        await this.deleteOrderFromStorage(orderId);
        console.log('✅ Delete completed, re-rendering page');
        await this.renderPage("admin");
        alert('✅ Order deleted successfully!');
      } catch (error) {
        console.error('❌ Delete failed with error:', error);
        alert(`❌ Failed to delete order: ${error.message}\n\nPlease check:\n1. Server is running\n2. Internet connection\n3. Browser console (F12) for details`);
      }
    }
  }

  renderAdmin() {
    const searchTerm = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) || product.category.toLowerCase().includes(searchTerm),
    );

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Owner Portal</h1>
            <p style="color: #94a3b8;">Manage your products, repair tracking, and customer orders</p>
          </div>

          <!-- Navigation Buttons -->
          <div style="display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap;">
            <button class="btn btn-primary" data-page="admin-products" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📦</span>
              <span>Products Edit</span>
            </button>
            <button class="btn btn-primary" data-page="admin-tracking" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">🔧</span>
              <span>Tracking Edit</span>
            </button>
            <button class="btn btn-primary" data-page="admin-orders" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📋</span>
              <span>Orders Details</span>
            </button>
          </div>

          <!-- Quick Stats -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #f7f7f7ff; margin-bottom: 4px;">${this.products.length}</div>
              <div style="color: #000205ff; font-size: 14px;">Total Products</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #fffffffd; margin-bottom: 4px;">${this.trackingData.length}</div>
              <div style="color: #000000ff; font-size: 14px;">Active Tracking</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(38, 162, 220, 0.4), rgba(185, 28, 28, 0.2)); border: 2px solid #dcca2691; border-radius: 12px; padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ffffffff; margin-bottom: 4px;">${this.orders.length}</div>
              <div style="color: #000000ff; font-size: 14px;">Customer Orders</div>
            </div>
          </div>

          <!-- Quick Actions Info -->
          <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(185, 28, 28, 0.1)); border: 2px solid #dc262673; border-radius: 16px; padding: 40px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">🎯</div>
            <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 16px; color: #000000;">Welcome to Owner Portal</h2>
            <p style="font-size: 18px; color: #000000ff; margin-bottom: 32px;">Use the buttons above to manage your business</p>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 800px; margin: 0 auto;">
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">📦</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Products</h3>
                <p style="font-size: 14px; color: #64748b;">Manage inventory and pricing</p>
              </div>
              
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">🔧</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Tracking</h3>
                <p style="font-size: 14px; color: #64748b;">Monitor repair status</p>
              </div>
              
              <div style="background: rgba(255, 255, 255, 0.5); border: 2px solid #fecaca; border-radius: 12px; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 12px;">📋</div>
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000000;">Orders</h3>
                <p style="font-size: 14px; color: #64748b;">View WhatsApp orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAddProductForm() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px;">Add New Product</h1>

          <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 32px;">
            <div class="form-field">
              <label class="form-label">Product Name *</label>
              <input type="text" class="input" placeholder="Enter product name" id="productName">
            </div>

            <div class="form-field">
              <label class="form-label">Category *</label>
              <select class="input" id="productCategory" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc;">
                <option value="">Select category</option>
                <option value="Smartphones">Smartphones</option>
                <option value="Services">Services</option>
                <option value="Accessories">Accessories</option>
                <option value="Chargers">Chargers</option>
                <option value="Audio">Audio</option>
                <option value="Power">Power Banks</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label class="form-label">Price (₹) *</label>
                <input type="number" class="input" placeholder="2999" id="productPrice">
              </div>
              <div class="form-field">
                <label class="form-label">Original Price (₹)</label>
                <input type="number" class="input" placeholder="3999" id="productOriginalPrice">
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: rgba(51, 65, 85, 0.3); border-radius: 8px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" style="margin-bottom: 8px;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: rgba(51, 65, 85, 0.3); border-radius: 8px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" style="margin-bottom: 8px;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px;">
              </div>
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" placeholder="📱 or 🔧 or 📦" id="productImage" maxlength="2">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" checked style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #cbd5e1;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="save-product">Add Product</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  renderEditProductForm() {
    const editingIdStr = String(this.editingProductId);
    const product = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr)
    if (!product) return `<div>Product not found</div>`

    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px;">Edit Product</h1>

          <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 32px;">
            <div class="form-field">
              <label class="form-label">Product Name *</label>
              <input type="text" class="input" value="${product.name}" id="productName">
            </div>

            <div class="form-field">
              <label class="form-label">Category *</label>
              <select class="input" id="productCategory" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc;">
                <option value="Smartphones" ${product.category === "Smartphones" ? "selected" : ""}>Smartphones</option>
                <option value="Services" ${product.category === "Services" ? "selected" : ""}>Services</option>
                <option value="Accessories" ${product.category === "Accessories" ? "selected" : ""}>Accessories</option>
                <option value="Chargers" ${product.category === "Chargers" ? "selected" : ""}>Chargers</option>
                <option value="Audio" ${product.category === "Audio" ? "selected" : ""}>Audio</option>
                <option value="Power" ${product.category === "Power" ? "selected" : ""}>Power Banks</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label class="form-label">Price (₹) *</label>
                <input type="number" class="input" value="${product.price}" id="productPrice">
              </div>
              <div class="form-field">
                <label class="form-label">Original Price (₹)</label>
                <input type="number" class="input" value="${product.originalPrice}" id="productOriginalPrice">
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: rgba(51, 65, 85, 0.3); border-radius: 8px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" value="${product.imageUrl || ""}" style="margin-bottom: 8px;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: rgba(51, 65, 85, 0.3); border-radius: 8px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" value="${product.imageUrl2 || ""}" style="margin-bottom: 8px;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px;">
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" value="${product.image}" id="productImage" maxlength="2">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" ${product.inStock ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #cbd5e1;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="save-product">Update Product</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  handleImageUpload(event, imageNumber = 1) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Image = e.target.result
        // Put the image in the correct URL field based on imageNumber
        if (imageNumber === 1) {
          document.getElementById("productImageUrl").value = base64Image
          console.log('Image 1 uploaded and set to URL field 1');
        } else if (imageNumber === 2) {
          document.getElementById("productImageUrl2").value = base64Image
          console.log('Image 2 uploaded and set to URL field 2');
        }
      }
      reader.readAsDataURL(file)
    }
  }

  renderServicesPage(type) {
    const serviceData = {
      hardware: {
        title: "Hardware Repair Services",
        description: "Professional hardware repair services for all mobile devices. We specialize in fixing physical components of your mobile devices with precision and expertise.",
        image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&h=400&fit=crop",
        features: [
          "Screen Replacement",
          "Battery Replacement",
          "Charging Port Repair",
          "Camera Repair",
          "Speaker/Microphone Repair",
          "Button Repair",
          "Water Damage Repair"
        ],
      },
      software: {
        title: "Software Repair Services",
        description: "Comprehensive software solutions for all mobile operating systems. We fix software issues, optimize performance, and ensure your device runs smoothly.",
        image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&h=400&fit=crop",
        features: [
          "OS Installation & Updates",
          "Virus & Malware Removal",
          "Performance Optimization",
          "Data Recovery",
          "App Installation & Configuration",
          "Network Issues Resolution",
          "Factory Reset & Setup"
        ],
      }
    };

    const service = serviceData[type];

    return `
      <div class="services-page-section">
        <div class="container">
          <button class="back-button" data-page="home">← Back to Home</button>
          <div class="section-header">
            <h2>${service.title}</h2>
            <p>Expert ${type} solutions for all your mobile device needs</p>
          </div>
          
          <div class="service-detail-grid">
            <div class="service-detail-image">
              <img src="${service.image}" alt="${service.title}">
            </div>
            <div class="service-detail-content">
              <h3>${service.title}</h3>
              <p>${service.description}</p>
              
              <h4 style="margin-bottom: 16px; color: #dc2626;">Our ${type} Services Include:</h4>
              <ul class="service-features-list">
                ${service.features.map(feature => `<li>${feature}</li>`).join('')}
              </ul>
              
               </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderJoinWithUs() {
    return `
      <div class="join-with-us-section">
        <div class="container">
          <button class="back-button" data-page="home">← Back to Home</button>
          <div class="section-header">
            <h2>Join With Us</h2>
            <p>Connect with us on social media and stay updated with our latest offers and services</p>
          </div>
          
          <div class="join-options-grid">
            <div class="join-option-card">
              <div class="join-option-icon">
                <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram" style="width: 80px; height: 80px; object-fit: contain;">
              </div>
              <h3>Instagram</h3>
              <p>Follow us on Instagram for the latest updates, repair tips, and exclusive offers</p>
              <a href="https://www.instagram.com/manjula_mobile_world?igsh=MW5yOW5rdXk3NWx2dw== " target="_blank" class="btn btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <span>Follow Us</span>
                <span>→</span>
              </a>
            </div>
            
            <div class="join-option-card">
              <div class="join-option-icon">
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style="width: 80px; height: 80px; object-fit: contain;">
              </div>
              <h3>WhatsApp</h3>
              <p>Chat with us directly on WhatsApp for quick queries, service bookings, and support</p>
              <a href="https://wa.me/918248454841" target="_blank" class="btn btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <span>Message Us</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHelpDesk() {
    return `
      <div class="help-desk-section">
        <div class="container">
          <button class="back-button" data-page="home">← Back to Home</button>
          <div class="section-header">
            <h2>Help Desk</h2>
            <p>Get instant support for all your mobile repair queries and service requests</p>
          </div>
          
          <div class="help-desk-content">
            <div class="help-desk-icon">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style="width: 100px; height: 100px; object-fit: contain;">
            </div>
            <h3>24/7 WhatsApp Support</h3>
            <p>Our expert technicians are available round the clock to assist you with any mobile repair issues. Get instant support, service booking, and technical guidance.</p>
            
            <a href="https://wa.me/918248454841" target="_blank" class="whatsapp-button">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style="width: 24px; height: 24px; object-fit: contain; margin-right: 8px;">
              <span>Chat on WhatsApp</span>
            </a>
            
            <div style="margin-top: 32px; padding: 16px; background-color: #fef2f2; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; color: #374151;">
                <strong>Direct WhatsApp Number:</strong> +91 82484 54841<br>
                <strong>Available:</strong> 24/7 for emergency services
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
      <footer>
        <div class="footer-content">
          <div class="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#" data-page="home">Home</a></li>
              <li><a href="#" data-page="products">Products</a></li>
              <li><a href="#" data-page="tracking-page">Track Repair</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Services</h4>
            <ul>
              <li><a href="#" data-page="services-hardware">Hardware Repair</a></li>
              <li><a href="#" data-page="services-software">Software Repair</a></li>
              <li><a href="#" data-page="products">Parts & Accessories</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Contact</h4>
            <ul>
              <li><a href="mailto:manjulamobiles125@gmail.com">manjulamobiles125@gmail.com</a></li>
              <li><a href="tel:+918248454841">+91 82484 54841</a></li>
              <li>Available 24/7</li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Follow Us</h4>
            <ul>
              <li><a href="https://www.instagram.com/manjula_mobile_world?igsh=MW5yOW5rdXk3NWx2dw== " target="_blank">Instagram</a></li>
              <li><a href="https://wa.me/8248454841" target="_blank">WhatsApp</a></li>
              <li><a href="#" data-page="join-with-us">Join With Us</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 Manjula Mobile World. All rights reserved. | Powered by Advanced Mobile Solutions</p>
          <!-- Hidden owner portal link - only visible when you know about it -->
          <p style="font-size: 10px; color: #374151; margin-top: 8px;">
            <a href="owner.html" style="color: #6b7280; text-decoration: none;">Admin</a>
          </p>
        </div>
      </footer>
    `
  }

  renderTrackingPage() {
    return `
      <div class="tracking-page-section">
        <div class="container">
          <button class="back-button" data-page="home">← Back to Home</button>
          <div class="section-header">
            <h2>Track Your Repair</h2>
            <p style="color: #000000;">Real-time status updates for your mobile device repair</p>
          </div>
          ${this.renderTrackingSection()}
        </div>
      </div>
    `
  }

  renderTrackingSection() {
    return `
      <section class="tracking-section">
        <div class="tracking-grid">
          <div class="tracking-form">
            <h3>Enter Tracking Details</h3>
            <div class="form-group">
              <input type="text" class="input" placeholder="Enter QR ID" id="orderId">
            </div>
            <div class="form-group">
              <input type="password" class="input" placeholder="Enter Password" id="orderPassword">
            </div>
            <button class="btn btn-primary" style="width: 100%;" data-action="track-order">🔍 Check Status</button>
            
            <div style="margin-top: 16px; padding: 12px; background-color: rgba(236, 37, 37, 1); border-radius: 8px;">
              <p style="font-size: 12px; color: #030303ff; margin: 0;">
                💡 <strong>Note:</strong> Get your QR ID and Password from the service center when you submit your device for repair.
              </p>
            </div>
          </div>
          <div id="trackResult" style="display: none;">
            <div class="tracking-result">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 12px; height: 12px; background-color: #22d3ee; border-radius: 50%; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
                <span style="color: #22d3ee; font-weight: 600; font-size: 14px;">Repair Status Found</span>
              </div>
              
              <!-- Compact Info Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px;">
                <div>
                  <p style="color: #64748b; font-size: 11px; margin-bottom: 2px;">QR ID</p>
                  <p style="font-size: 14px; font-weight: 600;" id="resultOrderId"></p>
                </div>
                <div>
                  <p style="color: #64748b; font-size: 11px; margin-bottom: 2px;">Customer</p>
                  <p style="font-size: 14px; font-weight: 600;" id="resultCustomer"></p>
                </div>
                <div>
                  <p style="color: #64748b; font-size: 11px; margin-bottom: 2px;">Device</p>
                  <p style="font-size: 14px; font-weight: 600;" id="resultDevice"></p>
                </div>
                <div>
                  <p style="color: #64748b; font-size: 11px; margin-bottom: 2px;">Est. Completion</p>
                  <p style="font-size: 14px; font-weight: 600;" id="resultEstDays"></p>
                </div>
              </div>
              
              <!-- Issue Description -->
              <div style="margin-bottom: 16px; background: #fef3c7; padding: 10px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                <p style="color: #92400e; font-size: 11px; margin-bottom: 2px; font-weight: 600;">Issue Description</p>
                <p style="font-size: 13px; font-weight: 500; line-height: 1.3; color: #78350f;" id="resultIssue"></p>
              </div>
              
              <!-- Timeline Container -->
              <div style="margin-bottom: 16px;">
                <p style="color: #64748b; font-size: 12px; margin-bottom: 12px; font-weight: 600;">Repair Progress</p>
                <div id="trackingTimeline"></div>
              </div>
              
              <!-- Last Updated -->
              <div style="text-align: center; padding: 8px; background: #f1f5f9; border-radius: 6px;">
                <p style="color: #64748b; font-size: 10px; margin-bottom: 2px;">Last Updated</p>
                <p style="font-size: 12px; font-weight: 600; color: #475569;" id="resultLastUpdated"></p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `
  }

  // Separate Admin Pages
  renderAdminProducts() {
    const searchTerm = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    const filteredProducts = this.products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
    );

    return `
      <div style="min-height: 100vh; background-color: #f34b7dfb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 24px;">
            <button class="btn btn-secondary" data-page="admin" style="padding: 10px 20px;">← Back to Dashboard</button>
          </div>
          
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Products Management</h1>
            <p style="color: #94a3b8;">Add, edit, and manage your products</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products..." 
              id="adminSearch"
              oninput="app.renderPage('admin-products')"
              style="max-width: 400px;"
            />
            <button class="btn btn-primary" data-action="add-product-form">+ Add New Product</button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${filteredProducts.map(product => `
              <div style="background: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 12px; padding: 20px;">
                <div style="font-size: 48px; text-align: center; margin-bottom: 16px;">${product.image}</div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${product.name}</h3>
                <div style="color: #94a3b8; font-size: 14px; margin-bottom: 8px;">${product.category}</div>
                <div style="color: #fb923c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">₹${product.price.toLocaleString()}</div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary" style="flex: 1; padding: 8px;" data-action="edit-product" data-product-id="${product.id}">Edit</button>
                  <button class="btn" style="flex: 1; padding: 8px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171;" data-action="delete-product" data-product-id="${product.id}">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderAdminTracking() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 24px;">
            <button class="btn btn-secondary" data-page="admin" style="padding: 10px 20px;">← Back to Dashboard</button>
          </div>
          
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Tracking Management</h1>
            <p style="color: #94a3b8;">Manage repair tracking and update status</p>
          </div>

          <div style="margin-bottom: 24px;">
            <button class="btn btn-primary" data-action="toggle-tracking-form" style="padding: 12px 24px; font-size: 16px;">+ Add New Tracking</button>
          </div>

          <!-- Enhanced Tracking Form -->
          <div id="trackingForm" style="background-color: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 12px; padding: 32px; margin-bottom: 32px; display: none;">
            <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #22d3ee;">Create New Repair Tracking</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div class="form-field">
                <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">QR ID *</label>
                <input type="text" class="input" placeholder="e.g., QR123456" id="newTrackingQRId" style="font-size: 14px; padding: 12px;">
              </div>

              <div class="form-field">
                <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Password *</label>
                <input type="text" class="input" placeholder="e.g., pass123" id="newTrackingPassword" style="font-size: 14px; padding: 12px;">
              </div>
            </div>

            <div class="form-field" style="margin-bottom: 16px;">
              <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Customer Name *</label>
              <input type="text" class="input" placeholder="Enter customer name" id="newTrackingCustomer" style="font-size: 14px; padding: 12px;">
            </div>

            <div class="form-field" style="margin-bottom: 16px;">
              <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Device Model *</label>
              <input type="text" class="input" placeholder="e.g., iPhone 15 Pro, Samsung S23" id="newTrackingDevice" style="font-size: 14px; padding: 12px;">
            </div>

            <div class="form-field" style="margin-bottom: 16px;">
              <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Contact Number</label>
              <input type="tel" class="input" placeholder="e.g., +91 9876543210" id="newTrackingContact" style="font-size: 14px; padding: 12px;">
            </div>

            <div class="form-field" style="margin-bottom: 16px;">
              <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Issue Description *</label>
              <textarea class="input" placeholder="Describe the device issue in detail..." id="newTrackingIssue" style="font-size: 14px; padding: 12px; min-height: 100px; resize: vertical;"></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
              <div class="form-field">
                <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Tracking Status</label>
                <select class="input" id="newTrackingStatus" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc; font-size: 14px; padding: 12px;">
                  <option value="Received">📥 Device Received</option>
                  <option value="Diagnostics">🔍 Under Diagnostics</option>
                  <option value="In Progress">🔧 Repair In Progress</option>
                  <option value="Parts Ordered">📦 Parts Ordered</option>
                  <option value="Quality Check">✅ Quality Check</option>
                  <option value="Ready for Pickup">📢 Ready for Pickup</option>
                  <option value="Completed">🎉 Completed</option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label" style="margin-bottom: 6px; font-weight: 600; display: block;">Estimated Days</label>
                <input type="number" class="input" placeholder="2" id="newTrackingDays" value="2" min="1" max="30" style="font-size: 14px; padding: 12px;">
              </div>
            </div>

            <div style="display: flex; gap: 12px;">
              <button class="btn btn-primary" style="flex: 1; padding: 14px; font-size: 16px; font-weight: 600;" data-action="save-new-tracking">
                💾 Save Tracking
              </button>
              <button class="btn btn-secondary" style="flex: 1; padding: 14px; font-size: 16px;" data-action="toggle-tracking-form">
                ❌ Cancel
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
            ${this.trackingData.length > 0 ? this.trackingData.map(tracking => `
              <div style="background: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                  <div>
                    <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">QR: ${tracking.qrId}</div>
                    <div style="color: #94a3b8; font-size: 12px;">${tracking.createdAt}</div>
                  </div>
                  <span class="status-badge" style="background: rgba(255, 0, 0, 0.48); color: #fd2f2f9a; padding: 4px 8px; border-radius: 12px; font-size: 11px;">${tracking.status}</span>
                </div>
                <div style="margin-bottom: 12px;">
                  <div style="font-weight: 600; margin-bottom: 4px;">${tracking.customerName}</div>
                  <div style="color: #94a3b8; font-size: 13px;">${tracking.productName}</div>
                  <div style="color: #94a3b8; font-size: 12px;">${tracking.contact || 'No contact'}</div>
                </div>
                <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 12px;">${tracking.issue || 'Mobile Repair Service'}</div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary" style="flex: 1; padding: 8px; font-size: 12px;" onclick="app.editTracking('${tracking.qrId}')">Edit Status</button>
                  <button class="btn" style="flex: 1; padding: 8px; font-size: 12px; background: rgba(224, 17, 52, 0.68); color: #f87171; border: 1px solid #f87171;" onclick="app.deleteTracking('${tracking.qrId}')">Delete</button>
                </div>
              </div>
            `).join('') : `
              <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(30, 41, 59, 0.3); border: 2px dashed #334155; border-radius: 12px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #94a3b8;">No Tracking Records</h3>
                <p style="color: #64748b; margin-bottom: 20px;">Click "Add New Tracking" to create your first repair tracking record</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  renderAdminOrders(){
    return `
      <div style="min-height: 100vh; background-color: #e60045a6; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 24px;">
            <button class="btn btn-secondary" data-page="admin" style="padding: 10px 20px;">← Back to Dashboard</button>
          </div>
          
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Orders Management</h1>
            <p style="color: #000000ff;">View and manage customer orders</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px;">
            ${this.orders.length > 0 ? this.orders.map(order => `
              <div style="background: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 12px; padding: 20px;">
                <div style="margin-bottom: 16px;">
                  <div style="font-weight: 700; font-size: 18px; margin-bottom: 4px;">Order #${order.id}</div>
                  <div style="color: #94a3b8; font-size: 12px;">
                    📅 ${order.orderDate ? new Date(order.orderDate).toLocaleString('en-IN', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    }) : order.date || 'Date not available'}
                  </div>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <div style="font-weight: 600; margin-bottom: 8px; color: #fb923c;">Customer Details:</div>
                  <div style="color: #e2e8f0; font-size: 14px; margin-bottom: 4px;">👤 ${order.customer.name}</div>
                  <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">📧 ${order.customer.email}</div>
                  <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">📞 ${order.customer.phone}</div>
                  <div style="color: #94a3b8; font-size: 13px;">📍 ${order.customer.address}</div>
                </div>

                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <div style="font-weight: 600; margin-bottom: 8px; color: #fb923c;">Order Items:</div>
                  ${order.items.map(item => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                      <span style="color: #e2e8f0;">${item.name} × ${item.quantity}</span>
                      <span style="color: #fb923c; font-weight: 600;">₹${(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  `).join('')}
                  <div style="border-top: 1px solid #334155; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 700;">
                    <span style="color: #e2e8f0;">Total:</span>
                    <span style="color: #fb923c; font-size: 18px;">₹${order.total.toLocaleString()}</span>
                  </div>
                </div>

                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 13px;" onclick="app.printOrderSummary('${order.id}')">🖨️ Print Summary</button>
                  <button class="btn" style="padding: 10px 16px; font-size: 13px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171;" onclick="app.deleteOrder('${order.id}')">🗑️</button>
                </div>
              </div>
            `).join('') : `
              <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <div style="font-size: 18px;">No orders yet</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Print order summary
  printOrderSummary(orderId) {
    const order = this.orders.find(o => o.id == orderId)
    if (!order) {
      alert('Order not found')
      return
    }

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order #${order.id} - Manjula Mobiles</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #dc2626;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #dc2626;
            margin: 0 0 10px 0;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            background: #dc2626;
            color: white;
            padding: 10px 15px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
            color: #333;
          }
          .info-value {
            flex: 1;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th {
            background: #f5f5f5;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #dc2626;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
          }
          .total-row {
            font-weight: bold;
            font-size: 18px;
            background: #fef2f2;
          }
          .total-row td {
            padding: 15px 12px;
            border-top: 2px solid #dc2626;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 2px solid #eee;
            padding-top: 20px;
          }
          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📱 MANJULA MOBIL WORLD</h1>
          <p>The Final World of Mobile Services</p>
          <p>📍 Ramapuram, Tamil Nadu | 📞 +91 82484 54841</p>
          <p>✉️ manjulamobiles125@gmail.com</p>
        </div>

        <div class="section">
          <div class="section-title">ORDER DETAILS</div>
          <div class="info-row">
            <div class="info-label">Order ID:</div>
            <div class="info-value">#${order.id}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Order Date:</div>
            <div class="info-value">${order.date}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">CUSTOMER INFORMATION</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${order.customer.name}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${order.customer.email}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${order.customer.phone}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${order.customer.address}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">ORDER ITEMS</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">₹${item.price.toLocaleString()}</td>
                  <td style="text-align: right;">₹${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">TOTAL:</td>
                <td style="text-align: right; color: #dc2626;">₹${order.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>For any queries, please contact us at +91 82484 54841</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Delete order
  async deleteOrder(orderId) {
    if (confirm('Are you sure you want to delete this order?')) {
      try {
        console.log('🚀 Starting delete process for order:', orderId);
        await this.deleteOrderFromStorage(orderId);
        console.log('✅ Delete completed, re-rendering page');
        await this.renderPage('admin-orders');
        alert('✅ Order deleted successfully!');
      } catch (error) {
        console.error('❌ Delete failed with error:', error);
        alert(`❌ Failed to delete order: ${error.message}\n\nPlease check:\n1. Server is running\n2. Internet connection\n3. Browser console (F12) for details`);
      }
    }
  }
}

// Initialize EmailJS when available
function initEmailJS() {
  if (typeof emailjs !== 'undefined') {
    try {
      emailjs.init('ghzqy_6v1m5f1cxra');
      console.log('✅ EmailJS initialized');
    } catch (error) {
      console.error('❌ EmailJS initialization error:', error);
    }
  } else {
    console.log('⚠️ EmailJS not loaded yet, will retry...');
    setTimeout(initEmailJS, 1000); // Retry after 1 second
  }
}

// Try to initialize EmailJS
initEmailJS();

// Initialize app with error handling - wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  try {
    console.log('🚀 Initializing Manjula Mobile World App...');
    const app = new ManjulaMobilesApp();
    window.app = app; // Make app globally accessible for debugging
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization error:', error);
    document.getElementById('app').innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626; margin-bottom: 20px;">⚠️ Error Loading Application</h1>
        <p style="color: #666; margin-bottom: 20px;">There was an error initializing the application.</p>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 600px; text-align: left;">
          <strong>Error Details:</strong>
          <pre style="margin-top: 10px; color: #dc2626; overflow-x: auto;">${error.message}\n\n${error.stack}</pre>
        </div>
        <p style="color: #666; margin-top: 20px;">
          <strong>Possible Solutions:</strong><br>
          1. Make sure the server is running (node server/server.js)<br>
          2. Open this page using a local server (not file://)<br>
          3. Check the browser console for more details (F12)
        </p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Retry
        </button>
      </div>
    `;
  }
}
