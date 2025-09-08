# Simple ESP32 Network Diagnostic
Write-Host "ESP32 Network Diagnostic Tool" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

$BackendHost = "172.16.3.56"
$BackendPort = 3001

# Test backend connectivity
Write-Host "`n1. Testing Backend Server..." -ForegroundColor Yellow
Write-Host "Pinging $BackendHost..." -NoNewline
$pingResult = Test-Connection -ComputerName $BackendHost -Count 2 -Quiet
if ($pingResult) {
    Write-Host " SUCCESS" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "Testing port $BackendPort..." -NoNewline
try {
    $tcpTest = Test-NetConnection -ComputerName $BackendHost -Port $BackendPort -WarningAction SilentlyContinue
    if ($tcpTest.TcpTestSucceeded) {
        Write-Host " SUCCESS" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host " ERROR" -ForegroundColor Red
}

# Test ESP32 devices
Write-Host "`n2. Scanning for ESP32 Devices..." -ForegroundColor Yellow
$ESP32IPs = @("172.16.3.181", "172.16.3.182", "192.168.1.100", "192.168.4.1")
$foundDevices = @()

foreach ($ip in $ESP32IPs) {
    Write-Host "Checking $ip..." -NoNewline
    $result = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($result) {
        Write-Host " ALIVE" -ForegroundColor Green
        $foundDevices += $ip
    } else {
        Write-Host " NO RESPONSE" -ForegroundColor Red
    }
}

if ($foundDevices.Count -gt 0) {
    Write-Host "`nFound ESP32 devices:" -ForegroundColor Green
    foreach ($device in $foundDevices) {
        Write-Host "  $device" -ForegroundColor Green
    }
} else {
    Write-Host "`nNo ESP32 devices found" -ForegroundColor Yellow
}

# Check current network
Write-Host "`n3. Network Information..." -ForegroundColor Yellow
try {
    $currentWiFi = (netsh wlan show profiles) -match "All User Profile" | ForEach-Object { 
        ($_.Split(":")[1]).Trim() 
    }
    
    if ($currentWiFi -contains "AIMS-WIFI") {
        Write-Host "AIMS-WIFI profile found" -ForegroundColor Green
    } else {
        Write-Host "AIMS-WIFI profile NOT found" -ForegroundColor Yellow
    }
    
    $interface = netsh wlan show interfaces
    $connectedSSID = ($interface | Select-String "SSID" | Select-Object -First 1).ToString().Split(":")[1].Trim()
    Write-Host "Currently connected to: $connectedSSID" -ForegroundColor Cyan
    
} catch {
    Write-Host "Could not get WiFi info" -ForegroundColor Red
}

# Test backend health
Write-Host "`n4. Backend Health Check..." -ForegroundColor Yellow
try {
    $healthUrl = "http://$BackendHost" + ":" + "$BackendPort" + "/health"
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    Write-Host "Backend health: OK" -ForegroundColor Green
    Write-Host "Database: $($response.database)" -ForegroundColor Gray
} catch {
    Write-Host "Backend health check failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TROUBLESHOOTING TIPS ===" -ForegroundColor Cyan
Write-Host "If ESP32 shows offline but lights work:"
Write-Host "1. Check ESP32 serial monitor (115200 baud)"
Write-Host "2. Power cycle the ESP32"
Write-Host "3. Check WiFi signal strength"
Write-Host "4. Verify router DHCP settings"
Write-Host "5. Check for IP conflicts"
Write-Host "6. Review backend server logs"

Write-Host "`nDiagnostic complete." -ForegroundColor Green
