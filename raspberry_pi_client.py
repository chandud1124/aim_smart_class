#!/usr/bin/env python3
"""
Raspberry Pi WebSocket Client for IoT Classroom System
This script connects a Raspberry Pi to the main server via WebSockets
"""

import asyncio
import websockets
import json
import time
import socket
import psutil
import RPi.GPIO as GPIO
from datetime import datetime
import threading
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
WS_SERVER = "ws://172.16.3.171:3001/raspberry-ws"  # WebSocket endpoint
DEVICE_ID = "raspberry_001"  # Unique device ID
DEVICE_SECRET = "your_device_secret_here"  # Optional authentication

# GPIO Configuration
GPIO_PINS = {
    17: {'name': 'relay_1', 'mode': GPIO.OUT, 'initial': GPIO.LOW},
    18: {'name': 'relay_2', 'mode': GPIO.OUT, 'initial': GPIO.LOW},
    23: {'name': 'motion_sensor', 'mode': GPIO.IN, 'pull_up_down': GPIO.PUD_DOWN}
}

# WebSocket Topics/Events (simulated with message types)
WS_EVENTS = {
    'command': 'command',
    'status': 'status',
    'sensor': 'sensor',
    'gpio': 'gpio',
    'gpio_state': 'gpio_state',
    'gpio_ack': 'gpio_ack'
}

class RaspberryPiWebSocketClient:
    def __init__(self):
        self.device_id = DEVICE_ID
        self.websocket = None
        self.connected = False
        self.last_status_time = 0
        self.reconnect_delay = 1
        self.max_reconnect_delay = 30

        # GPIO Setup
        self.setup_gpio()

        # Status tracking
        self.identified = False

    def setup_gpio(self):
        """Initialize GPIO pins"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

        for pin, config in GPIO_PINS.items():
            if config['mode'] == GPIO.OUT:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, config['initial'])
                logger.info(f"Set up GPIO {pin} as OUTPUT, initial state: {config['initial']}")
            elif config['mode'] == GPIO.IN:
                pull_up_down = config.get('pull_up_down', GPIO.PUD_OFF)
                GPIO.setup(pin, GPIO.IN, pull_up_down=pull_up_down)
                logger.info(f"Set up GPIO {pin} as INPUT")

    async def connect(self):
        """Establish WebSocket connection"""
        while True:
            try:
                logger.info(f"Connecting to WebSocket server: {WS_SERVER}")
                self.websocket = await websockets.connect(WS_SERVER)
                self.connected = True
                self.reconnect_delay = 1
                logger.info("Connected to WebSocket server")

                # Send identification
                await self.send_identification()

                # Start message handling
                await self.handle_messages()

            except Exception as e:
                logger.error(f"WebSocket connection error: {e}")
                self.connected = False
                self.identified = False

                # Exponential backoff for reconnection
                logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

    async def send_identification(self):
        """Send device identification to server"""
        identify_data = {
            'type': 'identify',
            'deviceId': self.device_id,
            'deviceType': 'raspberry_pi',
            'secret': DEVICE_SECRET,
            'timestamp': datetime.now().isoformat()
        }

        await self.send_message(identify_data)
        logger.info("Sent identification to server")

    async def send_message(self, data):
        """Send message via WebSocket"""
        if self.websocket and self.connected:
            try:
                message = json.dumps(data)
                await self.websocket.send(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                self.connected = False

    async def handle_messages(self):
        """Handle incoming WebSocket messages"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
        except Exception as e:
            logger.error(f"Message handling error: {e}")
            self.connected = False

    async def process_message(self, data):
        """Process incoming message"""
        msg_type = data.get('type')
        logger.info(f"Received message type: {msg_type}")

        if msg_type == 'identified':
            self.identified = True
            logger.info("Device identified successfully")
            # Send initial status
            await self.publish_status()

        elif msg_type == 'command':
            await self.handle_command(data)

        elif msg_type == 'gpio_command':
            await self.handle_gpio_command(data)

        elif msg_type == 'config_update':
            await self.handle_config_update(data)

        elif msg_type == 'error':
            logger.error(f"Server error: {data.get('reason', 'unknown')}")

    async def handle_command(self, command):
        """Handle general commands"""
        cmd = command.get('command')
        params = command.get('params', {})

        if cmd == 'get_status':
            await self.publish_status()
        elif cmd == 'restart':
            logger.info("Restart command received")
            # Implement restart logic
        elif cmd == 'update_config':
            logger.info("Configuration update received")
            # Handle configuration updates
        else:
            logger.warning(f"Unknown command: {cmd}")

    async def handle_gpio_command(self, gpio_cmd):
        """Handle GPIO commands"""
        pin = gpio_cmd.get('pin')
        state = gpio_cmd.get('state')

        if pin is not None and state is not None:
            success = self.control_gpio(pin, state)
            # Send acknowledgment
            ack_data = {
                'type': 'gpio_ack',
                'deviceId': self.device_id,
                'pin': pin,
                'requested_state': state,
                'success': success,
                'timestamp': datetime.now().isoformat()
            }
            await self.send_message(ack_data)
        else:
            logger.error("Invalid GPIO command format")

    async def handle_config_update(self, config):
        """Handle configuration updates"""
        logger.info("Received configuration update")
        # Update local configuration if needed
        # This could include GPIO pin configurations, etc.

    def control_gpio(self, pin, state):
        """Control GPIO pin"""
        try:
            pin = int(pin)
            if pin not in GPIO_PINS:
                logger.error(f"GPIO pin {pin} not configured")
                return False

            config = GPIO_PINS[pin]
            if config['mode'] != GPIO.OUT:
                logger.error(f"GPIO pin {pin} is not configured as output")
                return False

            GPIO.output(pin, state)
            logger.info(f"Set GPIO {pin} to {state}")

            # Publish state change
            gpio_data = {
                'type': 'gpio_state',
                'deviceId': self.device_id,
                'pin': pin,
                'state': state,
                'name': config['name'],
                'timestamp': datetime.now().isoformat()
            }
            asyncio.create_task(self.send_message(gpio_data))

            return True
        except Exception as e:
            logger.error(f"Error controlling GPIO {pin}: {e}")
            return False

    async def publish_status(self):
        """Publish device status"""
        if not self.identified:
            return

        status_data = {
            'type': 'status',
            'deviceId': self.device_id,
            'timestamp': datetime.now().isoformat(),
            'status': 'online',
            'system_info': self.get_system_info(),
            'gpio_states': self.get_gpio_states()
        }

        await self.send_message(status_data)
        logger.info("Published status update")
        self.last_status_time = time.time()

    def get_system_info(self):
        """Get system information"""
        try:
            return {
                'hostname': socket.gethostname(),
                'ip_address': self.get_ip_address(),
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory': psutil.virtual_memory()._asdict(),
                'disk': psutil.disk_usage('/')._asdict(),
                'temperature': self.get_cpu_temperature(),
                'uptime': time.time() - psutil.boot_time()
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {}

    def get_ip_address(self):
        """Get the IP address of the Raspberry Pi"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def get_cpu_temperature(self):
        """Get CPU temperature"""
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = float(f.read().strip()) / 1000.0
            return temp
        except Exception:
            return None

    def get_gpio_states(self):
        """Get current GPIO states"""
        states = {}
        for pin, config in GPIO_PINS.items():
            if config['mode'] == GPIO.OUT:
                states[str(pin)] = GPIO.input(pin)
            elif config['mode'] == GPIO.IN:
                states[str(pin)] = GPIO.input(pin)
        return states

    async def publish_sensor_data(self, sensor_data):
        """Publish sensor data"""
        if not self.identified:
            return

        data = {
            'type': 'sensor',
            'deviceId': self.device_id,
            'timestamp': datetime.now().isoformat(),
            'sensors': sensor_data
        }

        await self.send_message(data)
        logger.info(f"Published sensor data: {sensor_data}")

    async def sensor_monitoring_loop(self):
        """Monitor sensors and publish data periodically"""
        while True:
            try:
                # Read sensor data
                sensor_data = {}

                # Example: Read GPIO input pins
                for pin, config in GPIO_PINS.items():
                    if config['mode'] == GPIO.IN:
                        sensor_data[config['name']] = GPIO.input(pin)

                # Add other sensor readings here (temperature, humidity, etc.)
                sensor_data['cpu_temperature'] = self.get_cpu_temperature()

                if sensor_data:
                    await self.publish_sensor_data(sensor_data)

            except Exception as e:
                logger.error(f"Error in sensor monitoring: {e}")

            await asyncio.sleep(30)  # Publish every 30 seconds

    async def status_update_loop(self):
        """Send periodic status updates"""
        while True:
            try:
                if self.identified and self.connected and (time.time() - self.last_status_time) > 60:
                    await self.publish_status()
            except Exception as e:
                logger.error(f"Error in status update: {e}")
            await asyncio.sleep(30)

    async def run(self):
        """Main run loop"""
        try:
            # Start background tasks
            asyncio.create_task(self.sensor_monitoring_loop())
            asyncio.create_task(self.status_update_loop())

            # Main connection loop
            await self.connect()

        except KeyboardInterrupt:
            logger.info("Shutting down...")
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
        finally:
            GPIO.cleanup()
            logger.info("GPIO cleanup completed")

async def main():
    client = RaspberryPiWebSocketClient()
    await client.run()

if __name__ == "__main__":
    asyncio.run(main())