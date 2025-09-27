#!/bin/bash
# Raspberry Pi Setup Script for IoT Classroom System
# Run this script on your Raspberry Pi to set it up for MQTT communication

echo "Setting up Raspberry Pi for IoT Classroom System..."

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python and pip
echo "Installing Python and pip..."
sudo apt install -y python3 python3-pip python3-dev

# Install required Python packages (WebSocket instead of MQTT)
echo "Installing Python dependencies..."
pip3 install -r raspberry_requirements.txt

# Install MQTT broker (optional - if you want local MQTT on Pi)
# echo "Installing Mosquitto MQTT broker..."
# sudo apt install -y mosquitto mosquitto-clients
# sudo systemctl enable mosquitto
# sudo systemctl start mosquitto

# Enable I2C and SPI (if needed for sensors)
echo "Enabling I2C and SPI interfaces..."
sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_spi 0

# Install additional sensor libraries (uncomment as needed)
# echo "Installing sensor libraries..."
# pip3 install adafruit-circuitpython-dht
# pip3 install adafruit-circuitpython-bmp280
# pip3 install smbus2

# Create systemd service for the Raspberry Pi client
echo "Creating systemd service..."
sudo tee /etc/systemd/system/raspberry-client.service > /dev/null <<EOF
[Unit]
Description=Raspberry Pi MQTT Client for IoT Classroom
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/iot-classroom
ExecStart=/usr/bin/python3 /home/pi/iot-classroom/raspberry_pi_client.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
echo "Enabling and starting the service..."
sudo systemctl daemon-reload
sudo systemctl enable raspberry-client
sudo systemctl start raspberry-client

# Create log directory
mkdir -p /home/pi/iot-classroom/logs

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy raspberry_pi_client.py and raspberry_requirements.txt to /home/pi/iot-classroom/"
echo "2. Edit the MQTT_BROKER IP address in raspberry_pi_client.py to match your server"
echo "3. Modify DEVICE_ID if you have multiple Raspberry Pis"
echo "4. Configure GPIO_PINS in the script according to your hardware setup"
echo "5. Check service status: sudo systemctl status raspberry-client"
echo "6. View logs: sudo journalctl -u raspberry-client -f"