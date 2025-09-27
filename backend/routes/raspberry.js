const express = require('express');
const router = express.Router();
const { io } = require('../server'); // Import Socket.IO instance

// Raspberry Pi endpoints
router.get('/config/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    // Get Raspberry Pi device configuration from database
    const Device = require('../models/Device');
    const device = await Device.findOne({ deviceId, deviceType: 'raspberry_pi' });

    if (!device) {
      return res.status(404).json({ error: 'Raspberry Pi device not found' });
    }

    res.json({
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      gpioConfig: device.gpioConfig || [],
      sensors: device.sensors || [],
      actuators: device.actuators || []
    });
  } catch (error) {
    console.error('Error fetching Raspberry Pi config:', error);
    res.status(500).json({ error: 'Failed to fetch device configuration' });
  }
});

router.post('/command/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, params } = req.body;

    // Send command via WebSocket instead of MQTT
    const raspberryWsDevices = global.raspberryWsDevices;
    const ws = raspberryWsDevices.get(deviceId);

    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      const message = {
        type: 'command',
        command,
        params,
        timestamp: new Date().toISOString()
      };

      ws.send(JSON.stringify(message));

      // Emit real-time update via Socket.IO
      io.emit('raspberry_command_sent', { deviceId, command, params });

      res.json({ success: true, message: 'Command sent to Raspberry Pi via WebSocket' });
    } else {
      res.status(503).json({ error: 'Raspberry Pi WebSocket not connected' });
    }
  } catch (error) {
    console.error('Error sending Raspberry Pi command:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

router.post('/gpio/:deviceId/:pin/:state', async (req, res) => {
  try {
    const { deviceId, pin, state } = req.params;

    // Validate state
    if (!['on', 'off', '1', '0', 'true', 'false'].includes(state.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid state. Use: on/off, 1/0, true/false' });
    }

    // Convert state to boolean
    const gpioState = ['on', '1', 'true'].includes(state.toLowerCase());

    // Send GPIO command via WebSocket instead of MQTT
    const raspberryWsDevices = global.raspberryWsDevices;
    const ws = raspberryWsDevices.get(deviceId);

    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      const message = {
        type: 'gpio_command',
        pin: parseInt(pin),
        state: gpioState,
        timestamp: new Date().toISOString()
      };

      ws.send(JSON.stringify(message));

      // Update device state in database
      const Device = require('../models/Device');
      Device.findOneAndUpdate(
        { deviceId, deviceType: 'raspberry_pi' },
        {
          $set: {
            [`gpioStates.${pin}`]: gpioState,
            lastSeen: new Date()
          }
        },
        { upsert: false }
      ).exec();

      // Emit real-time update
      io.emit('gpio_state_changed', { deviceId, pin, state: gpioState });

      res.json({
        success: true,
        deviceId,
        pin: parseInt(pin),
        state: gpioState
      });
    } else {
      res.status(503).json({ error: 'Raspberry Pi WebSocket not connected' });
    }
  } catch (error) {
    console.error('Error controlling Raspberry Pi GPIO:', error);
    res.status(500).json({ error: 'Failed to control GPIO' });
  }
});

module.exports = router;