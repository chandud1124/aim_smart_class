# Raspberry Pi Display Integration Guide

This guide explains how to set up Raspberry Pi devices as display boards in your AIMS Smart Class System.

## Overview

Raspberry Pi devices can be configured as display boards that show notices and content sent from the AIMS system. This is separate from ESP32 IoT devices which handle GPIO control.

## Architecture

- **ESP32 Devices**: IoT control (GPIO switches, sensors) - *Removed from this setup*
- **Raspberry Pi Boards**: Display devices (notice boards, digital signage)

## Quick Setup

### 1. Create a Raspberry Pi Board

Run the setup script to create a board in your system:

```bash
cd raspberry_pi_display
python3 setup_board.py
```

This will:
- Prompt for admin login
- Create a Raspberry Pi board in the system
- Generate configuration files
- Provide the Board ID needed for the display client

### 2. Deploy to Raspberry Pi

Copy the entire `raspberry_pi_display` folder to your Raspberry Pi:

```bash
# On your Raspberry Pi
mkdir -p ~/raspberry_pi_display
# Copy all files from the raspberry_pi_display directory
```

### 3. Configure the Raspberry Pi

```bash
cd ~/raspberry_pi_display

# Run the setup script
chmod +x setup_raspberry_pi.sh
sudo ./setup_raspberry_pi.sh
```

### 4. Update Configuration

Edit the `.env` file with your board details:

```bash
nano .env
```

Set the correct values:
```bash
SERVER_URL=http://your-server-ip:3001
BOARD_ID=your-board-id-from-step-1
```

### 5. Test the Connection

```bash
python3 test_connection.py
```

### 6. Start the Display

```bash
# Manual start
python3 display_client.py

# Or start the service
sudo systemctl start raspberry-display.service
```

## Manual Setup Steps

### Backend Configuration

1. **Create Board in Admin Panel**:
   - Login to your AIMS admin panel
   - Go to Boards section
   - Create new board with type "raspberry_pi"
   - Note the Board ID

2. **Assign Content**:
   - Create notices in the system
   - Assign them to your Raspberry Pi board
   - The display client will automatically fetch and show content

### Raspberry Pi Setup

1. **Install Dependencies**:
   ```bash
   sudo apt update
   sudo apt install -y python3 python3-pip python3-dev libsdl2-dev libsdl2-ttf-dev libsdl2-image-dev libsdl2-mixer-dev
   pip3 install -r requirements.txt
   ```

2. **Configure Display**:
   ```bash
   # Disable screen blanking
   sudo raspi-config nonint do_blanking 1
   ```

3. **Create Environment File**:
   ```bash
   cp .env.example .env
   nano .env
   ```

4. **Test and Run**:
   ```bash
   python3 test_connection.py
   python3 display_client.py
   ```

## API Endpoints Used

The display client uses these backend endpoints:

- `GET /api/boards/{BOARD_ID}/content` - Fetch content to display
- `PATCH /api/boards/{BOARD_ID}` - Update board status

## Content Display

The Raspberry Pi will display:

- **Notice Title**: Large, colored text
- **Notice Content**: Main body text with word wrapping
- **Footer**: Last update timestamp
- **Multiple Notices**: Cycles through available notices

## Configuration Options

### Display Settings
- Resolution: 1920x1080 (default)
- Fullscreen mode
- Custom colors and fonts
- Update intervals

### Network Settings
- Server URL and port
- Board authentication
- Connection timeouts

## Troubleshooting

### Display Issues
- Check HDMI connection
- Verify pygame installation
- Check display resolution settings

### Connection Issues
- Verify SERVER_URL
- Check BOARD_ID
- Test network connectivity
- Check server logs

### Content Issues
- Ensure notices are published
- Verify board assignment
- Check content update intervals

## Files Overview

```
raspberry_pi_display/
├── display_client.py      # Main display application
├── setup_board.py         # Board creation script
├── test_connection.py     # Connection testing
├── setup_raspberry_pi.sh  # Raspberry Pi setup script
├── requirements.txt       # Python dependencies
├── .env.example          # Configuration template
└── README.md             # Detailed documentation
```

## Security Notes

- The display client can optionally use API keys for authentication
- Board IDs should be kept secure
- Network traffic is not encrypted by default (consider HTTPS)

## Support

For issues:
1. Check the troubleshooting section
2. Run the test script to verify connections
3. Check Raspberry Pi logs: `sudo journalctl -u raspberry-display.service`
4. Verify board configuration in the admin panel