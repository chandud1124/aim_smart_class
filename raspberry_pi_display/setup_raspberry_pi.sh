#!/bin/bash
# Raspberry Pi Display Client Setup Script
# This script sets up the Raspberry Pi display client for AIMS Smart Class System

set -e

echo "🚀 Setting up Raspberry Pi Display Client..."

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required system packages
echo "📦 Installing system dependencies..."
sudo apt install -y python3 python3-pip python3-dev libsdl2-dev libsdl2-ttf-dev libsdl2-image-dev libsdl2-mixer-dev

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Create configuration directory
echo "📁 Creating configuration directory..."
sudo mkdir -p /etc/raspberry-display
sudo mkdir -p /var/log/raspberry-display

# Create systemd service
echo "⚙️ Creating systemd service..."
cat > /tmp/raspberry-display.service << 'EOF'
[Unit]
Description=Raspberry Pi Display Client for AIMS Smart Class
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/raspberry_pi_display
ExecStart=/usr/bin/python3 /home/pi/raspberry_pi_display/display_client.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

# Environment variables (customize these)
Environment=SERVER_URL=http://your-server-ip:3001
Environment=BOARD_ID=your-board-id-here
Environment=DISPLAY_WIDTH=1920
Environment=DISPLAY_HEIGHT=1080
Environment=FULLSCREEN=true
Environment=CONTENT_UPDATE_INTERVAL=30
Environment=STATUS_UPDATE_INTERVAL=60

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/raspberry-display.service /etc/systemd/system/
sudo systemctl daemon-reload

# Configure auto-start on boot
echo "🔄 Configuring auto-start..."
sudo systemctl enable raspberry-display.service

# Create environment file template
echo "📝 Creating environment configuration template..."
cat > .env.example << 'EOF'
# Raspberry Pi Display Client Configuration
# Copy this file to .env and customize the values

# Server Configuration
SERVER_URL=http://localhost:3001
BOARD_ID=your_board_id_here

# Optional: API Key for authentication (if required)
API_KEY=

# Display Configuration
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
FULLSCREEN=true

# Update Intervals (seconds)
CONTENT_UPDATE_INTERVAL=30
STATUS_UPDATE_INTERVAL=60

# Font Sizes
FONT_SIZE_TITLE=48
FONT_SIZE_CONTENT=32
FONT_SIZE_FOOTER=24

# Colors (RGB values)
BG_COLOR=0,0,0
TEXT_COLOR=255,255,255
TITLE_COLOR=255,255,0
EOF

# Configure Raspberry Pi for display
echo "🖥️ Configuring display settings..."

# Disable screen blanking
sudo raspi-config nonint do_blanking 1

# Set HDMI mode (if needed)
# sudo raspi-config nonint do_resolution 2 82  # 1920x1080

# Create desktop shortcut (optional)
echo "🖥️ Creating desktop shortcut..."
mkdir -p ~/Desktop
cat > ~/Desktop/start_display.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Raspberry Display
Comment=Start Raspberry Pi Display Client
Exec=lxterminal -e "cd /home/pi/raspberry_pi_display && python3 display_client.py"
Icon=lxterminal
Terminal=false
StartupNotify=true
EOF
chmod +x ~/Desktop/start_display.desktop

echo "✅ Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Copy .env.example to .env and configure your settings"
echo "2. Update the BOARD_ID in the systemd service file: sudo nano /etc/systemd/system/raspberry-display.service"
echo "3. Start the service: sudo systemctl start raspberry-display.service"
echo "4. Check status: sudo systemctl status raspberry-display.service"
echo "5. View logs: sudo journalctl -u raspberry-display.service -f"
echo ""
echo "🔧 Configuration files:"
echo "  - Environment: .env"
echo "  - Service: /etc/systemd/system/raspberry-display.service"
echo "  - Logs: /var/log/raspberry-display/"
echo ""
echo "📖 For manual testing, run: python3 display_client.py"