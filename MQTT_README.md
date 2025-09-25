# MQTT Communication Setup

This project now supports MQTT communication between the ESP32 devices and the backend server using Mosquitto as the broker.

## Prerequisites

1. **Mosquitto MQTT Broker**: Install and run Mosquitto on your system.
   - Download from: https://mosquitto.org/download/
   - Install the Windows binary installer
   - Start the service: `net start mosquitto`

2. **Node.js Dependencies**: MQTT packages are already installed.

## Architecture

```
ESP32 <--MQTT--> Mosquitto Broker <--MQTT--> Backend Server
```

## Topics Used

- `esp32/switches`: Commands from backend to ESP32 (e.g., "relay1:on", "relay2:off")
- `esp32/state`: State updates from ESP32 to backend (e.g., "relay1:on,relay2:off")

## Files Added/Modified

1. **mqtt-broker.js**: Simple Aedes-based MQTT broker (alternative to Mosquitto)
2. **mqtt-client.js**: Backend MQTT client for communication
3. **esp32_mqtt_client.ino**: ESP32 Arduino sketch for MQTT
4. **mqtt-test.js**: Test script for MQTT communication
5. **backend/server.js**: Added MQTT client initialization
6. **backend/routes/devices.js**: Added MQTT switch command endpoint

## Usage

### 1. Start Mosquitto Broker
```bash
net start mosquitto
```

### 2. Start Backend Server
```bash
cd backend
npm start
```

### 3. Flash ESP32 with MQTT Client
- Open `esp32_mqtt_client.ino` in Arduino IDE
- Install PubSubClient library: Sketch > Include Library > Manage Libraries > Search for "PubSubClient"
- Update WiFi credentials and MQTT broker IP
- Upload to ESP32

### 4. Test MQTT Communication
```bash
node mqtt-test.js
```

### 5. Send Commands via API
```bash
# Turn relay1 on
curl -X POST http://localhost:3001/api/devices/mqtt/switch/relay1/on

# Turn relay1 off
curl -X POST http://localhost:3001/api/devices/mqtt/switch/relay1/off
```

## Configuration

- **Broker URL**: `mqtt://localhost:1883` (default Mosquitto port)
- **Client ID**: `backend_server` for backend, `esp32_001` for ESP32
- **Topics**: `esp32/switches` for commands, `esp32/state` for updates

## Troubleshooting

1. **Mosquitto not starting**: Check if port 1883 is available
2. **Connection refused**: Ensure Mosquitto is running and firewall allows port 1883
3. **ESP32 not connecting**: Check WiFi credentials and broker IP address
4. **Messages not received**: Verify topic names match between publisher and subscriber