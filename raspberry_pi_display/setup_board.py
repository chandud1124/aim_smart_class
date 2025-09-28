#!/usr/bin/env python3
"""
Setup script for Raspberry Pi Display Board
Helps create and configure a Raspberry Pi board in the AIMS system.
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv
from typing import Optional, Dict, Any

# Load environment variables
load_dotenv()

class BoardSetup:
    def __init__(self):
        self.server_url = os.getenv('SERVER_URL', 'http://localhost:3001')
        self.api_key = os.getenv('API_KEY', '')
        self.session = requests.Session()

    def get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers

    def login(self, email: str, password: str) -> Optional[str]:
        """Login and get auth token"""
        try:
            url = f"{self.server_url}/api/auth/login"
            data = {'email': email, 'password': password}
            response = self.session.post(url, json=data, timeout=10)

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    token = result.get('token')
                    self.session.headers.update({'Authorization': f'Bearer {token}'})
                    print("✅ Login successful")
                    return token
                else:
                    print(f"❌ Login failed: {result.get('message')}")
            else:
                print(f"❌ Login failed: HTTP {response.status_code}")
        except requests.RequestException as e:
            print(f"❌ Login request failed: {e}")

        return None

    def create_board(self, board_data: Dict[str, Any]) -> Optional[str]:
        """Create a new Raspberry Pi board"""
        try:
            url = f"{self.server_url}/api/boards"
            response = self.session.post(url, json=board_data, timeout=10)

            if response.status_code == 201:
                result = response.json()
                if result.get('success'):
                    board = result.get('board', {})
                    board_id = board.get('_id')
                    print("✅ Board created successfully")
                    print(f"   Name: {board.get('name')}")
                    print(f"   ID: {board_id}")
                    print(f"   Type: {board.get('type')}")
                    return board_id
                else:
                    print(f"❌ Board creation failed: {result.get('message')}")
            else:
                print(f"❌ Board creation failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
        except requests.RequestException as e:
            print(f"❌ Board creation request failed: {e}")

        return None

    def get_board(self, board_id: str) -> bool:
        """Verify board exists and get details"""
        try:
            url = f"{self.server_url}/api/boards/{board_id}"
            response = self.session.get(url, timeout=10)

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    board = result.get('board', {})
                    print("✅ Board found:")
                    print(f"   Name: {board.get('name')}")
                    print(f"   Type: {board.get('type')}")
                    print(f"   Status: {board.get('status')}")
                    print(f"   Location: {board.get('location')}")
                    return True
                else:
                    print(f"❌ Board not found: {result.get('message')}")
            else:
                print(f"❌ Board lookup failed: HTTP {response.status_code}")
        except requests.RequestException as e:
            print(f"❌ Board lookup request failed: {e}")

        return False

def main():
    print("🔧 Raspberry Pi Board Setup for AIMS Smart Class System\n")

    setup = BoardSetup()

    # Get login credentials
    print("Please login with admin credentials:")
    email = input("Email: ").strip()
    password = input("Password: ").strip()

    if not setup.login(email, password):
        print("❌ Setup failed - could not login")
        sys.exit(1)

    # Get board information
    print("\n📋 Board Configuration:")
    board_name = input("Board Name (e.g., 'Main Hall Display'): ").strip()
    location = input("Location (e.g., 'Building A - Main Hall'): ").strip()
    description = input("Description (optional): ").strip()

    # Get Raspberry Pi specific info
    mac_address = input("MAC Address (optional, press Enter to skip): ").strip()
    ip_address = input("IP Address (optional, press Enter to skip): ").strip()

    # Create board data
    board_data = {
        'name': board_name,
        'location': location,
        'type': 'raspberry_pi',
        'displaySettings': {
            'resolution': '1920x1080',
            'orientation': 'landscape',
            'supportsVideo': True,
            'supportsImages': True
        },
        'schedule': {
            'isActive': True,
            'operatingHours': {
                'start': '08:00',
                'end': '18:00'
            }
        },
        'status': 'active'
    }

    if description:
        board_data['description'] = description
    if mac_address:
        board_data['macAddress'] = mac_address.upper()
    if ip_address:
        board_data['ipAddress'] = ip_address

    print("\n📝 Creating board with the following configuration:")
    print(json.dumps(board_data, indent=2))

    if input("\nProceed with creation? (y/N): ").lower().strip() != 'y':
        print("❌ Setup cancelled")
        sys.exit(0)

    # Create the board
    board_id = setup.create_board(board_data)

    if board_id:
        print("\n✅ Board setup completed successfully!")
        print(f"📋 Board ID: {board_id}")
        print("\n🔧 Next steps:")
        print("1. Copy the Board ID to your Raspberry Pi configuration")
        print("2. Update your .env file with: BOARD_ID=" + board_id)
        print("3. Run the Raspberry Pi setup script")
        print("4. Start the display client")

        # Verify the board was created
        print("\n🔍 Verifying board creation...")
        if setup.get_board(board_id):
            print("✅ Board verification successful")
        else:
            print("⚠️  Board created but verification failed")

        # Generate .env content
        env_content = f"""# Raspberry Pi Display Configuration
SERVER_URL={setup.server_url}
BOARD_ID={board_id}
API_KEY={setup.api_key if setup.api_key else ''}

# Display settings
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
FULLSCREEN=true

# Update intervals
CONTENT_UPDATE_INTERVAL=30
STATUS_UPDATE_INTERVAL=60
"""

        print("\n📄 Suggested .env file content:")
        print("-" * 50)
        print(env_content)
        print("-" * 50)

        # Offer to save .env file
        if input("Save this configuration to .env file? (y/N): ").lower().strip() == 'y':
            with open('.env', 'w') as f:
                f.write(env_content)
            print("✅ Configuration saved to .env")
    else:
        print("❌ Board setup failed")
        sys.exit(1)

if __name__ == "__main__":
    main()