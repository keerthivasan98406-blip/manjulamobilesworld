// Keep-Alive Service to prevent Render from sleeping
const https = require('https');

const WEBSITE_URL = 'https://manjulamobilesworld-whwt.onrender.com';
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (before 15-minute sleep)

function pingWebsite() {
  const url = new URL(WEBSITE_URL);
  
  const options = {
    hostname: url.hostname,
    port: 443,
    path: '/',
    method: 'GET',
    timeout: 10000
  };

  const req = https.request(options, (res) => {
    console.log(`✅ Keep-alive ping successful: ${res.statusCode} at ${new Date().toISOString()}`);
  });

  req.on('error', (error) => {
    console.log(`❌ Keep-alive ping failed: ${error.message} at ${new Date().toISOString()}`);
  });

  req.on('timeout', () => {
    console.log(`⏰ Keep-alive ping timeout at ${new Date().toISOString()}`);
    req.destroy();
  });

  req.end();
}

// Start keep-alive service only in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔄 Starting keep-alive service...');
  console.log(`📡 Will ping ${WEBSITE_URL} every 14 minutes`);
  
  // Initial ping after 2 minutes
  setTimeout(pingWebsite, 2 * 60 * 1000);
  
  // Regular pings every 14 minutes
  setInterval(pingWebsite, PING_INTERVAL);
} else {
  console.log('🏠 Keep-alive service disabled in development');
}

module.exports = { pingWebsite };