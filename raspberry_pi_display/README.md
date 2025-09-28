# Raspberry Pi Display Client

A Python-based display client for Raspberry Pi devices that connects to the AIMS Smart Class System to display notices and content on connected screens.

## Features

- **Real-time Content Display**: Fetches and displays notices from the backend server
- **Full-screen Display**: Optimized for digital signage and notice boards
- **Automatic Updates**: Regularly checks for new content and updates the display
- **Status Reporting**: Reports device status back to the server
- **Configurable**: Highly customizable display settings, colors, and update intervals
- **Systemd Integration**: Runs as a system service with automatic restart
- **Multi-notice Support**: Cycles through multiple notices if available

## Requirements

- Raspberry Pi (any model with HDMI output)
- Raspberry Pi OS (formerly Raspbian)
- Python 3.7+
- Connected display/monitor

## Quick Start

### 1. Setup Raspberry Pi

Run the automated setup script:

```bash
cd raspberry_pi_display
chmod +x setup_raspberry_pi.sh
sudo ./setup_raspberry_pi.sh
```

### 2. Configure Environment

Copy the example configuration and edit it:

```bash
cp .env.example .env
nano .env
```

Set your board ID and server URL:

```bash
SERVER_URL=http://your-server-ip:3001
BOARD_ID=your_board_id_here
```

### 3. Start the Service

```bash
sudo systemctl start raspberry-display.service
sudo systemctl enable raspberry-display.service
```

### 4. Check Status

```bash
sudo systemctl status raspberry-display.service
sudo journalctl -u raspberry-display.service -f
```

## Manual Installation

If you prefer manual installation:

### Install Dependencies

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-dev libsdl2-dev libsdl2-ttf-dev libsdl2-image-dev libsdl2-mixer-dev
pip3 install -r requirements.txt
```

### Configure Display

Disable screen blanking:

```bash
sudo raspi-config nonint do_blanking 1
```

### Run Manually

```bash
python3 display_client.py
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_URL` | Backend server URL | `http://localhost:3001` |
| `BOARD_ID` | Board ID from the system | *Required* |
| `API_KEY` | API key for authentication | *Optional* |
| `DISPLAY_WIDTH` | Display width in pixels | `1920` |
| `DISPLAY_HEIGHT` | Display height in pixels | `1080` |
| `FULLSCREEN` | Run in fullscreen mode | `true` |
| `CONTENT_UPDATE_INTERVAL` | Content check interval (seconds) | `30` |
| `STATUS_UPDATE_INTERVAL` | Status update interval (seconds) | `60` |
| `FONT_SIZE_TITLE` | Title font size | `48` |
| `FONT_SIZE_CONTENT` | Content font size | `32` |
| `FONT_SIZE_FOOTER` | Footer font size | `24` |
| `BG_COLOR` | Background color (R,G,B) | `0,0,0` |
| `TEXT_COLOR` | Text color (R,G,B) | `255,255,255` |
| `TITLE_COLOR` | Title color (R,G,B) | `255,255,0` |

### Board Setup

1. **Create a Board in the System**:
   - Go to your AIMS admin panel
   - Create a new board with type "raspberry_pi"
   - Note the board ID

2. **Configure the Raspberry Pi**:
   - Set the `BOARD_ID` in the `.env` file
   - Set the correct `SERVER_URL`

3. **Network Configuration**:
   - Ensure the Raspberry Pi can reach the server
   - Configure static IP if needed

## API Integration

The client communicates with the backend through these endpoints:

- `GET /api/boards/{BOARD_ID}/content` - Fetch board content
- `PATCH /api/boards/{BOARD_ID}` - Update board status

## Troubleshooting

### Display Issues

**Black screen or no display**:
- Check HDMI connection
- Verify display resolution settings
- Check pygame installation: `python3 -c "import pygame; print(pygame.version.ver)"`

**Text not rendering**:
- Install SDL2 TTF support: `sudo apt install libsdl2-ttf-dev`
- Check font availability

### Network Issues

**Cannot connect to server**:
- Verify `SERVER_URL` is correct
- Check network connectivity: `ping your-server-ip`
- Check firewall settings

**Authentication errors**:
- Verify `BOARD_ID` is correct
- Check if `API_KEY` is required

### Service Issues

**Service not starting**:
```bash
sudo systemctl status raspberry-display.service
sudo journalctl -u raspberry-display.service -f
```

**Permission errors**:
- Ensure the service runs as the correct user
- Check file permissions in the display directory

### Performance Issues

**High CPU usage**:
- Increase `CONTENT_UPDATE_INTERVAL`
- Reduce display resolution if needed

**Memory issues**:
- Monitor memory usage: `htop`
- Restart service periodically if needed

## Development

### Running in Development Mode

```bash
# With debug logging
python3 display_client.py

# With custom config
SERVER_URL=http://localhost:3001 BOARD_ID=test-board python3 display_client.py
```

### Testing

Create a test script to verify functionality:

```python
#!/usr/bin/env python3
import requests
import os

SERVER_URL = os.getenv('SERVER_URL', 'http://localhost:3001')
BOARD_ID = os.getenv('BOARD_ID', 'test-board')

# Test board content endpoint
response = requests.get(f"{SERVER_URL}/api/boards/{BOARD_ID}/content")
print(f"Status: {response.status_code}")
print(f"Content: {response.json()}")
```

## File Structure

```
raspberry_pi_display/
├── display_client.py          # Main display client
├── requirements.txt           # Python dependencies
├── setup_raspberry_pi.sh     # Setup script
├── .env.example              # Configuration template
└── README.md                 # This file
```

## Logs

Logs are stored in:
- `/var/log/raspberry-display/` (when running as service)
- Console output (when running manually)

## Support

For issues and questions:
1. Check the logs for error messages
2. Verify configuration settings
3. Test network connectivity
4. Check server-side board configuration

## License

This project is part of the AIMS Smart Class System.