require('dotenv').config();
const express = require('express');
const path = require('path');
console.log('[startup] Starting server.js ...');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { logger } = require('./middleware/logger');
const routeMonitor = require('./middleware/routeMonitor');

// Initialize MQTT broker using Aedes (simplified)
const aedes = require('aedes')();
const net = require('net');

const MQTT_PORT = 5200;
const mqttServer = net.createServer(aedes.handle);

mqttServer.listen(MQTT_PORT, '0.0.0.0', () => {
  console.log(`[MQTT] Aedes MQTT broker started and listening on 0.0.0.0:${MQTT_PORT}`);
  console.log(`[MQTT] Broker accessible from network: true`);
});

mqttServer.on('error', (err) => {
  console.error('[MQTT] Aedes server error:', err.message);
});

// Aedes event handlers
aedes.on('client', (client) => {
  console.log(`[MQTT] Aedes client connected: ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[MQTT] Aedes client disconnected: ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[MQTT] Aedes message published by ${client.id} on topic: ${packet.topic}`);
  }
});

aedes.on('subscribe', (subscriptions, client) => {
  console.log(`[MQTT] Aedes client ${client.id} subscribed to topics: ${subscriptions.map(s => s.topic).join(', ')}`);
});

// Initialize MQTT client (connects to our own broker) - delayed to avoid conflicts
setTimeout(() => {
  const mqtt = require('mqtt');
  const mqttClient = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`, {
    clientId: 'backend_server',
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
    protocolVersion: 4,
  });

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('esp32/state', (err) => {
      if (!err) {
        console.log('Subscribed to esp32/state');
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    console.log(`Received MQTT message on ${topic}: ${message.toString()}`);
    // Handle ESP32 state updates here
    if (topic === 'esp32/state') {
      // Process state updates
      const states = message.toString().split(',');
      console.log('ESP32 states:', states);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT connection error:', error);
  });

  // Function to send switch commands via MQTT
  function sendMqttSwitchCommand(relay, state) {
    const message = `${relay}:${state}`;
    mqttClient.publish('esp32/switches', message);
    console.log(`Sent MQTT command: ${message}`);
  }

  // Make MQTT functions available globally
  global.sendMqttSwitchCommand = sendMqttSwitchCommand;
}, 2000); // Wait 2 seconds for server to fully start

// Load secure configuration if available
let secureConfig = {};
try {
    const SecureConfigManager = require('./scripts/secure-config');
    const configManager = new SecureConfigManager();
    secureConfig = configManager.loadSecureConfig();
    console.log('✅ Secure configuration loaded successfully');
} catch (error) {
    console.log('⚠️  Secure configuration not available, using environment variables');
    console.log('   Run: node scripts/secure-config.js setup');
}

// Merge secure config with environment variables
process.env = { ...process.env, ...secureConfig };

// Initialize error tracking
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE') {
    // Silently ignore EPIPE errors from logging
    return;
  }
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'EPIPE') {
    // Silently ignore EPIPE errors from logging
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

// Enable request logging
const requestLogger = morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
});

// Override console methods in production to prevent EPIPE errors
if (process.env.NODE_ENV === 'production') {
  const noop = () => { };
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
}
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const deviceApiRoutes = require('./routes/deviceApi');
const esp32Routes = require('./routes/esp32');
const scheduleRoutes = require('./routes/schedules');
const userRoutes = require('./routes/users');  // Using the new users route
const activityRoutes = require('./routes/activities');
const activityLogRoutes = require('./routes/activityLogs');
const logsRoutes = require('./routes/logs');
const systemHealthRoutes = require('./routes/systemHealth');
const aimlRoutes = require('./routes/aiml');
const settingsRoutes = require('./routes/settings');
const ticketRoutes = require('./routes/tickets');
const devicePermissionRoutes = require('./routes/devicePermissions');
const deviceCategoryRoutes = require('./routes/deviceCategories');
const classExtensionRoutes = require('./routes/classExtensions');

// Import auth middleware
// Import auth middleware
const { auth, authorize } = require('./middleware/auth');

// Import services (only those actively used)
const scheduleService = require('./services/scheduleService');
const deviceMonitoringService = require('./services/deviceMonitoringService');
const EnhancedLoggingService = require('./services/enhancedLoggingService');
const ESP32CrashMonitor = require('./services/esp32CrashMonitor'); // Import ESP32 crash monitor service
// Removed legacy DeviceSocketService/TestSocketService/ESP32SocketService for cleanup

// Initialize ESP32 crash monitoring
const crashMonitor = new ESP32CrashMonitor();
crashMonitor.start();

// --- SOCKET.IO SERVER SETUP ---
// Remove duplicate setup. Use the main app/server/io instance below.
// ...existing code...

// --- MongoDB Connection with retry logic and fallback ---
let dbConnected = false;
const connectDB = async (retries = 5) => {
  const primaryUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom';
  console.log('Connecting to MongoDB:', primaryUri);
  const fallbackUri = process.env.MONGODB_URI_FALLBACK || process.env.MONGODB_URI_DIRECT; // optional
  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 4000,
    socketTimeoutMS: 45000,
    directConnection: primaryUri.startsWith('mongodb://') ? true : undefined,
  };
  try {
    await mongoose.connect(primaryUri, opts);
    dbConnected = true;
    logger.info('Connected to MongoDB');
    try {
      await createAdminUser();
    } catch (adminError) {
      logger.error('Admin user creation error:', adminError);
    }
    // Initialize schedule service after DB connection
    try {
      await scheduleService.initialize();
    } catch (scheduleError) {
      logger.error('Schedule service initialization error:', scheduleError);
    }
  } catch (err) {
    const msg = err && (err.message || String(err));
    logger.error('MongoDB connection error (continuing in LIMITED MODE):', msg);
    // If SRV lookup fails or DNS issues occur and a fallback URI is provided, try it once per attempt
    const isSrvIssue = /querySrv|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(msg || '');
    if (fallbackUri && isSrvIssue) {
      try {
        logger.warn('Trying fallback MongoDB URI...');
        await mongoose.connect(fallbackUri, {
          ...opts,
          directConnection: true,
        });
        dbConnected = true;
        logger.info('Connected to MongoDB via fallback URI');
        try { await createAdminUser(); } catch (adminError) { logger.error('Admin user creation error:', adminError); }
        // Initialize schedule service after DB connection
        try {
          await scheduleService.initialize();
        } catch (scheduleError) {
          logger.error('Schedule service initialization error:', scheduleError);
        }
        return;
      } catch (fallbackErr) {
        logger.error('Fallback MongoDB URI connection failed:', fallbackErr.message || fallbackErr);
      }
    }
    if (retries > 0) {
      logger.info(`Retrying connection... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    } else {
      logger.warn('MongoDB not connected. API running in LIMITED MODE (DB-dependent routes may fail).');
    }
  }
};

connectDB().catch(() => { });

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

const app = express();
const server = http.createServer(app);

// Add request logging to the HTTP server
server.on('request', (req, res) => {
  logger.info(`[HTTP Server] ${req.method} ${req.url}`);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Debug middleware to log all requests (moved to the very beginning)
app.use((req, res, next) => {
  logger.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  logger.debug('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    logger.debug('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Manual preflight handler (before cors) to guarantee PATCH visibility
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Allow all LAN origins for development
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://172.16.3.171:5173', // Windows network IP
      'http://172.16.3.171:5174', // Windows network IP
      'http://172.16.3.171:5175', // Windows network IP
      `http://${require('os').networkInterfaces()['en0']?.find(i => i.family === 'IPv4')?.address}:5173`, // Mac WiFi
      `http://${require('os').networkInterfaces()['eth0']?.find(i => i.family === 'IPv4')?.address}:5173`, // Ethernet
      'http://192.168.1.100:5173', // Example extra network host
      '*'
    ];
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://your-frontend-domain.com']
      : devOrigins;
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, Keep-Alive, X-Requested-With, If-Modified-Since, X-CSRF-Token');
    // Silenced verbose preflight logging
    return res.status(204).end();
  }
  next();
});

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins for network access
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'DNT', 'Cache-Control', 'X-Mx-ReqToken', 'Keep-Alive', 'X-Requested-With', 'If-Modified-Since', 'X-CSRF-Token', 'access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods']
}));



// Body parser (single instance)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize main Socket.IO instance

// Initialize main Socket.IO instance
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow all origins for network access
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'DNT', 'Cache-Control', 'X-Mx-ReqToken', 'Keep-Alive', 'X-Requested-With', 'If-Modified-Since', 'X-CSRF-Token', 'access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods']
  },
  // More conservative WebSocket settings to prevent frame corruption
  perMessageDeflate: false, // Disable compression to avoid frame issues
  httpCompression: false, // Disable HTTP compression
  // Force polling initially, allow WebSocket upgrade
  transports: ['polling', 'websocket'],
  // More conservative timeouts and buffer sizes
  pingTimeout: 60000, // 60 seconds (increased)
  pingInterval: 25000, // 25 seconds (increased)
  upgradeTimeout: 30000, // 30 seconds (increased)
  maxHttpBufferSize: 1e6, // 1MB (reduced from 100MB)
  // Connection stability settings
  allowEIO3: true,
  forceNew: false, // Don't force new connections
  // Additional stability options
  connectTimeout: 45000, // 45 seconds (increased)
  timeout: 45000, // 45 seconds (increased)
  // Disable WebSocket upgrade initially to avoid frame issues
  allowUpgrades: true,
  cookie: false
});

io.engine.on('connection_error', (err) => {
  logger.error('[engine] connection_error', {
    code: err.code,
    message: err.message,
    context: err.context,
    type: err.type,
    description: err.description
  });
});

// Log unexpected upgrade attempts that may corrupt websocket frames
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.startsWith('/socket.io/')) {
    logger.info('[upgrade] Socket.IO upgrade request', {
      url,
      headers: req.headers,
      remoteAddress: req.socket.remoteAddress
    });
    return; // Let Socket.IO handle this
  }
  if (url.startsWith('/esp32-ws')) {
    logger.info('[upgrade] ESP32 WebSocket upgrade request', {
      url,
      headers: req.headers,
      remoteAddress: req.socket.remoteAddress
    });
    return; // Let WebSocketServer handle this
  }
  logger.warn('[upgrade] unexpected websocket upgrade path', { url });
  // Do not write to socket, just let it close if not handled
});

// Additional low-level Engine.IO diagnostics to help trace "Invalid frame header" issues
// These logs are lightweight and only emit on meta events (not every packet) unless NODE_ENV=development
io.engine.on('initial_headers', (headers, req) => {
  logger.info('[engine] initial_headers', {
    ua: req.headers['user-agent'],
    url: req.url,
    transport: req._query && req._query.transport,
    sid: req._query && req._query.sid
  });
});
io.engine.on('headers', (headers, req) => {
  // This fires on each HTTP long-polling request; keep it quiet in production
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[engine] headers', {
      transport: req._query && req._query.transport,
      sid: req._query && req._query.sid,
      upgrade: req._query && req._query.upgrade
    });
  }
});
io.engine.on('connection', (rawSocket) => {
  logger.info('[engine] connection', {
    id: rawSocket.id,
    transport: rawSocket.transport ? rawSocket.transport.name : 'unknown',
    remoteAddress: rawSocket.request?.socket?.remoteAddress
  });
  rawSocket.on('upgrade', (newTransport) => {
    logger.info('[engine] transport upgrade', {
      id: rawSocket.id,
      from: rawSocket.transport ? rawSocket.transport.name : 'unknown',
      to: newTransport && newTransport.name
    });
  });
  rawSocket.on('transport', (t) => {
    logger.info('[engine] transport set', {
      id: rawSocket.id,
      transport: t && t.name
    });
  });
  rawSocket.on('close', (reason) => {
    logger.info('[engine] connection closed', {
      id: rawSocket.id,
      reason
    });
  });
  rawSocket.on('error', (error) => {
    logger.error('[engine] socket error', {
      id: rawSocket.id,
      error: error.message,
      transport: rawSocket.transport ? rawSocket.transport.name : 'unknown'
    });
  });
});

// (Removed old namespace socket services)

// Rate limiting - Very permissive for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production'
    ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100)  // 100 requests per minute in production
    : 1000000,  // Essentially unlimited in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// (removed duplicate simple health route; see consolidated one below)

// Mount routes with rate limiting
const apiRouter = express.Router();

// Apply rate limiting only to sensitive auth mutation endpoints (not profile)
apiRouter.use('/auth/register', authLimiter);
apiRouter.use('/auth/login', authLimiter);
apiRouter.use('/auth/forgot-password', authLimiter);
apiRouter.use('/auth/reset-password', authLimiter);
apiRouter.use('/auth', authRoutes);

// Apply API rate limiting to other routes
apiRouter.use('/helper', apiLimiter, require('./routes/helper'));
apiRouter.use('/devices', apiLimiter, deviceRoutes);
apiRouter.use('/device-api', apiLimiter, deviceApiRoutes);
apiRouter.use('/esp32', apiLimiter, esp32Routes);
apiRouter.use('/schedules', apiLimiter, scheduleRoutes);
apiRouter.use('/users', apiLimiter, userRoutes);
apiRouter.use('/activities', apiLimiter, activityRoutes);
apiRouter.use('/activity-logs', apiLimiter, activityLogRoutes);
apiRouter.use('/logs', apiLimiter, logsRoutes);
apiRouter.use('/system-health', apiLimiter, auth, authorize('admin', 'super-admin'), systemHealthRoutes);
apiRouter.use('/analytics', apiLimiter, require('./routes/analytics'));
apiRouter.use('/aiml', apiLimiter, aimlRoutes);
apiRouter.use('/settings', apiLimiter, settingsRoutes);
apiRouter.use('/tickets', apiLimiter, ticketRoutes);
apiRouter.use('/device-permissions', apiLimiter, devicePermissionRoutes);
apiRouter.use('/device-categories', apiLimiter, deviceCategoryRoutes);
apiRouter.use('/class-extensions', apiLimiter, classExtensionRoutes);
apiRouter.use('/role-permissions', apiLimiter, require('./routes/rolePermissions'));

// Mount all routes under /api
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api', apiRouter);

// Optional same-origin static serving (set SERVE_FRONTEND=1 after building frontend into ../dist)
try {
  if (process.env.SERVE_FRONTEND === '1') {
    const distPath = path.join(__dirname, '..', 'dist');
    const fs = require('fs');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
      logger.info('[static] Serving frontend dist/ assets same-origin');
    } else {
      logger.warn('[static] SERVE_FRONTEND=1 but dist folder not found at', distPath);
    }
  }
} catch (e) {
  logger.error('[static] error enabling same-origin serving', e.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// Create default admin user
const createAdminUser = async () => {
  try {
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      // IMPORTANT: Provide the plain password here so the pre-save hook hashes it ONCE.
      // Previously this code hashed manually AND the pre-save hook re-hashed, breaking login.
      await User.create({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@company.com',
        password: process.env.ADMIN_PASSWORD || 'admin123456',
        role: 'admin',
        department: 'IT Department',
        accessLevel: 'full'
      });
      logger.info('Default admin user created (single-hash)');
    }
  } catch (error) {
    logger.error('Error creating admin user:', error);
  }
};

// Socket.IO for real-time updates with additional diagnostics
// io.engine.on('connection_error', (err) => {
//   logger.error('[socket.io engine connection_error]', {
//     code: err.code,
//     message: err.message,
//     context: err.context
//   });
// });

io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  // Emit a hello for quick handshake debug
  socket.emit('server_hello', { ts: Date.now() });

  // Join user-specific room if authenticated
  if (socket.handshake.auth && socket.handshake.auth.token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        socket.join(`user_${decoded.id}`);
        logger.info(`Socket ${socket.id} joined user room: user_${decoded.id}`);
      }
    } catch (error) {
      logger.warn(`Failed to join user room for socket ${socket.id}:`, error.message);
    }
  }

  socket.on('join-room', (room) => {
    try {
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room ${room}`);
    } catch (e) {
      logger.error('[join-room error]', e.message);
    }
  });

  socket.on('ping_test', (cb) => {
    if (typeof cb === 'function') cb({ pong: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected:', socket.id, 'reason:', reason);
  });
});

// Make io accessible to routes and globally (for services without req)
app.set('io', io);
global.io = io;

// Initialize Socket Service for user tracking
const SocketService = require('./services/socketService');
const socketService = new SocketService(io);
io.socketService = socketService;

// Expose sequence-aware emitter to controllers
app.set('emitDeviceStateChanged', emitDeviceStateChanged);

// -----------------------------------------------------------------------------
// Device state sequencing & unified emit helper
// -----------------------------------------------------------------------------
// Adds a monotonically increasing per-device sequence number to every
// device_state_changed event for deterministic ordering + easier debug of
// stale/ out-of-order UI updates.
const deviceSeqMap = new Map(); // deviceId -> last seq
function nextDeviceSeq(deviceId) {
  const prev = deviceSeqMap.get(deviceId) || 0;
  const next = prev + 1;
  deviceSeqMap.set(deviceId, next);
  return next;
}

function emitDeviceStateChanged(device, meta = {}) {
  if (!device) return;
  const deviceId = device.id || device._id?.toString();
  if (!deviceId) return;
  const seq = nextDeviceSeq(deviceId);
  const payload = {
    deviceId,
    state: device,
    ts: Date.now(),
    seq,
    source: meta.source || 'unknown',
    note: meta.note
  };
  io.emit('device_state_changed', payload);
  // Focused debug log (avoid dumping entire device doc unless explicitly enabled)
  if (process.env.DEVICE_SEQ_LOG === 'verbose') {
    logger.info('[emitDeviceStateChanged]', { deviceId, seq, source: payload.source, note: payload.note });
  } else if (process.env.DEVICE_SEQ_LOG === 'basic') {
    logger.debug('[emitDeviceStateChanged]', { deviceId, seq, source: payload.source });
  }
}

// -----------------------------------------------------------------------------
// Raw WebSocket server for ESP32 devices (simpler than Socket.IO on microcontroller)
const wsDevices = new Map(); // mac -> ws
global.wsDevices = wsDevices;
const wss = new WebSocketServer({ server, path: '/esp32-ws' });
logger.info('Raw WebSocket /esp32-ws endpoint ready');

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', async (msg) => {
    let data;
    try { data = JSON.parse(msg.toString()); } catch { return; }
    const type = data.type;
    console.log('[WS] Received message type:', type, 'MAC:', data.mac || 'none');
    if (type === 'identify' || type === 'authenticate') {
      const mac = (data.mac || data.macAddress || '').toUpperCase();
      const secret = data.secret || data.signature;
      if (!mac) {
        ws.send(JSON.stringify({ type: 'error', reason: 'missing_mac' }));
        return;
      }
      try {
        const Device = require('./models/Device');
        // fetch secret field explicitly
        const device = await Device.findOne({ macAddress: mac }).select('+deviceSecret switches macAddress');
        if (!device || !device.deviceSecret) {
          // If deviceSecret not set, allow temporary identification without secret
          if (!device) {
            logger.warn('[identify] device_not_registered', { mac });
            ws.send(JSON.stringify({ type: 'error', reason: 'device_not_registered' }));
            try { io.emit('identify_error', { mac, reason: 'device_not_registered' }); } catch { }
            return;
          }
        } else if (!secret || device.deviceSecret !== secret) {
          if (process.env.ALLOW_INSECURE_IDENTIFY === '1') {
            logger.warn('[identify] secret mismatch but ALLOW_INSECURE_IDENTIFY=1, allowing temporary identify', { mac });
          } else {
            logger.warn('[identify] invalid_or_missing_secret', { mac, provided: secret ? 'present' : 'missing' });
            ws.send(JSON.stringify({ type: 'error', reason: 'invalid_or_missing_secret' }));
            try { io.emit('identify_error', { mac, reason: 'invalid_or_missing_secret' }); } catch { }
            return;
          }
        }
        ws.mac = mac;
        // Attach secret for this connection (if available)
        ws.secret = (device && device.deviceSecret) ? device.deviceSecret : undefined;
        wsDevices.set(mac, ws);
        device.status = 'online';
        device.lastSeen = new Date();
        device.isIdentified = true;
        device.connectionStatus = 'online';
        await device.save();
        if (process.env.NODE_ENV !== 'production') {
          logger.info('[identify] device marked online', { mac, lastSeen: device.lastSeen.toISOString() });
        }
        
        // Allow all web commands to work 24/7 including night hours
        // Previous safety check removed to enable full-time operation
        
        if (Array.isArray(device.queuedIntents) && device.queuedIntents.length) {
          logger.info('[identify] flushing queued intents (24/7 operation enabled)', { mac, count: device.queuedIntents.length });
          for (const intent of device.queuedIntents) {
            try {
              const payload = { type: 'switch_command', mac, gpio: intent.switchGpio, state: intent.desiredState };
              ws.send(JSON.stringify(payload));
            } catch (e) { /* ignore individual failures */ }
          }
          device.queuedIntents = [];
          await device.save();
        }
        // Build minimal switch config (exclude sensitive/internal fields)
        const switchConfig = Array.isArray(device.switches) ? device.switches.map(sw => ({
          gpio: sw.gpio,
          relayGpio: sw.relayGpio,
          name: sw.name,
          manualSwitchGpio: sw.manualSwitchGpio,
          manualSwitchEnabled: sw.manualSwitchEnabled,
          manualMode: sw.manualMode,
          manualActiveLow: sw.manualActiveLow,
          state: sw.state
        })) : [];
        ws.send(JSON.stringify({
          type: 'identified',
          mac,
          mode: device.deviceSecret ? 'secure' : 'insecure',
          switches: switchConfig
        }));
        // Immediately send a full config_update so firmware can apply current states and GPIO mapping
        try {
          const cfgMsg = {
            type: 'config_update',
            mac,
            switches: device.switches.map((sw, idx) => ({
              order: idx,
              gpio: sw.gpio,
              relayGpio: sw.relayGpio,
              name: sw.name,
              manualSwitchGpio: sw.manualSwitchGpio,
              manualSwitchEnabled: sw.manualSwitchEnabled,
              manualMode: sw.manualMode,
              manualActiveLow: sw.manualActiveLow,
              state: sw.state
            })),
            pirEnabled: device.pirEnabled,
            pirGpio: device.pirGpio,
            pirAutoOffDelay: device.pirAutoOffDelay
          };
          ws.send(JSON.stringify(cfgMsg));
        } catch (e) {
          logger.warn('[identify] failed to send config_update', e.message);
        }
        logger.info(`[esp32] identified ${mac}`);
        // Notify frontend clients for immediate UI updates / queued toggle flush
        try { io.emit('device_connected', { deviceId: device.id, mac }); } catch { }
      } catch (e) {
        logger.error('[identify] error', e.message);
      }
      return;
    }
    if (!ws.mac) return; // ignore until identified
    if (type === 'heartbeat') {
      try {
        const Device = require('./models/Device');
        const device = await Device.findOne({ macAddress: ws.mac });
        if (device) {
          const wasOffline = device.status !== 'online';
          device.lastSeen = new Date();
          device.status = 'online';
          device.connectionStatus = 'online';
          await device.save();

          // If device was previously offline, emit state change
          if (wasOffline) {
            emitDeviceStateChanged(device, { source: 'esp32:heartbeat' });
            logger.info(`[heartbeat] device came online: ${ws.mac}`);
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('[heartbeat] updated lastSeen', { mac: ws.mac, lastSeen: device.lastSeen.toISOString() });
          }
        }
      } catch (e) {
        logger.error('[heartbeat] error', e.message);
      }
      return;
    }
    if (type === 'state_update') {
      // basic rate limit: max 5 per 5s per device
      const now = Date.now();
      if (!ws._stateRL) ws._stateRL = [];
      ws._stateRL = ws._stateRL.filter(t => now - t < 5000);
      if (ws._stateRL.length >= 5) {
        return; // drop silently
      }
      ws._stateRL.push(now);
      // Optional HMAC verification
      try {
        if (process.env.REQUIRE_HMAC_IN === '1' && ws.secret) {
          const sig = data.sig;
          const seq = data.seq || 0;
          const ts = data.ts || 0;
          const mac = ws.mac;
          const base = `${mac}|${seq}|${ts}`;
          const exp = crypto.createHmac('sha256', ws.secret).update(base).digest('hex');
          if (!sig || sig !== exp) {
            logger.warn('[hmac] invalid state_update signature', { mac: ws.mac, seq, ts });
            return; // drop
          }
        }
      } catch (e) { /* do not block on hmac errors */ }
      // Drop stale by seq if provided
      const incomingSeq = typeof data.seq === 'number' ? data.seq : undefined;
      if (incomingSeq !== undefined) {
        ws._lastInSeq = ws._lastInSeq || 0;
        if (incomingSeq < ws._lastInSeq) {
          return; // stale
        }
        ws._lastInSeq = incomingSeq;
      }
      try {
        const Device = require('./models/Device');
        const device = await Device.findOne({ macAddress: ws.mac });
        if (!device) return;
        const incoming = Array.isArray(data.switches) ? data.switches : [];
        let changed = false;
        const validGpios = new Set(device.switches.map(sw => sw.gpio || sw.relayGpio));
        incoming.forEach(swIn => {
          const gpio = swIn.gpio ?? swIn.relayGpio;
          if (gpio === undefined) return;
          if (!validGpios.has(gpio)) return; // ignore unknown gpio
          const target = device.switches.find(sw => (sw.gpio || sw.relayGpio) === gpio);
          if (target && target.state !== swIn.state) {
            target.state = !!swIn.state;
            target.lastStateChange = new Date();
            changed = true;
          }
        });
        if (data.pir && device.pirEnabled) {
          device.pirSensorLastTriggered = new Date();
        }
        device.lastSeen = new Date();
        device.status = 'online';
        device.connectionStatus = 'online';
        await device.save();
        emitDeviceStateChanged(device, { source: 'esp32:state_update' });
        ws.send(JSON.stringify({ type: 'state_ack', ts: Date.now(), changed }));
      } catch (e) {
        logger.error('[esp32 state_update] error', e.message);
      }
      return;
    }
    if (type === 'switch_result') {
      // HMAC verification first (if enabled)
      try {
        if (process.env.REQUIRE_HMAC_IN === '1' && ws.secret) {
          const sig = data.sig;
          const mac = ws.mac;
          const gpio = data.gpio;
          const success = !!data.success;
          const requested = !!data.requestedState;
          const actual = data.actualState !== undefined ? !!data.actualState : false;
          const seq = data.seq || 0;
          const ts = data.ts || 0;
          const base = `${mac}|${gpio}|${success ? 1 : 0}|${requested ? 1 : 0}|${actual ? 1 : 0}|${seq}|${ts}`;
          const exp = crypto.createHmac('sha256', ws.secret).update(base).digest('hex');
          if (!sig || sig !== exp) {
            logger.warn('[hmac] invalid switch_result signature', { mac: ws.mac, gpio, seq });
            return; // drop
          }
        }
      } catch (e) { /* do not block on hmac errors */ }
      // Drop stale by seq if provided
      const incomingSeq = typeof data.seq === 'number' ? data.seq : undefined;
      if (incomingSeq !== undefined) {
        ws._lastResSeq = ws._lastResSeq || 0;
        if (incomingSeq < ws._lastResSeq) {
          return; // stale
        }
        ws._lastResSeq = incomingSeq;
      }
      try {
        const Device = require('./models/Device');
        const device = await Device.findOne({ macAddress: ws.mac });
        if (!device) return;
        const gpio = data.gpio;
        const success = !!data.success;
        const requested = !!data.requestedState;
        const actual = data.actualState !== undefined ? !!data.actualState : undefined;
        const target = device.switches.find(sw => (sw.gpio || sw.relayGpio) === gpio);
        if (!success) {
          const reason = data.reason || 'unknown_gpio';
          // Treat stale_seq as a harmless, idempotent drop (usually after server restart)
          // Do not surface a failure toast; just emit switch_result for potential UI reconciliation
          if (reason === 'stale_seq') {
            try {
              logger.debug('[switch_result] stale_seq drop', { mac: ws.mac, gpio, requested });
            } catch { }
            // Still forward a lightweight switch_result so UI can optionally refresh
            io.emit('switch_result', { deviceId: device.id, gpio, requestedState: requested, actualState: actual, success: false, reason, ts: Date.now() });
            return;
          }

          logger.warn('[switch_result] failure', { mac: ws.mac, gpio, reason, requested, actual });
          // Reconcile DB with actual hardware state if provided
          if (target && actual !== undefined && target.state !== actual) {
            target.state = actual;
            target.lastStateChange = new Date();
            await device.save();
            emitDeviceStateChanged(device, { source: 'esp32:switch_result:failure', note: reason });
          }
          // Notify UI about blocked toggle AFTER reconciliation so state matches hardware
          io.emit('device_toggle_blocked', { deviceId: device.id, switchGpio: gpio, reason, requestedState: requested, actualState: actual, timestamp: Date.now() });
          // Emit dedicated switch_result event for precise UI reconciliation (failure)
          io.emit('switch_result', { deviceId: device.id, gpio, requestedState: requested, actualState: actual, success: false, reason, ts: Date.now() });

          // Enhanced notification for switch failure
          const socketService = require('./services/socketService');
          if (socketService && typeof socketService.notifyDeviceError === 'function') {
            socketService.notifyDeviceError(
              device._id,
              `Switch toggle failed: ${reason}`,
              device.name,
              device.location
            );
          }
          return;
        }
        // Success path: if backend DB state mismatches actual, reconcile and broadcast
        if (target && actual !== undefined && target.state !== actual) {
          target.state = actual;
          target.lastStateChange = new Date();
          await device.save();
          emitDeviceStateChanged(device, { source: 'esp32:switch_result:success:reconcile' });
        }
        // Always emit switch_result for UI even if no DB change (authoritative confirmation)
        io.emit('switch_result', { deviceId: device.id, gpio, requestedState: requested, actualState: actual !== undefined ? actual : (target ? target.state : undefined), success: true, ts: Date.now() });

        // Enhanced notification for successful switch change
        if (target && actual !== undefined) {
          const socketService = require('./services/socketService');
          if (socketService && typeof socketService.notifySwitchChange === 'function') {
            socketService.notifySwitchChange(
              device._id,
              target._id.toString(),
              target.name,
              actual,
              device.name,
              device.location
            );
          }
        }
      } catch (e) {
        logger.error('[switch_result handling] error', e.message);
      }
      return;
    }
    if (type === 'manual_switch') {
      // Handle manual switch events from ESP32 devices
      try {
        // For testing: if not identified, try to identify using the MAC from the message
        if (!ws.mac && data.mac) {
          ws.mac = data.mac.toUpperCase();
        }
        
        if (!ws.mac) {
          logger.warn('[manual_switch] no MAC available');
          return;
        }

        const Device = require('./models/Device');
        const EnhancedLoggingService = require('./services/enhancedLoggingService');

        const device = await Device.findOne({ macAddress: ws.mac });
        if (!device) {
          logger.warn('[manual_switch] device not found', { mac: ws.mac });
          return;
        }

        const gpio = data.gpio || data.switchId;
        const action = data.action; // 'manual_on' or 'manual_off'
        const previousState = data.previousState === 'on';
        const newState = data.newState === 'on';
        const detectedBy = data.detectedBy || 'gpio_interrupt';
        const physicalPin = data.physicalPin;
        const timestamp = data.timestamp || Date.now();

        // Find the switch in the device configuration
        const targetSwitch = device.switches.find(sw => (sw.gpio || sw.relayGpio) === gpio);
        if (!targetSwitch) {
          logger.warn('[manual_switch] switch not found', { mac: ws.mac, gpio });
          return;
        }

        // Log the manual switch event
        await EnhancedLoggingService.logManualSwitch({
          deviceId: device._id,
          deviceName: device.name,
          deviceMac: ws.mac,
          switchId: gpio,
          switchName: targetSwitch.name,
          physicalPin: physicalPin,
          action: action,
          previousState: previousState ? 'on' : 'off',
          newState: newState ? 'on' : 'off',
          detectedBy: detectedBy,
          timestamp: new Date(timestamp),
          macAddress: ws.mac
        });

        logger.info('[manual_switch] logged', {
          mac: ws.mac,
          gpio,
          action,
          previousState,
          newState,
          switchName: targetSwitch.name
        });

        // Update device state if it changed
        if (targetSwitch.state !== newState) {
          targetSwitch.state = newState;
          targetSwitch.lastStateChange = new Date();
          await device.save();
          emitDeviceStateChanged(device, { source: 'esp32:manual_switch' });
        }

      } catch (e) {
        logger.error('[manual_switch] error', e.message);
      }
      return;
    }
  });
  ws.on('close', () => {
    if (ws.mac) {
      wsDevices.delete(ws.mac);
      logger.info(`[esp32] disconnected ${ws.mac}`);
      try { io.emit('device_disconnected', { mac: ws.mac }); } catch { }
      // Immediately mark device offline instead of waiting for periodic scan
      (async () => {
        try {
          const Device = require('./models/Device');
          const d = await Device.findOne({ macAddress: ws.mac });
          if (d && d.status !== 'offline') {
            d.status = 'offline';
            d.connectionStatus = 'disconnected';
            d.isIdentified = false;
            await d.save();
            emitDeviceStateChanged(d, { source: 'esp32:ws_close' });
            logger.info(`[ws close] marked device offline: ${ws.mac}`);
          }
        } catch (e) {
          logger.error('[ws close offline update] error', e.message);
        }
      })();
    }
  });
});

// Ping/purge dead WS connections every 30s
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

// Offline detection every 60s (mark devices offline if stale)
setInterval(async () => {
  try {
    const Device = require('./models/Device');

    // Use consistent 2-minute threshold to match monitoring service
    const thresholdSeconds = 120; // 2 minutes (consistent with monitoring service)
    const cutoff = Date.now() - (thresholdSeconds * 1000);

    const stale = await Device.find({ lastSeen: { $lt: new Date(cutoff) }, status: { $ne: 'offline' } });
    for (const d of stale) {
      d.status = 'offline';
      await d.save();
      emitDeviceStateChanged(d, { source: 'offline-scan' });
      logger.info(`[offline-scan] marked device offline: ${d.macAddress} (lastSeen: ${d.lastSeen})`);
    }

    if (stale.length > 0) {
      logger.info(`[offline-scan] marked ${stale.length} devices as offline`);
    }
  } catch (e) {
    logger.error('[offline-scan] error', e.message);
  }
}, 60000);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  // Log the error
  logger.error('Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? req.user.id : 'unauthenticated'
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Handle different types of errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: isDevelopment ? error.message : 'Invalid input data',
      details: isDevelopment ? error.errors : undefined
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: isDevelopment ? error.message : 'Invalid resource ID'
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'Resource already exists'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.info('404 handler reached for:', req.method, req.url);
  res.status(404).json({ message: 'Route not found' });
});

// Start the server (single attempt)
const PORT = process.env.PORT || 3001;
if (io && io.opts) {
  io.opts.cors = {
    origin: '*', // You can restrict this to your frontend URLs
    methods: ['GET', 'POST']
  };
}
server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  const host = process.env.HOST || '0.0.0.0';
  console.log(`Server running on ${host}:${PORT}`);
  if (host === '0.0.0.0') {
    console.log(`Server accessible on all network interfaces`);
  } else {
    console.log(`Server bound to specific IP: ${host}`);
  }
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Connect to database after server starts
  connectDB().catch(() => { });

  // Start enhanced services after successful startup
  setTimeout(() => {
    // Start device monitoring service (5-minute checks)
    deviceMonitoringService.start();
    
    // Set up log cleanup (run daily at midnight)
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        await EnhancedLoggingService.cleanupLogs();
      }
    }, 60000); // Check every minute
    
    console.log('[SERVICES] Enhanced logging and monitoring services started');
  }, 5000); // Wait 5 seconds for database connection
});

module.exports = { app, io };
