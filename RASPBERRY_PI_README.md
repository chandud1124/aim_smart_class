# Raspberry Pi Integration Guide (WebSocket)

This guide explains how to connect Raspberry Pi devices to your IoT Classroom System using WebSockets for faster, more reliable communication.

## Overview

Your system now supports Raspberry Pi devices alongside ESP32 devices using WebSocket connections instead of MQTT for better external connectivity and speed.

- **ESP32**: WebSocket (`/esp32-ws`)
- **Raspberry Pi**: WebSocket (`/raspberry-ws`)

## Architecture

```
Raspberry Pi ──WebSocket──► Server ←─────WebSocket────► ESP32
     ↑                           ↑
     └─────────HTTP API─────────┘
```

## Quick Start

### 1. Server Setup

The server has been updated to support Raspberry Pi WebSocket connections. The changes include:

- New WebSocket endpoint: `/raspberry-ws`
- Updated API routes for WebSocket communication
- Real-time Socket.IO integration

### 2. Raspberry Pi Setup

#### Option A: Automated Setup
```bash
# On your Raspberry Pi
wget https://raw.githubusercontent.com/your-repo/setup_raspberry_pi.sh
chmod +x setup_raspberry_pi.sh
sudo ./setup_raspberry_pi.sh
```

#### Option B: Manual Setup
```bash
# Install dependencies
pip3 install websockets RPi.GPIO psutil

# Copy the client script
scp raspberry_pi_client.py pi@raspberry-pi:/home/pi/

# Edit configuration in raspberry_pi_client.py
nano raspberry_pi_client.py
# Update WS_SERVER IP address
# Configure DEVICE_ID and GPIO_PINS
```

### 3. Configuration

Edit `raspberry_pi_client.py` to match your setup:

```python
# Update these values
WS_SERVER = "ws://192.168.1.100:3001/raspberry-ws"  # Your server WebSocket endpoint
DEVICE_ID = "raspberry_001"    # Unique identifier
DEVICE_SECRET = "your_device_secret_here"  # Optional authentication

# Configure your GPIO pins
GPIO_PINS = {
    17: {'name': 'relay_1', 'mode': GPIO.OUT, 'initial': GPIO.LOW},
    18: {'name': 'relay_2', 'mode': GPIO.OUT, 'initial': GPIO.LOW},
    23: {'name': 'motion_sensor', 'mode': GPIO.IN, 'pull_up_down': GPIO.PUD_DOWN}
}
```

## WebSocket Communication

### Message Types

#### Client → Server
- `identify` - Device identification
- `status` - Device status updates
- `sensor` - Sensor data
- `gpio_ack` - GPIO command acknowledgment
- `gpio_state` - GPIO state changes

#### Server → Client
- `identified` - Identification confirmation
- `command` - General commands
- `gpio_command` - GPIO control commands
- `config_update` - Configuration updates
- `error` - Error messages

## API Endpoints

### Get Device Configuration
```http
GET /api/raspberry/config/{deviceId}
```

### Send Command
```http
POST /api/raspberry/command/{deviceId}
Content-Type: application/json

{
  "command": "get_status",
  "params": {}
}
```

### Control GPIO
```http
POST /api/raspberry/gpio/{deviceId}/{pin}/{state}
```

Example:
```bash
curl -X POST http://localhost:3001/api/raspberry/gpio/raspberry_001/17/on
```

## Why WebSockets Instead of MQTT?

**WebSockets provide:**
- ✅ **Faster connections** - Direct TCP connection
- ✅ **Better external access** - Works through firewalls/proxies
- ✅ **Real-time communication** - Lower latency
- ✅ **Simpler protocol** - No broker required
- ✅ **Consistent with ESP32** - Same communication method

## GPIO Control Examples

### Control Relay
```bash
# Turn relay on GPIO 17 ON
curl -X POST http://localhost:3001/api/raspberry/gpio/raspberry_001/17/on

# Turn relay OFF
curl -X POST http://localhost:3001/api/raspberry/gpio/raspberry_001/17/off
```

### Read Sensor
```bash
# The Raspberry Pi automatically publishes sensor data every 30 seconds
# GPIO inputs are included in sensor data
```

## Adding Sensors

### Temperature/Humidity (DHT22)
```python
# Install library
pip3 install adafruit-circuitpython-dht

# Add to raspberry_pi_client.py
import adafruit_dht
import board

# Initialize sensor
dht_device = adafruit_dht.DHT22(board.D4)  # GPIO 4

# Read in sensor_monitoring_loop
temperature = dht_device.temperature
humidity = dht_device.humidity
sensor_data['temperature'] = temperature
sensor_data['humidity'] = humidity
```

### Distance Sensor (HC-SR04)
```python
import RPi.GPIO as GPIO
import time

def measure_distance(trig_pin, echo_pin):
    GPIO.output(trig_pin, True)
    time.sleep(0.00001)
    GPIO.output(echo_pin, False)

    while GPIO.input(echo_pin) == 0:
        pulse_start = time.time()

    while GPIO.input(echo_pin) == 1:
        pulse_end = time.time()

    pulse_duration = pulse_end - pulse_start
    distance = pulse_duration * 17150
    return round(distance, 2)

# Add to GPIO_PINS
GPIO_PINS.update({
    20: {'name': 'ultrasonic_trig', 'mode': GPIO.OUT, 'initial': GPIO.LOW},
    21: {'name': 'ultrasonic_echo', 'mode': GPIO.IN}
})

# Read in sensor_monitoring_loop
distance = measure_distance(20, 21)
sensor_data['distance_cm'] = distance
```

## Database Schema

Add Raspberry Pi devices to your Device collection:

```javascript
{
  deviceId: "raspberry_001",
  name: "Classroom Raspberry Pi",
  location: "Room 101",
  deviceType: "raspberry_pi",
  status: "online",
  lastSeen: new Date(),
  gpioConfig: [
    { pin: 17, name: "relay_1", mode: "output" },
    { pin: 18, name: "relay_2", mode: "output" }
  ],
  gpioStates: {
    "17": false,
    "18": true
  },
  systemInfo: {
    hostname: "raspberrypi",
    ip_address: "192.168.1.101",
    cpu_percent: 15.2,
    memory: { ... },
    temperature: 45.6
  }
}
```

## Troubleshooting

### Connection Issues
```bash
# Check WebSocket connection
python3 -c "
import asyncio
import websockets
async def test():
    try:
        async with websockets.connect('ws://192.168.1.100:3001/raspberry-ws') as ws:
            print('WebSocket connection successful')
    except Exception as e:
        print(f'Connection failed: {e}')
asyncio.run(test())
"

# Test GPIO
python3 -c "import RPi.GPIO as GPIO; GPIO.setmode(GPIO.BCM); GPIO.setup(17, GPIO.OUT); GPIO.output(17, 1); print('GPIO 17 set HIGH')"
```

### Service Management
```bash
# Check service status
sudo systemctl status raspberry-client

# View logs
sudo journalctl -u raspberry-client -f

# Restart service
sudo systemctl restart raspberry-client
```

### Common Issues
1. **WebSocket Connection Failed**: Check IP address and firewall settings
2. **GPIO Permission Denied**: Run as root or add user to gpio group
3. **Import Errors**: Install missing Python packages
4. **Device Not Found**: Ensure device is registered in database

## Performance Comparison

| Feature | MQTT | WebSocket |
|---------|------|-----------|
| Connection Speed | Slower (broker overhead) | Faster (direct TCP) |
| External Access | May require port forwarding | Works through proxies |
| Message Latency | Higher | Lower |
| Connection Reliability | Good | Excellent |
| Setup Complexity | Medium | Simple |

## Security Considerations

1. **WebSocket Security**: Use WSS (WebSocket Secure) in production
2. **Authentication**: Implement device secret validation
3. **Network Security**: Use VPN or restrict WebSocket access
4. **Command Validation**: Whitelist allowed commands
5. **Rate Limiting**: Implement rate limiting for API calls

## Next Steps

1. Test basic WebSocket connectivity
2. Add your specific sensors
3. Integrate with frontend UI
4. Implement security measures
5. Monitor performance vs MQTT

## Migration from MQTT

If you were previously using MQTT, the WebSocket implementation provides the same functionality with better performance:

- **Same GPIO control** - `POST /api/raspberry/gpio/{deviceId}/{pin}/{state}`
- **Same command interface** - `POST /api/raspberry/command/{deviceId}`
- **Same real-time updates** - Socket.IO events unchanged
- **Better reliability** - WebSocket reconnection built-in

Your Raspberry Pi devices will now connect faster and more reliably, especially for external/remote access! 🚀