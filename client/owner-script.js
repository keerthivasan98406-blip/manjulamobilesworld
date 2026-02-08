// Owner Portal - Manjula Mobile World
class OwnerPortalApp {
  constructor() {
    this.currentPage = "admin-login"
    this.isAdminLoggedIn = localStorage.getItem('manjula_admin_logged_in') === 'true'
    this.editingProductId = null
    this.adminSearch = ""
    
    // Log admin login state on app start
    if (this.isAdminLoggedIn) {
      console.log('✅ Admin login state restored from localStorage')
      this.currentPage = "admin"
    }
    
    // MongoDB API URL - Auto-detect local vs production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseURL = isLocalhost ? 'http://localhost:3001' : window.location.origin;
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
    
    this.products = [];
    this.trackingData = [];
    this.orders = [];
    
    this.init()
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
      this.loadOrdersFromStorage();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('product-added', (product) => {
      console.log('📦 [OWNER PORTAL] New product added via socket:', product);
      const exists = this.products.find(p => 
        String(p.id) === String(product.id) || 
        String(p._id) === String(product._id) ||
        String(p.id) === String(product._id) ||
        String(p._id) === String(product.id)
      );
      if (!exists) {
        this.products.push(product);
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        console.log('✅ [OWNER PORTAL] Product added to local array, total products:', this.products.length);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
          console.log('🔄 [OWNER PORTAL] Re-rendering admin page');
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('product-updated', (product) => {
      console.log('🔄 Product updated:', product);
      const index = this.products.findIndex(p => p.id === product.id || p._id === product._id);
      if (index !== -1) {
        this.products[index] = product;
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('product-deleted', (data) => {
      console.log('🗑️ Product deleted:', data.id);
      this.products = this.products.filter(p => p.id !== data.id && p._id !== data.id);
      localStorage.setItem('manjula_products', JSON.stringify(this.products));
      if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('tracking-added', (tracking) => {
      console.log('📍 New tracking added:', tracking);
      const exists = this.trackingData.find(t => t.qrId === tracking.qrId);
      if (!exists) {
        this.trackingData.push(tracking);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-updated', (tracking) => {
      console.log('🔄 Tracking updated:', tracking);
      const index = this.trackingData.findIndex(t => t.qrId === tracking.qrId);
      if (index !== -1) {
        this.trackingData[index] = tracking;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-deleted', (data) => {
      console.log('🗑️ Tracking deleted:', data.qrId);
      this.trackingData = this.trackingData.filter(t => t.qrId !== data.qrId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('order-added', (order) => {
      console.log('🛒 New order received:', order);
      const exists = this.orders.find(o => o.orderId === order.orderId);
      if (!exists) {
        this.orders.push(order);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-updated', (order) => {
      console.log('🔄 Order updated:', order);
      const index = this.orders.findIndex(o => o.orderId === order.orderId);
      if (index !== -1) {
        this.orders[index] = order;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-deleted', (data) => {
      console.log('🗑️ Order deleted:', data.orderId);
      this.orders = this.orders.filter(o => o.orderId !== data.orderId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
        this.renderPage(this.currentPage);
      }
    });
  }

  async init() {
    try {
      console.log('🚀 Initializing Manjula Mobile World App...');
      
      // Setup event listeners first
      this.setupEventListeners();
      
      // Render login page immediately (don't wait for server)
      await this.renderPage(this.currentPage);
      
      // Load data in background without blocking UI
      this.loadDataInBackground();
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.showErrorMessage('Failed to load application. Please refresh the page.');
    }
  }

  async loadDataInBackground() {
    try {
      console.log('📡 Loading data in background...');
      
      // Try to load data, but don't block the UI
      await Promise.all([
        this.loadProductsFromStorage().catch(err => {
          console.log('⚠️ Products load failed:', err.message);
          this.products = [];
        }),
        this.loadTrackingFromStorage().catch(err => {
          console.log('⚠️ Tracking load failed:', err.message);
          this.trackingData = [];
        }),
        this.loadOrdersFromStorage().catch(err => {
          console.log('⚠️ Orders load failed:', err.message);
          this.orders = [];
        })
      ]);
      
      console.log('✅ Background data load complete');
      
      // Refresh the page if user is logged in to show loaded data
      if (this.isAdminLoggedIn && this.currentPage !== 'admin-login') {
        await this.renderPage(this.currentPage);
      }
    } catch (error) {
      console.error('❌ Background data load error:', error);
    }
  }

  async checkServerStatus() {
    try {
      const response = await fetch(`${this.API_URL}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ Server is awake:', health.uptime, 'seconds uptime');
      }
    } catch (error) {
      console.log('⏰ Server might be waking up from sleep, but continuing...');
      // Don't block the UI - just log the issue
    }
  }

  showWakeUpMessage() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
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
            </div>
            
            <div class="loading-text">
              <h2>Waking Up Server</h2>
              <p class="loading-subtitle">Please wait while we start the server...</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">This may take 30-60 seconds on first visit</p>
              <p class="loading-time">Thank you for your patience! 🙏</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  async loadDataWithRetry() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([
          this.loadProductsFromStorage(),
          this.loadTrackingFromStorage(),
          this.loadOrdersFromStorage()
        ]);
        return; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Load attempt ${retryCount} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying in ${retryCount * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
        } else {
          console.error('❌ All retry attempts failed');
          throw error;
        }
      }
    }
  }

  showLoadingScreen() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
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
            </div>
            
            <div class="loading-text">
              <h2>Owner Portal</h2>
              <p class="loading-subtitle">Manjula Mobile World Management</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">Loading admin data...</p>
            </div>
          </div>
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
    
    // Event delegation for all click events
    app.addEventListener("click", async (e) => {
      // Navigation and page routing
      const pageElement = e.target.closest('[data-page]');
      if (pageElement && pageElement.dataset.page) {
        e.preventDefault()
        console.log('📄 Navigating to page:', pageElement.dataset.page);
        await this.renderPage(pageElement.dataset.page)
      }
      
      // Admin actions
      const actionElement = e.target.closest('[data-action]');
      if (actionElement && actionElement.dataset.action === "admin-login") {
        this.handleAdminLogin()
      }
      if (actionElement && actionElement.dataset.action === "admin-logout") {
        this.handleAdminLogout()
      }
      if (actionElement && actionElement.dataset.action === "add-product-form") {
        this.renderPage("admin-add-product")
      }
      if (actionElement && actionElement.dataset.action === "edit-product") {
        const productId = actionElement.dataset.productId
        this.editingProductId = productId
        this.renderPage("admin-edit-product")
      }
      if (actionElement && actionElement.dataset.action === "delete-product") {
        const productId = actionElement.dataset.productId
        this.deleteProduct(productId)
      }
      if (actionElement && actionElement.dataset.action === "save-product") {
        this.saveProduct()
      }
      
      // Tracking actions
      if (actionElement && actionElement.dataset.action === "save-new-tracking") {
        this.saveNewTracking()
      }
      if (actionElement && actionElement.dataset.action === "toggle-tracking-form") {
        this.toggleTrackingForm()
      }
    })

    // Handle Enter key in search inputs
    app.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (e.target.id === 'adminSearch') {
          this.renderPage('admin')
        }
      }
    })
  }

  async handleAdminLogin() {
    const phone = document.getElementById("adminPhone")?.value || ""
    const password = document.getElementById("adminPassword")?.value || ""

    if (phone === "9840694616" && password === "admin123") {
      this.isAdminLoggedIn = true
      localStorage.setItem('manjula_admin_logged_in', 'true')
      console.log('✅ Admin logged in - state saved to localStorage')
      await this.renderPage("admin")
    } else {
      alert("Invalid credentials. Please check your phone number and password.")
    }
  }

  async handleAdminLogout() {
    this.isAdminLoggedIn = false
    localStorage.removeItem('manjula_admin_logged_in')
    console.log('✅ Admin logged out - state removed from localStorage')
    await this.renderPage("admin-login")
  }

  // Product Management Methods - Database ONLY
  async loadProductsFromStorage() {
    try {
      console.log('📡 [OWNER PORTAL] Loading products from database...');
      
      const response = await fetch(`${this.API_URL}/products`);
      if (response.ok) {
        this.products = await response.json();
        console.log('✅ [OWNER PORTAL] Loaded products from database:', this.products.length);
      } else {
        console.log('⚠️ [OWNER PORTAL] Failed to load from database');
        this.products = [];
      }
    } catch (error) {
      console.error('❌ [OWNER PORTAL] Error loading products:', error);
      this.products = [];
    }
  }

  // Tracking Management Methods
  async loadTrackingFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/tracking`);
      if (response.ok) {
        this.trackingData = await response.json();
        console.log('✅ Loaded tracking from database:', this.trackingData.length);
      } else {
        this.trackingData = [];
      }
    } catch (error) {
      console.error('❌ Error loading tracking:', error);
      this.trackingData = [];
    }
  }

  // Orders Management Methods
  async loadOrdersFromStorage() {
    try {
      console.log('📡 [OWNER] Loading orders from database...');
      const response = await fetch(`${this.API_URL}/orders`);
      if (response.ok) {
        this.orders = await response.json();
        console.log('✅ [OWNER] Loaded orders from database:', this.orders.length);
        
        // Debug screenshot data in orders
        this.orders.forEach((order, index) => {
          console.log(`📋 [OWNER] Order ${index + 1}:`, {
            orderId: order.orderId,
            hasScreenshot: !!order.paymentScreenshot,
            screenshotDataLength: order.paymentScreenshot?.data?.length,
            paymentMethod: order.paymentMethod
          });
        });
      } else {
        console.log('⚠️ [OWNER] Failed to load orders from database');
        this.orders = [];
      }
    } catch (error) {
      console.error('❌ [OWNER] Error loading orders:', error);
      this.orders = [];
    }
  }

  async renderPage(page) {
    const app = document.getElementById("app")
    this.currentPage = page

    if (page.startsWith("admin") && !this.isAdminLoggedIn) {
      page = "admin-login"
    }

    let html = this.renderNavigation()

    if (page === "admin-login") {
      html += this.renderAdminLogin()
    } else if (page === "admin") {
      html += this.renderAdmin()
    } else if (page === "admin-products") {
      html += this.renderAdminProducts()
    } else if (page === "admin-tracking") {
      html += this.renderAdminTracking()
    } else if (page === "admin-orders") {
      html += this.renderAdminOrders()
    } else if (page === "admin-add-product") {
      html += this.renderAddProductForm()
    } else if (page === "admin-edit-product") {
      html += this.renderEditProductForm()
    }

    html += this.renderFooter()

    app.innerHTML = html
  }

  renderNavigation() {
    return `
      <nav>
        <div class="nav-content">
          <div class="nav-brand" style="cursor: pointer; display: flex; align-items: center; gap: 12px;">
            <div class="nav-logo">
              <img src="https://i.pinimg.com/736x/e3/6f/79/e36f793e016dd6b35cd27f84030b7487.jpg" alt="Manjula Mobile World Logo" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px;">
            </div>
            <div class="nav-title" data-page="admin">
              <div style="font-size: 16px; font-weight: 700; white-space: nowrap;">OWNER PORTAL</div>
              <div style="font-size: 10px; font-weight: 500; margin-top: 1px;">Manjula Mobile World Management</div>
            </div>
          </div>
          
          <ul class="nav nav-pills">
            ${this.isAdminLoggedIn ? `
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin' ? 'active' : ''}" data-page="admin">Dashboard</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-products' ? 'active' : ''}" data-page="admin-products">Products</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-tracking' ? 'active' : ''}" data-page="admin-tracking">Tracking</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${this.currentPage === 'admin-orders' ? 'active' : ''}" data-page="admin-orders">Orders</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="index.html">← Main Site</a>
              </li>
              <li class="nav-item">
                <a class="nav-link admin-pill" data-action="admin-logout">Logout</a>
              </li>
            ` : `
              <li class="nav-item">
                <a class="nav-link" href="index.html">← Back to Main Site</a>
              </li>
            `}
          </ul>
        </div>
      </nav>
    `
  }

  renderAdminLogin() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; display: flex; align-items: center; justify-content: center;">
        <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 48px; max-width: 400px; width: 100%; margin: 0 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">Owner Portal</h1>
            <p style="color: #94a3b8;">Enter your credentials to access the management panel</p>
          </div>
          
          <div class="form-field">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="input" placeholder="Enter phone number" id="adminPhone">
          </div>
          
          <div class="form-field">
            <label class="form-label">Password</label>
            <input type="password" class="input" placeholder="Enter password" id="adminPassword">
          </div>
          
          <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;" data-action="admin-login">Login</button>
          
          <div style="margin-top: 24px; text-align: center;">
            <a href="index.html" style="color: #94a3b8; text-decoration: none; font-size: 14px;">← Back to Main Site</a>
          </div>
        </div>
      </div>
    `
  }
 
 renderAdmin() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">Owner Dashboard</h1>
            <p style="color: #94a3b8;">Manage your products, repair tracking, and customer orders</p>
          </div>

          <!-- Navigation Buttons -->
          <div style="display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap;">
            <button class="btn btn-primary" data-page="admin-products" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📦</span>
              <span>Products Management</span>
            </button>
            <button class="btn btn-primary" data-page="admin-tracking" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">🔧</span>
              <span>Tracking Management</span>
            </button>
            <button class="btn btn-primary" data-page="admin-orders" style="flex: 1; min-width: 200px; padding: 16px; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 24px;">📋</span>
              <span>Orders Management</span>
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

          <!-- Welcome Section -->
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
                <p style="font-size: 14px; color: #64748b;">View customer orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAdminProducts() {
    const searchTerm = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) || product.category.toLowerCase().includes(searchTerm),
    );

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Products Management</h1>
              <p style="color: #94a3b8;">Manage your product inventory</p>
            </div>
            <button class="btn btn-primary" data-action="add-product-form" style="padding: 12px 24px; font-size: 16px;">+ Add Product</button>
          </div>

          <div style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products..." 
              id="adminSearch"
              style="flex: 1;"
              oninput="app.renderPage('admin-products')"
            >
            <span style="color: #94a3b8; font-size: 14px;">Total: ${filteredProducts.length} products</span>
          </div>

          <div class="admin-products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${
              filteredProducts.length > 0
                ? filteredProducts.map((product) => this.renderAdminProductCard(product)).join("")
                : '<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8;">No products found</div>'
            }
          </div>
        </div>
      </div>
    `
  }

  renderAdminProductCard(product) {
    const productId = product.id || product._id || 'unknown';
    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    
    return `
      <div class="admin-product-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; max-width: 300px;">
        <div class="admin-product-image" style="width: 100%; height: 120px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; background: rgba(51, 65, 85, 0.3); border-radius: 6px;">
          ${product.imageUrl ? 
            `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` :
            `<span style="font-size: 32px;">${product.image || '📦'}</span>`
          }
        </div>
        <div class="admin-product-info">
          <h3 style="margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #f8fafc;">${product.name}</h3>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${product.category}</div>
          <div style="margin-bottom: 8px;">
            <span style="font-weight: 700; color: #10b981; font-size: 14px;">₹${product.price.toLocaleString()}</span>
            <span style="color: #94a3b8; text-decoration: line-through; margin-left: 6px; font-size: 12px;">₹${product.originalPrice.toLocaleString()}</span>
            <span style="color: #f59e0b; font-size: 10px; margin-left: 6px;">${discountPercent}% off</span>
          </div>
          <div style="margin-bottom: 10px;">
            <span class="stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; ${product.inStock ? 'background: rgba(16, 185, 129, 0.2); color: #10b981;' : 'background: rgba(239, 68, 68, 0.2); color: #ef4444;'}">${product.inStock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 11px;" data-action="edit-product" data-product-id="${productId}">Edit</button>
            <button class="btn" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" data-action="delete-product" data-product-id="${productId}">Delete</button>
          </div>
        </div>
      </div>
    `
  }

  renderAdminTracking() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Tracking Management</h1>
              <p style="color: #94a3b8;">Manage repair tracking records</p>
            </div>
            <button class="btn btn-primary" data-action="toggle-tracking-form" style="padding: 12px 24px; font-size: 16px;">+ Add Tracking</button>
          </div>

          ${this.renderTrackingForm()}
          ${this.renderTrackingList()}
        </div>
      </div>
    `
  }

  renderTrackingForm() {
    return `
      <div id="trackingForm" style="display: none; background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <h3 style="margin-bottom: 24px;">Add New Tracking Record</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">QR ID *</label>
            <input type="text" class="input" placeholder="Enter unique QR ID" id="newTrackingQRId">
          </div>
          <div class="form-field">
            <label class="form-label">Password *</label>
            <input type="text" class="input" placeholder="Enter password" id="newTrackingPassword">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Customer Name *</label>
            <input type="text" class="input" placeholder="Enter customer name" id="newTrackingCustomer">
          </div>
          <div class="form-field">
            <label class="form-label">Device Model *</label>
            <input type="text" class="input" placeholder="Enter device model" id="newTrackingDevice">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Contact Number</label>
            <input type="tel" class="input" placeholder="Enter contact number" id="newTrackingContact">
          </div>
          <div class="form-field">
            <label class="form-label">Estimated Days</label>
            <input type="number" class="input" placeholder="2" value="2" id="newTrackingDays">
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 16px;">
          <label class="form-label">Issue Description *</label>
          <textarea class="input" placeholder="Describe the issue..." id="newTrackingIssue" rows="3"></textarea>
        </div>

        <div class="form-field" style="margin-bottom: 24px;">
          <label class="form-label">Initial Status</label>
          <select class="input" id="newTrackingStatus" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc;">
            <option value="Received">📥 Received</option>
            <option value="Diagnostics">🔍 Diagnostics</option>
            <option value="In Progress">🔧 In Progress</option>
            <option value="Parts Ordered">📦 Parts Ordered</option>
            <option value="Quality Check">✅ Quality Check</option>
            <option value="Ready for Pickup">📢 Ready for Pickup</option>
            <option value="Completed">🎉 Completed</option>
          </select>
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="btn btn-primary" data-action="save-new-tracking" style="flex: 1;">Save Tracking</button>
          <button class="btn btn-secondary" data-action="toggle-tracking-form" style="flex: 1;">Cancel</button>
        </div>
      </div>
    `
  }

  renderTrackingList() {
    return `
      <div class="tracking-list">
        <h3 style="margin-bottom: 24px;">Active Tracking Records (${this.trackingData.length})</h3>
        ${
          this.trackingData.length > 0
            ? this.trackingData.map(tracking => this.renderTrackingCard(tracking)).join('')
            : '<div style="text-align: center; padding: 48px; color: #94a3b8;">No tracking records found</div>'
        }
      </div>
    `
  }

  renderTrackingCard(tracking) {
    return `
      <div class="tracking-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px; max-width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <h4 style="margin-bottom: 4px; font-size: 14px; font-weight: 600;">QR: ${tracking.qrId}</h4>
            <div style="color: #94a3b8; font-size: 11px;">Created: ${tracking.createdAt}</div>
          </div>
          <span class="status-badge status-${tracking.status.toLowerCase().replace(/\s+/g, "-")}" style="font-size: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #10b981;">${this.getStatusEmoji(tracking.status)} ${tracking.status}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px;">Customer</div>
            <div style="color: #cbd5e1; font-size: 12px;">${tracking.customerName}</div>
          </div>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px;">Device</div>
            <div style="color: #cbd5e1; font-size: 12px;">${tracking.productName}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px;">Issue</div>
          <div style="color: #cbd5e1; font-size: 11px; line-height: 1.4;">${tracking.issue}</div>
        </div>

        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary" style="flex: 1; padding: 6px 10px; font-size: 11px;" onclick="app.editTracking('${tracking.qrId}')">Update Status</button>
          <button class="btn" style="flex: 1; padding: 6px 10px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" onclick="app.deleteTracking('${tracking.qrId}')">Delete</button>
        </div>
      </div>
    `
  }

  renderAdminOrders() {
    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <div style="margin-bottom: 32px;">
            <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Orders Management</h1>
            <p style="color: #94a3b8;">View and manage customer orders</p>
          </div>

          <div style="margin-bottom: 24px;">
            <span style="color: #94a3b8; font-size: 14px;">Total Orders: ${this.orders.length}</span>
          </div>

          <div class="orders-list">
            ${
              this.orders.length > 0
                ? this.orders.map(order => this.renderOrderCard(order)).join('')
                : '<div style="text-align: center; padding: 48px; color: #94a3b8;">No orders found</div>'
            }
          </div>
        </div>
      </div>
    `
  }

  renderOrderCard(order) {
    // Fix order date formatting
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        console.error('Date formatting error:', e);
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        console.error('Date formatting error:', e);
        formattedDate = order.createdAt.toString();
      }
    }

    return `
      <div class="order-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px; max-width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <h4 style="margin-bottom: 4px; font-size: 14px; font-weight: 600;">Order #${order.id || order.orderId}</h4>
            <div style="color: #94a3b8; font-size: 11px;">
              📅 ${formattedDate}
            </div>
          </div>
          <span class="status-badge status-${order.status.toLowerCase().replace(/\s+/g, "-")}" style="font-size: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #10b981;">${order.status}</span>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">Customer Details</div>
          <div style="color: #cbd5e1; font-size: 11px; line-height: 1.4;">
            <div>${order.customer.name}</div>
            <div>${order.customer.email} • ${order.customer.phone}</div>
            <div>${order.customer.address}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">Order Items</div>
          <div style="background: rgba(51, 65, 85, 0.3); border-radius: 4px; padding: 8px;">
            ${order.items.map(item => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px;">
                <span style="color: #e2e8f0;">${item.name} × ${item.quantity}</span>
                <span style="color: #10b981; font-weight: 600;">₹${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            `).join('')}
            <div style="border-top: 1px solid #334155; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-weight: 700;">
              <span style="color: #e2e8f0; font-size: 12px;">Total:</span>
              <span style="color: #10b981; font-size: 14px;">₹${order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 12px; padding: 6px; background: rgba(16, 185, 129, 0.1); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
          <div style="font-size: 11px; color: #10b981; font-weight: 600;">Payment: ${order.paymentMethod}</div>
          ${order.paymentScreenshot && order.paymentScreenshot.data ? `
            <div style="margin-top: 8px;">
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">Payment Screenshot:</div>
              <img src="${order.paymentScreenshot.data || order.paymentScreenshot.imageUrl}" alt="Payment Screenshot" 
                   style="max-width: 150px; max-height: 100px; border-radius: 4px; border: 1px solid #334155; cursor: pointer; display: block;"
                   data-screenshot-id="${order.orderId || order.id}"
                   onclick="app.showScreenshotFromOrder('${order.orderId || order.id}')"
                   onerror="this.style.display='none'; this.nextElementSibling.innerHTML='❌ Image failed to load'; console.error('Failed to load screenshot for order:', '${order.orderId || order.id}')">
              <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                📎 ${order.paymentScreenshot.fileName} • ${new Date(order.paymentScreenshot.uploadTime).toLocaleString('en-IN', { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
                ${order.paymentScreenshot.data ? '<span style="color: #10b981;">• 📄 Image Data</span>' : '<span style="color: #f59e0b;">• ⚠️ No Image</span>'}
              </div>
            </div>
          ` : order.paymentMethod.includes('Screenshot') ? `
            <div style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">
              <div style="font-size: 10px; color: #dc2626; font-weight: 600;">⚠️ Screenshot data missing</div>
              <div style="font-size: 9px; color: #dc2626;">Payment screenshot was uploaded but data is not available</div>
            </div>
          ` : ''}
        </div>

        <div style="display: flex; gap: 6px;">
          <button class="btn btn-primary" style="flex: 1; padding: 6px 10px; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="app.printOrder('${order.id || order.orderId}')">
            🖨️ Print Order
          </button>
          <button class="btn" style="flex: 1; padding: 6px 10px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" onclick="app.deleteOrder('${order.id || order.orderId}')">Delete</button>
        </div>
      </div>
    `
  }

  showScreenshotFromOrder(orderId) {
    // Find the order by ID
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    
    if (!order || !order.paymentScreenshot || !order.paymentScreenshot.data) {
      alert('Screenshot not found for this order.');
      return;
    }
    
    // Use base64 data directly (same as product images)
    const imageSrc = order.paymentScreenshot.data || order.paymentScreenshot.imageUrl;
    
    // Show the screenshot modal
    this.showScreenshotModal(imageSrc, order.paymentScreenshot.fileName);
  }

  showScreenshotModal(imageSrc, fileName) {
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
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 100%; text-align: center;">
        <h3 style="margin-bottom: 16px; color: #000;">Payment Screenshot</h3>
        <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 16px; border: 2px solid #fecaca;">
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">File: ${fileName}</p>
        <button id="closeModal" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle close button
    document.getElementById('closeModal').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  // Print Order functionality
  printOrder(orderId) {
    // Find the order by ID
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    
    if (!order) {
      alert('Order not found!');
      return;
    }

    // Format order date
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.createdAt.toString();
      }
    }

    // Create printable content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order #${order.orderId || order.id} - Manjula Mobile World</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #000; 
            background: white;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #dc2626; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 5px; 
          }
          .subtitle { 
            color: #666; 
            font-size: 14px; 
          }
          .order-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
          }
          .order-details, .customer-details { 
            width: 48%; 
          }
          .section-title { 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 10px; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 5px; 
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
          }
          .items-table th, .items-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          .items-table th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
          }
          .total-row { 
            font-weight: bold; 
            background-color: #f8f9fa; 
          }
          .payment-info { 
            background-color: #f0f9ff; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #dc2626; 
          }
          .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            color: #666; 
            font-size: 12px; 
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">📱 MANJULA MOBILE WORLD</div>
          <div class="subtitle">Mobile Repair & Parts • Ramapuram, Tamil Nadu</div>
          <div class="subtitle">📞 +91 82484 54841 • ✉️ manjulamobiles125@gmail.com</div>
        </div>

        <div class="order-info">
          <div class="order-details">
            <div class="section-title">Order Information</div>
            <p><strong>Order ID:</strong> #${order.orderId || order.id}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          </div>
          
          <div class="customer-details">
            <div class="section-title">Customer Details</div>
            <p><strong>Name:</strong> ${order.customer.name}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Email:</strong> ${order.customer.email}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
          </div>
        </div>

        <div class="section-title">Order Items</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toLocaleString()}</td>
                <td>₹${(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Total Amount</strong></td>
              <td><strong>₹${order.total.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="payment-info">
          <div class="section-title">Payment Information</div>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          ${order.paymentScreenshot && order.paymentScreenshot.data ? 
            `<p><strong>Payment Screenshot:</strong> Attached (${order.paymentScreenshot.fileName})</p>` : 
            '<p><strong>Payment Screenshot:</strong> Not available</p>'
          }
        </div>

        <div class="footer">
          <p>Thank you for choosing Manjula Mobile World!</p>
          <p>For any queries, contact us at +91 82484 54841 or manjulamobiles125@gmail.com</p>
          <p>Printed on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional)
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    };
  }

  renderAddProductForm() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin-products">← Back to Products</button>
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
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
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
          <button class="back-button" data-page="admin-products">← Back to Products</button>
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
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  renderFooter() {
    return `
      <footer>
        <div class="footer-content">
          <div class="footer-section">
            <h4>Owner Portal</h4>
            <ul>
              <li><a href="#" data-page="admin">Dashboard</a></li>
              <li><a href="#" data-page="admin-products">Products</a></li>
              <li><a href="#" data-page="admin-tracking">Tracking</a></li>
              <li><a href="#" data-page="admin-orders">Orders</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Main Site</h4>
            <ul>
              <li><a href="index.html">← Back to Main Site</a></li>
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
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 Manjula Mobile World Owner Portal. All rights reserved.</p>
        </div>
      </footer>
    `
  }

  // Product Management Methods
  async saveProduct() {
    const name = document.getElementById("productName")?.value;
    const category = document.getElementById("productCategory")?.value;
    const price = Number.parseInt(document.getElementById("productPrice")?.value || 0);
    const originalPrice = Number.parseInt(document.getElementById("productOriginalPrice")?.value || 0);
    const imageUrl = document.getElementById("productImageUrl")?.value?.trim();
    const imageUrl2 = document.getElementById("productImageUrl2")?.value?.trim();
    const emoji = document.getElementById("productImage")?.value?.trim();
    const inStock = document.getElementById("productInStock")?.checked || false;

    if (!name || !category || !price) {
      alert("Please fill all required fields");
      return;
    }

    if (imageUrl && imageUrl.length > 700000) {
      alert("❌ Image file is too large. Please use a smaller image (max 500KB).");
      return;
    }
    if (imageUrl2 && imageUrl2.length > 700000) {
      alert("❌ Image 2 file is too large. Please use a smaller image (max 500KB).");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-product"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      if (this.editingProductId) {
        // Update existing product - Database ONLY
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

        const editingIdStr = String(this.editingProductId);
        const existingProduct = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
        
        if (existingProduct) {
          const mongoId = existingProduct._id || existingProduct.id;
          console.log('💾 [OWNER PORTAL] Updating product in database...');
          
          // Update in database ONLY
          const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProduct)
          });

          if (response.ok) {
            const savedProduct = await response.json();
            console.log('✅ [OWNER PORTAL] Product updated in database:', savedProduct);
            
            // Update local array (no localStorage)
            const productIndex = this.products.findIndex((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
            if (productIndex !== -1) {
              this.products[productIndex] = savedProduct;
            }
            
            alert("✅ Product updated in database successfully!");
          } else {
            const errorText = await response.text();
            console.error('❌ [OWNER PORTAL] Database update failed:', errorText);
            throw new Error(`Failed to update product: ${errorText}`);
          }
          
          this.editingProductId = null;
          console.log('🔄 Product updated in database, main website will see changes');
        } else {
          alert("❌ Product not found for editing");
        }
      } else {
        // Create new product - Save ONLY to DATABASE
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

        console.log('💾 [OWNER PORTAL] Saving product to database...');
        
        // Save to database ONLY
        const response = await fetch(`${this.API_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });

        if (response.ok) {
          const savedProduct = await response.json();
          console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
          
          // Add to local array (no localStorage)
          this.products.push(savedProduct);
          
          alert("✅ Product saved to database successfully!");
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database save failed:', errorText);
          throw new Error(`Failed to save product: ${errorText}`);
        }
        
        console.log('🔄 Product saved to database, main website will see it');
      }

      this.renderPage("admin-products");
    } catch (error) {
      console.error('❌ Error saving product:', error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        alert(`⏰ Database operation timed out!\n\nThis usually means:\n• Slow internet connection\n• Database server is busy\n\nPlease try again in a few moments.`);
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(`🌐 Network connection error!\n\nPlease check:\n• Your internet connection\n• Server is running\n• Try refreshing the page`);
      } else if (error.message.includes('offline') || error.message.includes('not available')) {
        alert(`📡 Database is currently offline!\n\nThe server is running but can't connect to the database.\n\nPlease try again later.`);
      } else {
        alert(`❌ Error saving product:\n\n${errorMessage}\n\nPlease check your connection and try again.`);
      }
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-product"]');
      if (saveButton) {
        saveButton.textContent = this.editingProductId ? 'Update Product' : 'Add Product';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for product updates
  async syncProductUpdateToDatabase(mongoId, updatedProduct) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        
        // Update local storage with response from database
        const index = this.products.findIndex(p => (p._id || p.id) === mongoId);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
        }
        
        console.log('✅ Product update synced to database successfully');
      } else {
        console.error('❌ Failed to sync product update to database');
      }
    } catch (error) {
      console.error('❌ Background update sync error:', error);
    }
  }

  // Background sync method - doesn't block UI
  async syncProductToDatabase(product) {
    try {
      console.log('🔄 [OWNER PORTAL] Starting database sync for product:', product.name);
      
      const productForDB = { ...product };
      delete productForDB.id; // Remove temporary ID, let MongoDB generate _id
      
      const response = await fetch(`${this.API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForDB)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
        
        // Update local storage with real database product
        const index = this.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
          console.log('✅ [OWNER PORTAL] Local storage updated with database product');
        }
        
        console.log('✅ Product synced to database successfully - main website should see it now!');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to sync product to database:', errorText);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
    }
  }

  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const productIdStr = String(productId);
        const product = this.products.find(p => String(p.id) === productIdStr || String(p._id) === productIdStr);
        if (!product) {
          alert('Product not found');
          return;
        }

        const mongoId = product._id || product.id;
        console.log('💾 [OWNER PORTAL] Deleting product from database...');
        
        // Delete from database ONLY
        const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log('✅ [OWNER PORTAL] Product deleted from database');
          
          // Remove from local array (no localStorage)
          this.products = this.products.filter((p) => String(p.id) !== productIdStr && String(p._id) !== productIdStr);
          
          this.renderPage("admin-products");
          alert('✅ Product deleted from database successfully!');
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database delete failed:', errorText);
          throw new Error(`Failed to delete product: ${errorText}`);
        }
        
        console.log('🔄 Product deleted from database, main website will see changes');
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        alert('❌ Error deleting product: ' + error.message);
      }
    }
  }

  // Background sync method for product deletion
  async syncProductDeleteToDatabase(mongoId) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Product deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync product deletion to database');
      }
    } catch (error) {
      console.error('❌ Background delete sync error:', error);
    }
  }

  handleImageUpload(event, imageNumber = 1) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Image = e.target.result
        if (imageNumber === 1) {
          document.getElementById("productImageUrl").value = base64Image
        } else if (imageNumber === 2) {
          document.getElementById("productImageUrl2").value = base64Image
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Tracking Management Methods
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

    if (this.trackingData.find((t) => t.qrId === qrId)) {
      alert("This QR ID already exists. Please use a unique QR ID.");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

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

      // 1. Save to local storage IMMEDIATELY (instant)
      this.trackingData.push(newTracking);
      
      // 2. Show SUCCESS popup immediately
      alert("✅ Tracking record created successfully!\n\nQR ID: " + qrId + "\nPassword: " + password + "\n\nShare these details with your customer for tracking.");
      
      // 3. Clear form and render page immediately
      document.getElementById("newTrackingQRId").value = "";
      document.getElementById("newTrackingPassword").value = "";
      document.getElementById("newTrackingCustomer").value = "";
      document.getElementById("newTrackingDevice").value = "";
      document.getElementById("newTrackingContact").value = "";
      document.getElementById("newTrackingIssue").value = "";
      document.getElementById("newTrackingDays").value = "2";
      
      this.toggleTrackingForm();
      this.renderPage("admin-tracking");
      
      // 4. Sync to database in background (don't wait for it)
      this.syncTrackingToDatabase(newTracking).catch(error => {
        console.error('❌ Background tracking sync failed:', error);
      });
      
      console.log('🔄 Tracking saved locally, syncing to database in background');
    } catch (error) {
      console.error('Error saving tracking:', error);
      alert('❌ Error saving tracking: ' + error.message + '\n\nPlease check your internet connection and try again.');
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      if (saveButton) {
        saveButton.textContent = 'Save Tracking';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for tracking
  async syncTrackingToDatabase(tracking) {
    try {
      const response = await fetch(`${this.API_URL}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracking)
      });

      if (response.ok) {
        console.log('✅ Tracking synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking to database');
      }
    } catch (error) {
      console.error('❌ Background tracking sync error:', error);
    }
  }

  async editTracking(qrId) {
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    if (!tracking) return;

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

    // 1. Update local storage IMMEDIATELY (instant)
    tracking.status = newStatus;
    tracking.lastUpdated = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // 2. Show SUCCESS and render page immediately
    this.closeStatusModal();
    this.renderPage("admin-tracking");
    alert(`✅ Status updated to: ${newStatus}`);
    
    // 3. Sync to database in background (don't wait for it)
    this.syncTrackingStatusToDatabase(qrId, newStatus, tracking.lastUpdated).catch(error => {
      console.error('❌ Background tracking status sync failed:', error);
    });
    
    console.log('🔄 Tracking status updated locally, syncing to database in background');
  }

  // Background sync method for tracking status updates
  async syncTrackingStatusToDatabase(qrId, newStatus, lastUpdated) {
    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, lastUpdated: lastUpdated })
      });
      
      if (response.ok) {
        console.log('✅ Tracking status synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking status to database');
      }
    } catch (error) {
      console.error('❌ Background tracking status sync error:', error);
    }
  }

  async deleteTracking(qrId) {
    if (confirm("Are you sure you want to delete this tracking record?")) {
      // 1. Delete from local storage IMMEDIATELY (instant)
      this.trackingData = this.trackingData.filter((t) => t.qrId !== qrId);
      
      // 2. Show SUCCESS and render page immediately
      this.renderPage("admin-tracking");
      alert('✅ Tracking deleted successfully!');
      
      // 3. Delete from database in background (don't wait for it)
      this.syncTrackingDeleteToDatabase(qrId).catch(error => {
        console.error('❌ Background tracking delete sync failed:', error);
      });
      
      console.log('🔄 Tracking deleted locally, syncing to database in background');
    }
  }

  // Background sync method for tracking deletion
  async syncTrackingDeleteToDatabase(qrId) {
    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('✅ Tracking deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking deletion to database');
      }
    } catch (error) {
      console.error('❌ Background tracking delete sync error:', error);
    }
  }

  toggleTrackingForm() {
    const form = document.getElementById("trackingForm")
    if (form) {
      form.style.display = form.style.display === "none" ? "block" : "none"
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

  // Order Management Methods
  async updateOrderStatus(orderId) {
    const order = this.orders.find(o => o.id === orderId || o.orderId === orderId);
    if (!order) return;

    const newStatus = prompt(
      "Enter new order status:\n\nPending\nProcessing\nShipped\nDelivered\nCancelled",
      order.status
    );

    if (newStatus) {
      const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
      if (validStatuses.includes(newStatus)) {
        order.status = newStatus;
        this.renderPage("admin-orders");
        alert(`✅ Order status updated to: ${newStatus}`);
      } else {
        alert("Invalid status. Please use one of the suggested statuses.");
      }
    }
  }

  async deleteOrder(orderId) {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        const orderIdStr = String(orderId);
        const order = this.orders.find(o => String(o.id) === orderIdStr || String(o.orderId) === orderIdStr || String(o._id) === orderIdStr);
        
        if (!order) {
          throw new Error('Order not found in local array');
        }

        const dbOrderId = order.orderId || order.id;
        
        const response = await fetch(`${this.API_URL}/orders/${dbOrderId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete order: ${errorText}`);
        }
        
        this.orders = this.orders.filter(o => o.id !== orderId && o.orderId !== orderId && o.id !== dbOrderId && o.orderId !== dbOrderId);
        
        this.renderPage("admin-orders");
        alert('✅ Order deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting order:', error);
        alert(`❌ Failed to delete order: ${error.message}`);
      }
    }
  }
}

// Initialize Owner Portal App
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOwnerApp);
} else {
  initOwnerApp();
}

function initOwnerApp() {
  try {
    console.log('🚀 Initializing Owner Portal...');
    const app = new OwnerPortalApp();
    window.app = app; // Make app globally accessible
    console.log('✅ Owner Portal initialized successfully');
  } catch (error) {
    console.error('❌ Owner Portal initialization error:', error);
    document.getElementById('app').innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626; margin-bottom: 20px;">⚠️ Error Loading Owner Portal</h1>
        <p style="color: #666; margin-bottom: 20px;">There was an error initializing the owner portal.</p>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 600px; text-align: left;">
          <strong>Error Details:</strong>
          <pre style="margin-top: 10px; color: #dc2626; overflow-x: auto;">${error.message}\n\n${error.stack}</pre>
        </div>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Retry
        </button>
      </div>
    `;
  }
}