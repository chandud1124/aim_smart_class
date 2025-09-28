#!/usr/bin/env python3
"""
Test script for Raspberry Pi Display Client
Tests the connection to the backend server and board content retrieval.
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_server_connection(server_url: str) -> bool:
    """Test basic server connectivity"""
    try:
        response = requests.get(f"{server_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Server connection successful")
            return True
        else:
            print(f"❌ Server returned status {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Server connection failed: {e}")
        return False
    except requests.RequestException as e:
        print(f"❌ Server connection failed: {e}")
        return False

def test_board_content(server_url: str, board_id: str, api_key: str = None) -> bool:
    """Test board content retrieval"""
    try:
        url = f"{server_url}/api/boards/{board_id}/content"
        headers = {'Content-Type': 'application/json'}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                content = data.get('content', {})
                notices = content.get('boardNotices', []) + content.get('groupContent', [])
                print("✅ Board content retrieved successfully")
                print(f"   Board: {content.get('board', {}).get('name', 'Unknown')}")
                print(f"   Notices: {len(notices)}")
                if notices:
                    print(f"   Sample notice: {notices[0].get('title', 'No title')}")
                return True
            else:
                print(f"❌ API returned error: {data.get('message')}")
                return False
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            return False
    except requests.RequestException as e:
        print(f"❌ Board content request failed: {e}")
        return False

def test_board_status_update(server_url: str, board_id: str, api_key: str = None) -> bool:
    """Test board status update"""
    try:
        url = f"{server_url}/api/boards/{board_id}"
        headers = {'Content-Type': 'application/json'}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        data = {
            'status': 'active',
            'isOnline': True
        }

        response = requests.patch(url, json=data, headers=headers, timeout=10)

        if response.status_code == 200:
            print("✅ Board status update successful")
            return True
        else:
            print(f"❌ Board status update failed: HTTP {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Board status update request failed: {e}")
        return False

def main():
    print("🧪 Testing Raspberry Pi Display Client Configuration\n")

    # Get configuration
    server_url = os.getenv('SERVER_URL', 'http://localhost:3001')
    board_id = os.getenv('BOARD_ID', '')
    api_key = os.getenv('API_KEY', '')

    print(f"Server URL: {server_url}")
    print(f"Board ID: {board_id}")
    print(f"API Key: {'Set' if api_key else 'Not set'}")
    print()

    if not board_id:
        print("❌ BOARD_ID environment variable is required")
        print("   Set it in your .env file or environment")
        sys.exit(1)

    # Run tests
    tests = [
        ("Server Connection", lambda: test_server_connection(server_url)),
        ("Board Content", lambda: test_board_content(server_url, board_id, api_key)),
        ("Board Status Update", lambda: test_board_status_update(server_url, board_id, api_key))
    ]

    results = []
    for test_name, test_func in tests:
        print(f"Testing {test_name}...")
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append(False)
        print()

    # Summary
    passed = sum(results)
    total = len(results)

    print("=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Your Raspberry Pi display client is ready.")
        print("\nYou can now:")
        print("1. Run the display client: python3 display_client.py")
        print("2. Or start the service: sudo systemctl start raspberry-display.service")
    else:
        print("⚠️  Some tests failed. Please check your configuration and server setup.")
        print("\nTroubleshooting:")
        print("1. Verify SERVER_URL is correct and server is running")
        print("2. Check BOARD_ID exists in the system")
        print("3. Ensure network connectivity")
        print("4. Check server logs for errors")

if __name__ == "__main__":
    main()