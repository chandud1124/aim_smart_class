
const Device = require('../models/Device');
const gpioUtils = require('../utils/gpioUtils');
const { logger } = require('../middleware/logger');
// Per-device command sequence for strict ordering to devices
const _cmdSeqMap = new Map(); // mac -> last seq
function nextCmdSeq(mac) {
  if (!mac) return 0;
  const key = mac.toUpperCase();
  const prev = _cmdSeqMap.get(key) || 0;
  const next = prev + 1;
  _cmdSeqMap.set(key, next);
  return next;
}
const crypto = require('crypto');
const ActivityLog = require('../models/ActivityLog');
const SecurityAlert = require('../models/SecurityAlert');
// Access io via req.app.get('io') where needed instead of legacy socketService

// Helper function to build device access query based on user permissions
function buildDeviceAccessQuery(user) {
  if (user.role === 'admin' || user.role === 'super-admin') {
    return {}; // Admin can access all devices
  }

  const accessConditions = [];

  // Direct device assignments
  if (user.assignedDevices && user.assignedDevices.length > 0) {
    accessConditions.push({ _id: { $in: user.assignedDevices } });
  }

  // Classroom-based access
  if (user.assignedRooms && user.assignedRooms.length > 0) {
    accessConditions.push({ classroom: { $in: user.assignedRooms } });
  }

  // Department-based access for management and faculty roles
  if ((user.role === 'principal' || user.role === 'dean' || user.role === 'hod' || user.role === 'faculty') && user.department) {
    accessConditions.push({
      classroom: { $regex: `^${user.department}-`, $options: 'i' }
    });
  }

  if (accessConditions.length === 0) {
    return null; // No access to any devices
  }

  return { $or: accessConditions };
}

const getAllDevices = async (req, res) => {
  try {
    const query = buildDeviceAccessQuery(req.user);
    if (query === null) {
      return res.json({
        success: true,
        data: []
      });
    }

    const devices = await Device.find(query).populate('assignedUsers', 'name email role').lean();

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const dupField = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        error: 'Validation failed',
        details: `Device with this ${dupField || 'value'} already exists`
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createDevice = async (req, res) => {
  try {
    const {
      name,
      macAddress,
      ipAddress,
      location,
      classroom,
      pirEnabled = false,
      pirGpio,
      pirAutoOffDelay = 300, // 5 minutes default
      switches = []
    } = req.body;

    // Validate required fields (ipAddress also required by schema)
    if (!name || !macAddress || !location || !ipAddress) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Name, MAC address, IP address, and location are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Invalid MAC address format'
      });
    }

    // Check for existing device with same MAC address
    const existingDevice = await Device.findOne({ macAddress });
    if (existingDevice) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Device with this MAC address already exists'
      });
    }

    // Validate IP address format & duplicates
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Invalid IP address format'
      });
    }
    const octetsOk = ipAddress.split('.').every(o => Number(o) >= 0 && Number(o) <= 255);
    if (!octetsOk) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Each IP octet must be between 0 and 255'
      });
    }
    const existingIP = await Device.findOne({ ipAddress });
    if (existingIP) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Device with this IP address already exists'
      });
    }

    // Validate GPIO configuration using comprehensive validation
    const gpioConfig = {
      switches,
      pirEnabled,
      pirGpio
    };
    const gpioValidation = gpioUtils.validateGpioConfiguration(gpioConfig);

    if (!gpioValidation.valid) {
      return res.status(400).json({
        error: 'GPIO Validation Failed',
        details: 'Invalid GPIO pin configuration',
        errors: gpioValidation.errors,
        warnings: gpioValidation.warnings
      });
    }

    // Log warnings if any (but don't block creation)
    if (gpioValidation.warnings.length > 0) {
      console.warn('[createDevice] GPIO warnings:', gpioValidation.warnings);
    }

    // Create new device
    // Generate a secure device secret (48 hex chars) if not provided
    const deviceSecret = crypto.randomBytes(24).toString('hex');

    const device = new Device({
      name,
      macAddress,
      ipAddress,
      location,
      classroom,
      pirEnabled,
      pirGpio,
      pirAutoOffDelay,
      switches: switches.map(sw => ({
        name: sw.name,
        gpio: sw.gpio,
        type: sw.type || 'relay',
        state: false, // force default off; ignore provided state
        icon: sw.icon || 'lightbulb',
        manualSwitchEnabled: !!sw.manualSwitchEnabled,
        manualSwitchGpio: sw.manualSwitchGpio,
        manualMode: sw.manualMode || 'maintained',
        manualActiveLow: sw.manualActiveLow !== undefined ? sw.manualActiveLow : true,
        lastStateChange: new Date()
      })),
      deviceSecret,
      createdBy: req.user.id,
      lastModifiedBy: req.user.id
    });

    await device.save();
    // Log activity with new action type
    try {
      await ActivityLog.create({
        deviceId: device._id,
        action: 'device_created',
        triggeredBy: 'system',
        userId: req.user.id,
        userName: req.user.name,
        deviceName: device.name,
        classroom: device.classroom,
        location: device.location
      });
    } catch (logErr) {
      if (process.env.NODE_ENV !== 'production') console.warn('[deviceController] activity log failed', logErr.message);
    }

    // Broadcast new device
    const emitDeviceStateChanged = req.app.get('emitDeviceStateChanged');
    if (emitDeviceStateChanged) {
      emitDeviceStateChanged(device, { source: 'controller:createDevice' });
    } else {
      req.app.get('io').emit('device_state_changed', { deviceId: device.id, state: device, ts: Date.now() });
    }

    // Emit notification to all connected users with appropriate permissions
    if (req.app.get('io')) {
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.notifyDeviceStatusChange(device._id, 'created', device.name, device.location);
      } else {
        req.app.get('io').emit('device_notification', {
          type: 'device_created',
          message: `New device "${device.name}" created in ${device.location}`,
          deviceId: device._id,
          deviceName: device.name,
          location: device.location,
          metadata: {
            deviceId: device._id,
            deviceName: device.name,
            deviceLocation: device.location,
            deviceClassroom: device.classroom,
            createdBy: req.user.name,
            switchCount: device.switches.length
          },
          timestamp: new Date()
        });
      }
    }

    // Push updated config to ESP32 if connected (include manual fields)
    try {
      if (global.wsDevices && device.macAddress) {
        const ws = global.wsDevices.get(device.macAddress.toUpperCase());
        if (ws && ws.readyState === 1) {
          const cfgMsg = {
            type: 'config_update',
            mac: device.macAddress,
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
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[device_update config_update push failed]', e.message);
    }
    // Broadcast new configuration as separate config_update
    try {
      const cfgMsg = {
        type: 'config_update',
        deviceId: device.id,
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
      req.app.get('io').emit('config_update', cfgMsg);
      if (global.wsDevices && device.macAddress) {
        const ws = global.wsDevices.get(device.macAddress.toUpperCase());
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(cfgMsg));
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[config_update emit failed]', e.message);
    }

    // Include secret separately so API clients can capture it (model hides it by select:false in future fetches)
    res.status(201).json({
      success: true,
      data: device,
      deviceSecret // expose once on create
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const {
      name,
      macAddress,
      ipAddress,
      location,
      classroom,
      pirEnabled,
      pirGpio,
      pirAutoOffDelay,
      switches
    } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check for duplicate MAC address if changed
    if (macAddress && macAddress !== device.macAddress) {
      const existingDeviceMAC = await Device.findOne({ macAddress });
      if (existingDeviceMAC) {
        return res.status(400).json({ message: 'Device with this MAC address already exists' });
      }
    }

    // Check for duplicate IP address if changed
    if (ipAddress && ipAddress !== device.ipAddress) {
      const existingDeviceIP = await Device.findOne({ ipAddress });
      if (existingDeviceIP) {
        return res.status(400).json({ message: 'Device with this IP address already exists' });
      }
    }

    // Update device
    device.name = name || device.name;
    device.macAddress = macAddress || device.macAddress;
    device.ipAddress = ipAddress || device.ipAddress;
    device.location = location || device.location;
    device.classroom = classroom || device.classroom;
    device.pirEnabled = pirEnabled !== undefined ? pirEnabled : device.pirEnabled;
    device.pirGpio = pirGpio || device.pirGpio;
    device.pirAutoOffDelay = pirAutoOffDelay || device.pirAutoOffDelay;

    let removedSwitches = [];
    const oldSwitchesSnapshot = device.switches ? device.switches.map(sw => sw.toObject ? sw.toObject() : { ...sw }) : [];
    if (switches && Array.isArray(switches)) {
      // Validate GPIO configuration using comprehensive validation
      const gpioConfig = {
        switches,
        pirEnabled: pirEnabled !== undefined ? pirEnabled : device.pirEnabled,
        pirGpio: pirGpio !== undefined ? pirGpio : device.pirGpio
      };
      const gpioValidation = gpioUtils.validateGpioConfiguration(gpioConfig);

      if (!gpioValidation.valid) {
        return res.status(400).json({
          error: 'GPIO Validation Failed',
          details: 'Invalid GPIO pin configuration',
          errors: gpioValidation.errors,
          warnings: gpioValidation.warnings
        });
      }

      // Log warnings if any (but don't block update)
      if (gpioValidation.warnings.length > 0) {
        console.warn('[updateDevice] GPIO warnings:', gpioValidation.warnings);
      }

      // Build new ordered switch array preserving state if gpio changed; capture warnings
      const warnings = [];
      device.switches = switches.map((sw, idx) => {
        const existing = device.switches.id(sw.id) || device.switches.find(s => s.name === sw.name);
        // Preserve existing state; new switches default to false. Ignore any incoming sw.state (initial state not user-settable here).
        const state = existing ? existing.state : false;
        if (existing) {
          if (existing.gpio !== sw.gpio && existing.state === true) {
            warnings.push({ type: 'gpio_changed_active', switchName: existing.name, from: existing.gpio, to: sw.gpio });
          }
        }
        return {
          name: sw.name,
          gpio: sw.gpio,
          type: sw.type || (existing && existing.type) || 'relay',
          state,
          icon: sw.icon || (existing && existing.icon) || 'lightbulb',
          manualSwitchEnabled: !!sw.manualSwitchEnabled,
          manualSwitchGpio: sw.manualSwitchGpio,
          manualMode: sw.manualMode || (existing && existing.manualMode) || 'maintained',
          manualActiveLow: sw.manualActiveLow !== undefined ? sw.manualActiveLow : (existing ? existing.manualActiveLow : true),
          usePir: sw.usePir !== undefined ? sw.usePir : (existing ? existing.usePir : false),
          dontAutoOff: sw.dontAutoOff !== undefined ? sw.dontAutoOff : (existing ? existing.dontAutoOff : false)
        };
      });
      // Determine removed switches (by id or name fallback)
      removedSwitches = oldSwitchesSnapshot.filter(osw => !device.switches.some(nsw => (osw._id && nsw._id && osw._id.toString() === nsw._id.toString()) || (osw.name && nsw.name && osw.name === nsw.name)));
      // Attach warnings to response later
      req._switchWarnings = warnings;
    }

    device.lastModifiedBy = req.user.id;
    await device.save();

    // Log activity with new action
    try {
      await ActivityLog.create({
        deviceId: device._id,
        deviceName: device.name,
        action: 'device_updated',
        triggeredBy: 'user',
        userId: req.user.id,
        userName: req.user.name,
        classroom: device.classroom,
        location: device.location,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (logErr) {
      if (process.env.NODE_ENV !== 'production') console.warn('[deviceController] activity log failed', logErr.message);
    }

    const emitDeviceStateChanged = req.app.get('emitDeviceStateChanged');
    if (emitDeviceStateChanged) {
      emitDeviceStateChanged(device, { source: 'controller:updateDevice' });
    } else {
      req.app.get('io').emit('device_state_changed', { deviceId: device.id, state: device, ts: Date.now() });
    }

    // Emit notification to all connected users with appropriate permissions
    if (req.app.get('io')) {
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.notifyDeviceStatusChange(device._id, 'updated', device.name, device.location);
      } else {
        req.app.get('io').emit('device_notification', {
          type: 'device_updated',
          message: `Device "${device.name}" was updated in ${device.location}`,
          deviceId: device._id,
          deviceName: device.name,
          location: device.location,
          metadata: {
            deviceId: device._id,
            deviceName: device.name,
            deviceLocation: device.location,
            deviceClassroom: device.classroom,
            updatedBy: req.user.name,
            switchCount: device.switches.length
          },
          timestamp: new Date()
        });
      }
    }

    // If any switches were removed, proactively send OFF command for their relay gpios to ensure hardware deactivates them
    try {
      if (removedSwitches.length && global.wsDevices && device.macAddress) {
        const ws = global.wsDevices.get(device.macAddress.toUpperCase());
        if (ws && ws.readyState === 1) {
          removedSwitches.forEach(rsw => {
            const gpio = rsw.relayGpio || rsw.gpio;
            if (gpio !== undefined) {
              try {
                logger.info('[hw] switch_command (removed->OFF) push', { mac: device.macAddress, gpio, state: false });
              } catch { }
              ws.send(JSON.stringify({ type: 'switch_command', mac: device.macAddress, gpio, state: false, removed: true, seq: nextCmdSeq(device.macAddress) }));
            }
          });
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[removedSwitches off push failed]', e.message);
    }

    // Broadcast updated configuration (mirrors createDevice flow) so frontend & firmware can reconcile list
    try {
      const cfgMsg = {
        type: 'config_update',
        deviceId: device.id,
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
      req.app.get('io').emit('config_update', cfgMsg);
      if (global.wsDevices && device.macAddress) {
        const ws = global.wsDevices.get(device.macAddress.toUpperCase());
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(cfgMsg));
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[config_update emit failed updateDevice]', e.message);
    }

    res.json({
      success: true,
      message: 'Device updated successfully',
      data: device,
      warnings: req._switchWarnings || []
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const toggleSwitch = async (req, res) => {
  try {
    const { deviceId, switchId } = req.params;
    const { state, triggeredBy = 'user' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check device connectivity with consistent logic
    const isDeviceOnline = () => {
      // First check WebSocket connection (most reliable)
      if (process.env.NODE_ENV !== 'test') {
        try {
          const ws = global.wsDevices && device.macAddress ? global.wsDevices.get(device.macAddress.toUpperCase()) : null;
          if (ws && ws.readyState === 1) {
            return true; // WebSocket is connected
          }
        } catch (e) {
          console.warn('[toggleSwitch] WebSocket check error:', e.message);
        }
      }

      // Fallback to database status with time-based validation
      if (device.status === 'online' && device.lastSeen) {
        const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime();
        const offlineThreshold = 2 * 60 * 1000; // 2 minutes
        return timeSinceLastSeen < offlineThreshold;
      }

      return false;
    };

    const deviceOnline = isDeviceOnline();

    // Block toggle if device is offline to ensure consistency with UI
    if (!deviceOnline) {
      // queue intent instead of hard blocking
      const targetSw = device.switches.find(sw => sw._id.toString() === switchId);
      if (!targetSw) return res.status(404).json({ message: 'Switch not found' });
      const desired = state !== undefined ? state : !targetSw.state;
      // replace any existing intent for same gpio
      device.queuedIntents = (device.queuedIntents || []).filter(q => q.switchGpio !== (targetSw.relayGpio || targetSw.gpio));
      device.queuedIntents.push({ switchGpio: targetSw.relayGpio || targetSw.gpio, desiredState: desired, createdAt: new Date() });
      await device.save();
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[toggleSwitch] queued intent while offline', {
          deviceId: device._id.toString(), mac: device.macAddress, switchId, desired,
          lastSeen: device.lastSeen, status: device.status
        });
      }
      try { req.app.get('io').emit('device_toggle_queued', { deviceId, switchId, desired }); } catch { }
      return res.status(202).json({ message: 'Device offline. Toggle queued.', queued: true });
    }

    const switchIndex = device.switches.findIndex(sw => sw._id.toString() === switchId);
    if (switchIndex === -1) {
      return res.status(404).json({ message: 'Switch not found' });
    }

    // Compute desired state based on current snapshot, but persist atomically
    const desiredState = state !== undefined ? state : !device.switches[switchIndex].state;
    const now = new Date();
    const updated = await Device.findOneAndUpdate(
      { _id: deviceId, 'switches._id': switchId },
      { $set: { 'switches.$.state': desiredState, 'switches.$.lastStateChange': now, lastModifiedBy: req.user.id } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Switch not found' });
    }

    // Log activity
    // Resolve updated switch for logging and push
    const updatedSwitch = updated.switches.find(sw => sw._id.toString() === switchId) || updated.switches[switchIndex];
    await ActivityLog.create({
      deviceId: updated._id,
      deviceName: updated.name,
      switchId: switchId,
      switchName: updatedSwitch?.name,
      action: desiredState ? 'on' : 'off',
      triggeredBy,
      userId: req.user.id,
      userName: req.user.name,
      classroom: updated.classroom,
      location: updated.location,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Do not broadcast device_state_changed immediately to avoid UI desync if hardware fails.
    // Instead, emit a lightweight intent event; authoritative updates will come from switch_result/state_update.
    try {
      req.app.get('io').emit('switch_intent', {
        deviceId: updated.id,
        switchId,
        gpio: (updatedSwitch && (updatedSwitch.relayGpio || updatedSwitch.gpio)) || (device.switches[switchIndex].relayGpio || device.switches[switchIndex].gpio),
        desiredState,
        ts: Date.now()
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[switch_intent emit failed]', e.message);
    }

    // Push command to ESP32 if connected through raw WebSocket
    let dispatchedToHardware = false;
    let hwReason = 'not_attempted';
    try {
      if (global.wsDevices && updated.macAddress) {
        const ws = global.wsDevices.get(updated.macAddress.toUpperCase());
        if (ws && ws.readyState === 1) { // OPEN
          const payload = {
            type: 'switch_command',
            mac: updated.macAddress,
            gpio: (updatedSwitch && (updatedSwitch.relayGpio || updatedSwitch.gpio)) || (device.switches[switchIndex].relayGpio || device.switches[switchIndex].gpio),
            state: desiredState,
            seq: nextCmdSeq(updated.macAddress)
          };
          try {
            logger.info('[hw] switch_command push', { mac: updated.macAddress, gpio: payload.gpio, state: payload.state, deviceId: updated._id.toString(), switchId });
          } catch { }
          ws.send(JSON.stringify(payload));
          dispatchedToHardware = true;
          hwReason = 'sent';
        } else {
          hwReason = ws ? `ws_not_open_state_${ws.readyState}` : 'ws_not_found';
        }
      } else {
        hwReason = 'wsDevices_map_missing';
      }
    } catch (e) {
      console.error('[switch_command push failed]', e.message);
      hwReason = 'exception_' + e.message;
    }

    res.json({
      success: true,
      data: updated,
      hardwareDispatch: dispatchedToHardware,
      hardwareDispatchReason: hwReason
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getDeviceStats = async (req, res) => {
  try {
    const matchQuery = buildDeviceAccessQuery(req.user);
    if (matchQuery === null) {
      return res.json({
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        totalSwitches: 0,
        switchesOn: 0,
        switchesOff: 0,
        pirEnabled: 0,
        pirTriggered: 0
      });
    }

    const devices = await Device.find(matchQuery)
      .select('status switches pirEnabled pirGpio pirAutoOffDelay pirSensorLastTriggered')
      .lean();

    const now = Date.now();
    const toMs = (s) => Math.max(0, ((typeof s === 'number' ? s : 30) || 30) * 1000);

    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const totalSwitches = devices.reduce((sum, d) => sum + (Array.isArray(d.switches) ? d.switches.length : 0), 0);
    const activeSwitches = devices.reduce((sum, d) => {
      if (d.status !== 'online') return sum;
      const on = (Array.isArray(d.switches) ? d.switches : []).filter(sw => !!sw.state).length;
      return sum + on;
    }, 0);
    const totalPirSensors = devices.filter(d => d.pirEnabled === true && d.pirGpio !== undefined && d.pirGpio !== null).length;
    const activePirSensors = devices.filter(d => {
      if (!(d.pirEnabled === true && d.pirGpio !== undefined && d.pirGpio !== null)) return false;
      const last = d.pirSensorLastTriggered ? new Date(d.pirSensorLastTriggered).getTime() : 0;
      const windowMs = toMs(d.pirAutoOffDelay);
      return last && (now - last) <= windowMs;
    }).length;

    res.json({
      success: true,
      data: {
        totalDevices,
        onlineDevices,
        totalSwitches,
        activeSwitches,
        totalPirSensors,
        activePirSensors
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getDeviceById = async (req, res) => {
  try {
    // If admin wants secret, explicitly select it
    const includeSecret = req.query.includeSecret === '1' || req.query.includeSecret === 'true';
    let query = Device.findById(req.params.deviceId);
    if (includeSecret && req.user && (req.user.role === 'admin' || req.user.role === 'super-admin')) {
      query = query.select('+deviceSecret');
    }
    let device = await query;
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    // Optional PIN gate for secret (set DEVICE_SECRET_PIN in env). If set, must match ?secretPin=.
    if (includeSecret && req.user && (req.user.role === 'admin' || req.user.role === 'super-admin')) {
      const requiredPin = process.env.DEVICE_SECRET_PIN;
      if (requiredPin && (req.query.secretPin !== requiredPin)) {
        return res.status(403).json({ message: 'Invalid PIN' });
      }
    }
    // Auto-generate a secret if missing and admin requested it
    if (includeSecret && req.user && (req.user.role === 'admin' || req.user.role === 'super-admin') && !device.deviceSecret) {
      const crypto = require('crypto');
      device.deviceSecret = crypto.randomBytes(24).toString('hex');
      await device.save();
    }
    // Avoid leaking secret unless explicitly requested
    const raw = device.toObject();
    if (!(includeSecret && req.user && (req.user.role === 'admin' || req.user.role === 'super-admin'))) {
      delete raw.deviceSecret;
    }
    res.json({ success: true, data: raw, deviceSecret: includeSecret && req.user && (req.user.role === 'admin' || req.user.role === 'super-admin') ? raw.deviceSecret : undefined });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    await device.deleteOne();

    await ActivityLog.create({
      deviceId: device._id,
      deviceName: device.name,
      action: 'device_deleted',
      triggeredBy: 'user',
      userId: req.user.id,
      userName: req.user.name,
      classroom: device.classroom,
      location: device.location,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const emitDeviceStateChanged = req.app.get('emitDeviceStateChanged');
    if (emitDeviceStateChanged) {
      emitDeviceStateChanged({ id: device.id, deleted: true }, { source: 'controller:deleteDevice' });
    } else {
      req.app.get('io').emit('device_state_changed', { deviceId: device.id, deleted: true, ts: Date.now() });
    }

    // Emit notification to all connected users with appropriate permissions
    if (req.app.get('io')) {
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.notifyDeviceStatusChange(device._id, 'deleted', device.name, device.location);
      } else {
        req.app.get('io').emit('device_notification', {
          type: 'device_deleted',
          message: `Device "${device.name}" was deleted from ${device.location}`,
          deviceId: device._id,
          deviceName: device.name,
          location: device.location,
          metadata: {
            deviceId: device._id,
            deviceName: device.name,
            deviceLocation: device.location,
            deviceClassroom: device.classroom,
            deletedBy: req.user.name,
            switchCount: device.switches.length
          },
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Bulk toggle all switches (or all accessible devices for non-admin roles)
const bulkToggleSwitches = async (req, res) => {
  try {
    const { state } = req.body; // required boolean
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'state boolean required' });
    }

    // Scope devices based on user role using the same logic as getAllDevices
    const match = buildDeviceAccessQuery(req.user);
    if (match === null) {
      return res.status(403).json({ message: 'No devices accessible for bulk operations' });
    }

    const devices = await Device.find(match);
    let switchesChanged = 0;
    let devicesCommanded = 0;
    let devicesOffline = 0;
    const offlineDevices = [];
    const commandedDevices = [];

    for (const device of devices) {
      let deviceModified = false;
      device.switches.forEach(sw => {
        if (sw.state !== state) {
          sw.state = state;
          deviceModified = true;
          switchesChanged++;
        }
      });

      if (deviceModified) {
        await device.save();

        // Check if device is online (has active WebSocket connection)
        const isDeviceOnline = () => {
          if (global.wsDevices && device.macAddress) {
            const ws = global.wsDevices.get(device.macAddress.toUpperCase());
            return ws && ws.readyState === 1;
          }
          return false;
        };

        const deviceOnline = isDeviceOnline();

        if (deviceOnline) {
          // Device is online, send command immediately
          try {
            const ws = global.wsDevices.get(device.macAddress.toUpperCase());
            for (const sw of device.switches) {
              const payload = {
                type: 'switch_command',
                mac: device.macAddress,
                gpio: sw.relayGpio || sw.gpio,
                state: sw.state,
                seq: nextCmdSeq(device.macAddress)
              };
              ws.send(JSON.stringify(payload));
              logger.info('[hw] switch_command (bulk) push', {
                mac: device.macAddress,
                gpio: payload.gpio,
                state: payload.state,
                deviceId: device._id.toString()
              });
            }
            devicesCommanded++;
            commandedDevices.push({
              id: device._id,
              name: device.name,
              macAddress: device.macAddress,
              switches: device.switches.length
            });
          } catch (e) {
            logger.error('[bulkToggleSwitches] WS command failed for online device', {
              deviceId: device._id.toString(),
              mac: device.macAddress,
              error: e.message
            });
            // Queue the command for later delivery
            device.queuedIntents = (device.queuedIntents || []).filter(q => q.gpio !== (device.switches[0]?.relayGpio || device.switches[0]?.gpio));
            device.queuedIntents.push({
              gpio: device.switches[0]?.relayGpio || device.switches[0]?.gpio,
              desiredState: state,
              createdAt: new Date(),
              bulkOperation: true
            });
            await device.save();
          }
        } else {
          // Device is offline, queue the command for when it comes back online
          logger.info('[bulkToggleSwitches] queuing command for offline device', {
            deviceId: device._id.toString(),
            mac: device.macAddress,
            state
          });

          // Clear any existing queued intents for these switches
          device.queuedIntents = (device.queuedIntents || []).filter(q =>
            !device.switches.some(sw => (sw.relayGpio || sw.gpio) === q.gpio)
          );

          // Queue new intents for all switches
          device.switches.forEach(sw => {
            device.queuedIntents.push({
              gpio: sw.relayGpio || sw.gpio,
              desiredState: state,
              createdAt: new Date(),
              bulkOperation: true
            });
          });

          await device.save();
          devicesOffline++;
          offlineDevices.push({
            id: device._id,
            name: device.name,
            macAddress: device.macAddress,
            switches: device.switches.length,
            lastSeen: device.lastSeen
          });
        }

        // Log one aggregated activity entry per device to limit log volume
        try {
          await ActivityLog.create({
            deviceId: device._id,
            deviceName: device.name,
            action: state ? 'bulk_on' : 'bulk_off',
            triggeredBy: 'user',
            userId: req.user.id,
            userName: req.user.name,
            classroom: device.classroom,
            location: device.location,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            details: deviceOnline ? 'Command sent to device' : 'Command queued for offline device'
          });
        } catch (logErr) {
          if (process.env.NODE_ENV !== 'production') console.warn('[bulkToggleSwitches] log failed', logErr.message);
        }
      }
    }

    // Emit a bulk intent so UI can show pending without flipping state
    try {
      const affectedIds = devices.filter(d => d.switches.some(sw => true)).map(d => d._id.toString());
      req.app.get('io').emit('bulk_switch_intent', {
        desiredState: state,
        deviceIds: affectedIds,
        commandedDevices: commandedDevices.length,
        offlineDevices: offlineDevices.length,
        ts: Date.now()
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[bulkToggleSwitches bulk_switch_intent emit failed]', e.message);
    }

    // Emit notification about bulk operation results
    try {
      const socketService = req.app.get('socketService');
      if (socketService && typeof socketService.notifyBulkOperation === 'function') {
        const results = commandedDevices.map(device => ({
          deviceId: device.id,
          deviceName: device.name,
          success: true,
          switchesChanged: device.switches.length
        })).concat(offlineDevices.map(device => ({
          deviceId: device.id,
          deviceName: device.name,
          success: false,
          reason: 'device_offline'
        })));

        socketService.notifyBulkOperation(
          req.user.id,
          'bulk_toggle',
          results,
          devices.length
        );
      } else {
        req.app.get('io').emit('bulk_operation_complete', {
          operation: 'master_toggle',
          desiredState: state,
          totalDevices: devices.length,
          commandedDevices: commandedDevices.length,
          offlineDevices: offlineDevices.length,
          switchesChanged,
          offlineDeviceList: offlineDevices,
          timestamp: new Date()
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[bulkToggleSwitches notification emit failed]', e.message);
    }

    const message = `Bulk toggled switches ${state ? 'on' : 'off'}. ${devicesCommanded} devices commanded, ${devicesOffline} devices offline (commands queued).`;

    logger.info('[bulkToggleSwitches] completed', {
      totalDevices: devices.length,
      commandedDevices: devicesCommanded,
      offlineDevices: devicesOffline,
      switchesChanged,
      state
    });

    res.json({
      success: true,
      message,
      devices: devices.length,
      commandedDevices: devicesCommanded,
      offlineDevices: devicesOffline,
      switchesChanged,
      offlineDeviceList: offlineDevices,
      commandedDeviceList: commandedDevices
    });
  } catch (error) {
    logger.error('[bulkToggleSwitches] error', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Bulk toggle by switch type
const bulkToggleByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { state } = req.body;
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'state boolean required' });
    }
    const match = buildDeviceAccessQuery(req.user);
    if (match === null) {
      return res.status(403).json({ message: 'No devices accessible for bulk operations' });
    }
    const devices = await Device.find(match);
    logger.info(`[bulkToggleByType] Found ${devices.length} devices for type ${type}, state ${state}`);
    let switchesChanged = 0;
    let devicesModified = 0;
    for (const device of devices) {
      try {
        let modified = false;
        device.switches.forEach(sw => {
          if (sw.type === type && sw.state !== state) {
            sw.state = state;
            switchesChanged++;
            modified = true;
          }
        });
        if (modified) {
          await device.save();
          devicesModified++;
          try {
            await ActivityLog.create({
              deviceId: device._id,
              deviceName: device.name,
              action: state ? 'bulk_on' : 'bulk_off',
              triggeredBy: 'user',
              userId: req.user.id,
              userName: req.user.name,
              classroom: device.classroom,
              location: device.location
            });
          } catch (logErr) {
            logger.warn(`[bulkToggleByType] Activity log failed for device ${device._id}: ${logErr.message}`);
          }
          // Do NOT emit device_state_changed here; wait for hardware confirmation
          // Push commands to ESP32 so physical relays reflect type-based bulk change
          try {
            if (global.wsDevices && device.macAddress) {
              const ws = global.wsDevices.get(device.macAddress.toUpperCase());
              if (ws && ws.readyState === 1) {
                for (const sw of device.switches.filter(sw => sw.type === type)) {
                  const payload = { type: 'switch_command', mac: device.macAddress, gpio: sw.relayGpio || sw.gpio, state: sw.state, seq: nextCmdSeq(device.macAddress) };
                  ws.send(JSON.stringify(payload));
                }
              }
            }
          } catch (e) {
            logger.warn(`[bulkToggleByType] WS push failed for device ${device.macAddress}: ${e.message}`);
          }
        }
      } catch (deviceErr) {
        logger.error(`[bulkToggleByType] Error processing device ${device._id}: ${deviceErr.message}`);
        // Continue with other devices
      }
    }
    try {
      const ids = devices.map(d => d._id.toString());
      req.app.get('io').emit('bulk_switch_intent', { desiredState: state, deviceIds: ids, filter: { type }, ts: Date.now() });
    } catch (emitErr) {
      logger.warn(`[bulkToggleByType] Emit failed: ${emitErr.message}`);
    }
    logger.info(`[bulkToggleByType] Completed: ${devicesModified} devices modified, ${switchesChanged} switches changed`);
    res.json({ success: true, type, state, switchesChanged, devicesModified });
  } catch (error) {
    logger.error(`[bulkToggleByType] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Bulk toggle by location
const bulkToggleByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { state } = req.body;
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'state boolean required' });
    }
    
    // Build base access query
    const accessQuery = buildDeviceAccessQuery(req.user);
    if (accessQuery === null) {
      return res.status(403).json({ message: 'No devices accessible for bulk operations' });
    }
    
    // Combine access control with location filter
    const match = { ...accessQuery, location };
    const devices = await Device.find(match);
    let switchesChanged = 0;
    for (const device of devices) {
      let modified = false;
      device.switches.forEach(sw => {
        if (sw.state !== state) {
          sw.state = state;
          switchesChanged++;
          modified = true;
        }
      });
      if (modified) {
        await device.save();
        try {
          await ActivityLog.create({
            deviceId: device._id,
            deviceName: device.name,
            action: state ? 'bulk_on' : 'bulk_off',
            triggeredBy: 'user',
            userId: req.user.id,
            userName: req.user.name,
            classroom: device.classroom,
            location: device.location
          });
        } catch { }
        // Do NOT emit device_state_changed here; wait for hardware confirmation
        // Push commands to ESP32 so physical relays reflect location-based bulk change
        try {
          if (global.wsDevices && device.macAddress) {
            const ws = global.wsDevices.get(device.macAddress.toUpperCase());
            if (ws && ws.readyState === 1) {
              for (const sw of device.switches) {
                const payload = { type: 'switch_command', mac: device.macAddress, gpio: sw.relayGpio || sw.gpio, state: sw.state, seq: nextCmdSeq(device.macAddress) };
                ws.send(JSON.stringify(payload));
              }
            }
          }
        } catch (e) { if (process.env.NODE_ENV !== 'production') console.warn('[bulkToggleByLocation push failed]', e.message); }
      }
    }
    try {
      const ids = devices.map(d => d._id.toString());
      req.app.get('io').emit('bulk_switch_intent', { desiredState: state, deviceIds: ids, filter: { location }, ts: Date.now() });
    } catch { }
    res.json({ success: true, location, state, switchesChanged });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Control device settings (brightness, fan speed, etc.)
const controlDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { brightness, fanSpeed, inputSource } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Update device settings
    const updates = {};
    if (brightness !== undefined) updates.brightness = brightness;
    if (fanSpeed !== undefined) updates.fanSpeed = fanSpeed;
    if (inputSource !== undefined) updates.inputSource = inputSource;

    const updatedDevice = await Device.findByIdAndUpdate(deviceId, updates, { new: true });

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'DEVICE_CONTROL',
      details: `Controlled device ${device.name}: ${JSON.stringify(updates)}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Device controlled successfully',
      device: updatedDevice
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Schedule device operations
const scheduleDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { schedule } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Here you would implement scheduling logic
    // For now, just return success
    res.json({
      success: true,
      message: 'Device scheduled successfully',
      deviceId,
      schedule
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get device history/logs
const getDeviceHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Get activity logs for this device
    const logs = await ActivityLog.find({
      details: { $regex: deviceId, $options: 'i' }
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ActivityLog.countDocuments({
      details: { $regex: deviceId, $options: 'i' }
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Configure PIR sensor
const configurePir = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { sensitivity, timeout, enabled } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Update PIR configuration
    const pirConfig = {
      sensitivity: sensitivity || device.pirConfig?.sensitivity || 50,
      timeout: timeout || device.pirConfig?.timeout || 30,
      enabled: enabled !== undefined ? enabled : device.pirConfig?.enabled || true
    };

    const updatedDevice = await Device.findByIdAndUpdate(deviceId, {
      pirConfig
    }, { new: true });

    res.json({
      success: true,
      message: 'PIR sensor configured successfully',
      device: updatedDevice
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get PIR sensor data
const getPirData = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Here you would query PIR sensor data from database
    // For now, return mock data
    const mockPirData = {
      deviceId,
      deviceName: device.name,
      data: [
        {
          timestamp: new Date(),
          motionDetected: true,
          sensorValue: 85
        }
      ],
      totalRecords: 1
    };

    res.json({
      success: true,
      data: mockPirData
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get GPIO pin information and validation
const getGpioPinInfo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { includeUsed = 'true' } = req.query;

    let device = null;
    if (deviceId && deviceId !== 'new') {
      device = await Device.findById(deviceId);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
    }

    // Get all used pins for this device
    const usedPins = new Set();
    if (device) {
      device.switches.forEach(sw => {
        usedPins.add(sw.gpio);
        if (sw.manualSwitchEnabled && sw.manualSwitchGpio !== undefined) {
          usedPins.add(sw.manualSwitchGpio);
        }
      });
      if (device.pirEnabled && device.pirGpio !== undefined) {
        usedPins.add(device.pirGpio);
      }
    }

    // Generate pin information
    const pins = [];
    for (let pin = 0; pin <= 39; pin++) {
      const status = gpioUtils.getGpioPinStatus(pin);
      const isUsed = usedPins.has(pin);

      pins.push({
        pin,
        ...status,
        used: isUsed,
        available: status.safe && !isUsed
      });
    }

    // Group pins by status
    const grouped = {
      safe: pins.filter(p => p.status === 'safe'),
      problematic: pins.filter(p => p.status === 'problematic'),
      reserved: pins.filter(p => p.status === 'reserved'),
      used: pins.filter(p => p.used),
      available: pins.filter(p => p.available)
    };

    // Recommended safe pins for different purposes
    const recommendations = {
      relayPins: gpioUtils.getRecommendedPins('relay'),
      manualPins: gpioUtils.getRecommendedPins('manual'),
      pirPins: gpioUtils.getRecommendedPins('pir')
    };

    res.json({
      success: true,
      data: {
        pins,
        grouped,
        recommendations,
        summary: {
          totalPins: pins.length,
          safePins: grouped.safe.length,
          problematicPins: grouped.problematic.length,
          reservedPins: grouped.reserved.length,
          usedPins: grouped.used.length,
          availablePins: grouped.available.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Validate GPIO pin configuration
const validateGpioConfig = async (req, res) => {
  try {
    const { switches = [], pirEnabled = false, pirGpio } = req.body;

    const errors = [];
    const warnings = [];
    const usedPins = new Set();

    // Validate switches
    switches.forEach((sw, index) => {
      const switchNum = index + 1;

      // Check relay GPIO
      if (sw.gpio !== undefined) {
        if (usedPins.has(sw.gpio)) {
          errors.push(`Switch ${switchNum}: GPIO ${sw.gpio} is already used`);
        } else {
          usedPins.add(sw.gpio);
          const status = gpioUtils.getGpioPinStatus(sw.gpio);
          if (!status.safe) {
            if (status.status === 'problematic') {
              warnings.push(`Switch ${switchNum}: GPIO ${sw.gpio} may cause ESP32 boot issues`);
            } else {
              errors.push(`Switch ${switchNum}: GPIO ${sw.gpio} is ${status.status} (${status.reason})`);
            }
          }
        }
      }

      // Check manual switch GPIO
      if (sw.manualSwitchEnabled && sw.manualSwitchGpio !== undefined) {
        if (usedPins.has(sw.manualSwitchGpio)) {
          errors.push(`Switch ${switchNum}: Manual GPIO ${sw.manualSwitchGpio} is already used`);
        } else {
          usedPins.add(sw.manualSwitchGpio);
          const status = gpioUtils.getGpioPinStatus(sw.manualSwitchGpio);
          if (!status.safe) {
            if (status.status === 'problematic') {
              warnings.push(`Switch ${switchNum}: Manual GPIO ${sw.manualSwitchGpio} may cause ESP32 boot issues`);
            } else {
              errors.push(`Switch ${switchNum}: Manual GPIO ${sw.manualSwitchGpio} is ${status.status} (${status.reason})`);
            }
          }
        }
      }
    });

    // Validate PIR GPIO
    if (pirEnabled && pirGpio !== undefined) {
      if (usedPins.has(pirGpio)) {
        errors.push(`PIR: GPIO ${pirGpio} is already used`);
      } else {
        const status = gpioUtils.getGpioPinStatus(pirGpio);
        if (!status.safe) {
          if (status.status === 'problematic') {
            warnings.push(`PIR: GPIO ${pirGpio} may cause ESP32 boot issues`);
          } else {
            errors.push(`PIR: GPIO ${pirGpio} is ${status.status} (${status.reason})`);
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalSwitches: switches.length,
          errors: errors.length,
          warnings: warnings.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllDevices,
  createDevice,
  toggleSwitch,
  getDeviceStats,
  getDeviceById,
  updateDevice,
  deleteDevice,
  bulkToggleSwitches,
  bulkToggleByType,
  bulkToggleByLocation,
  controlDevice,
  scheduleDevice,
  getDeviceHistory,
  configurePir,
  getPirData,
  getGpioPinInfo,
  validateGpioConfig
};
