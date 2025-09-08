# ESP32 Network Diagnostic Script for Windows
# This script helps diagnose ESP32 connectivity issues

Write-Host "🔧 ESP32 NETWORK DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Configuration from ESP32 code
$BackendHost = "172.16.3.56"
$BackendPort = 3001
$WiFiSSID = "AIMS-WIFI"

# Common ESP32 IP addresses to check
$ESP32IPs = @(
    "172.16.3.181",
    "172.16.3.182",
    "192.168.1.100",
    "192.168.1.101",
    "192.168.4.1"
)

function Test-NetworkConnectivity {
    Write-Host "1️⃣ Testing Backend Server Connectivity" -ForegroundColor Yellow
    Write-Host "=======================================" -ForegroundColor Yellow
    
    # Test ping to backend
    Write-Host "Pinging backend server ($BackendHost)..." -NoNewline
    $pingResult = Test-Connection -ComputerName $BackendHost -Count 3 -Quiet
    if ($pingResult) {
        Write-Host " ✅ SUCCESS" -ForegroundColor Green
    } else {
        Write-Host " ❌ FAILED" -ForegroundColor Red
    }
    
    # Test port connectivity
    Write-Host "Testing backend port ($BackendHost" -NoNewline
    Write-Host ":$BackendPort)..." -NoNewline
    $tcpTest = Test-NetConnection -ComputerName $BackendHost -Port $BackendPort -WarningAction SilentlyContinue
    if ($tcpTest.TcpTestSucceeded) {
        Write-Host " SUCCESS" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Test-ESP32Devices {
    Write-Host "2️⃣ Scanning for ESP32 Devices" -ForegroundColor Yellow
    Write-Host "==============================" -ForegroundColor Yellow
    
    $foundDevices = @()
    
    foreach ($ip in $ESP32IPs) {
        Write-Host "Checking $ip..." -NoNewline
        $result = Test-Connection -ComputerName $ip -Count 1 -Quiet
        if ($result) {
            Write-Host " ✅ ALIVE" -ForegroundColor Green
            $foundDevices += $ip
        } else {
            Write-Host " ❌ NO RESPONSE" -ForegroundColor Red
        }
    }
    
    if ($foundDevices.Count -gt 0) {
        Write-Host ""
        Write-Host "Found ESP32 devices:" -ForegroundColor Green
        foreach ($device in $foundDevices) {
            Write-Host "  📱 $device" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "⚠️  No ESP32 devices found on common IPs" -ForegroundColor Yellow
    }
    
    Write-Host ""
    return $foundDevices
}

function Get-WiFiInfo {
    Write-Host "3️⃣ WiFi Network Information" -ForegroundColor Yellow
    Write-Host "============================" -ForegroundColor Yellow
    
    try {
        # Get current WiFi profile
        $currentWiFi = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object { ($_ -split ":")[-1].Trim() }
        
        Write-Host "Available WiFi profiles:" -ForegroundColor Cyan
        foreach ($profile in $currentWiFi) {
            if ($profile -eq $WiFiSSID) {
                Write-Host "  ✅ $profile (MATCHES ESP32 CONFIG)" -ForegroundColor Green
            } else {
                Write-Host "  📡 $profile" -ForegroundColor Gray
            }
        }
        
        # Get current connection
        $currentConnection = netsh wlan show interfaces | Select-String "SSID" | Select-Object -First 1
        if ($currentConnection) {
            $connectedSSID = ($currentConnection -split ":")[-1].Trim()
            Write-Host ""
            Write-Host "Currently connected to: $connectedSSID" -ForegroundColor Cyan
            
            if ($connectedSSID -eq $WiFiSSID) {
                Write-Host "✅ Computer is on same network as ESP32" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Computer is on different network than ESP32" -ForegroundColor Yellow
            }
        }
        
    } catch {
        Write-Host "❌ Unable to get WiFi information" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Test-BackendServices {
    Write-Host "4️⃣ Backend Service Health Check" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    
    try {
        # Test HTTP health endpoint
        $healthUrl = "http://$BackendHost`:$BackendPort/health"
        Write-Host "Testing health endpoint: $healthUrl" -ForegroundColor Cyan
        
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
        Write-Host "✅ Backend health check passed" -ForegroundColor Green
        Write-Host "   Database: $($response.database)" -ForegroundColor Gray
        Write-Host "   Uptime: $([math]::Round($response.uptime, 2))s" -ForegroundColor Gray
        
    } catch {
        Write-Host "❌ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

function Show-TroubleshootingSteps {
    Write-Host "🔧 TROUBLESHOOTING STEPS" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "If ESP32 shows offline but lights work:" -ForegroundColor Yellow
    Write-Host "1. 🔌 Check ESP32 power supply stability"
    Write-Host "2. 📡 Verify WiFi signal strength at ESP32 location"
    Write-Host "3. 🔄 Power cycle the ESP32 device"
    Write-Host "4. 📊 Monitor ESP32 serial output (115200 baud)"
    Write-Host "5. 🌐 Check router DHCP client list for ESP32"
    Write-Host ""
    
    Write-Host "Network troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. 🏠 Check if router is blocking ESP32 MAC address"
    Write-Host "2. 📈 Verify router has available DHCP addresses"
    Write-Host "3. 🔥 Check firewall settings on router and backend server"
    Write-Host "4. ⏰ Verify system time on ESP32 and backend (for authentication)"
    Write-Host ""
    
    Write-Host "Backend troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. 🖥️  Check if backend process is running (pm2 list or ps aux)"
    Write-Host "2. 📝 Review backend logs for WebSocket errors"
    Write-Host "3. 🗄️  Verify MongoDB connection"
    Write-Host "4. 🔐 Check device authentication secrets"
    Write-Host ""
    
    Write-Host "Multi-user conflict troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. 👥 Check for simultaneous WebSocket connections"
    Write-Host "2. 📊 Review command queue in backend"
    Write-Host "3. 🔄 Look for authentication token conflicts"
    Write-Host "4. ⏱️  Check command timestamps for overlaps"
    Write-Host ""
}

function Get-SystemInfo {
    Write-Host "5️⃣ System Information" -ForegroundColor Yellow
    Write-Host "=====================" -ForegroundColor Yellow
    
    # Network adapter info
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.PhysicalMediaType -like "*802.11*" }
    if ($adapter) {
        Write-Host "WiFi Adapter: $($adapter.Name)" -ForegroundColor Cyan
        Write-Host "Status: $($adapter.Status)" -ForegroundColor Cyan
    }
    
    # IP configuration
    $ipConfig = Get-NetIPAddress | Where-Object { $_.AddressFamily -eq "IPv4" -and $_.IPAddress -notlike "127.*" }
    Write-Host ""
    Write-Host "IP Addresses:" -ForegroundColor Cyan
    foreach ($ip in $ipConfig) {
        Write-Host "  📍 $($ip.IPAddress) ($($ip.InterfaceAlias))" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Main execution
try {
    Test-NetworkConnectivity
    $foundESP32s = Test-ESP32Devices
    Get-WiFiInfo
    Test-BackendServices
    Get-SystemInfo
    Show-TroubleshootingSteps
    
    Write-Host "✅ Diagnostic complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Connect to ESP32 via USB and monitor serial output"
    Write-Host "2. Check backend server logs for WebSocket errors"
    Write-Host "3. Verify ESP32 device shows in router's client list"
    
} catch {
    Write-Host "❌ Diagnostic script error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
