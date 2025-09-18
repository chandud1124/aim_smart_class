# ESP32 Relay Pin Configuration Guide

## 🔌 **How Relay Pins Are Configured**

### **Dynamic Configuration (Recommended)**
The ESP32 firmware **does not use hardcoded relay pins**. Instead:

1. **ESP32 connects to backend server**
2. **Backend sends switch configuration** with GPIO pin assignments
3. **ESP32 configures relays dynamically** based on backend settings

### **Configuration Message Format:**
```json
{
  "type": "identified",
  "switches": [
    {
      "gpio": 12,           // Relay control pin
      "manualGpio": 13,     // Manual switch input pin (-1 if none)
      "name": "Light 1",
      "manualActiveLow": false
    },
    {
      "gpio": 14,           // Relay control pin
      "manualGpio": 15,     // Manual switch input pin
      "name": "Fan 1",
      "manualActiveLow": true
    }
  ]
}
```

## 📋 **Recommended ESP32 GPIO Pins for Relays**

### **Safe GPIO Pins (Recommended for Relays):**
```
GPIO 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27
```

### **Pins to Avoid:**
```
❌ GPIO 0, 2, 4, 5, 12*, 15*  ← Used for boot/LED/flash
❌ GPIO 1, 3                   ← Serial communication
❌ GPIO 6, 7, 8, 9, 10, 11    ← SPI flash
❌ GPIO 34, 35, 36, 39        ← Input only (no pull-up)
```

*Note: GPIO 12 and 15 can be used but may cause boot issues with some ESP32 modules

## 🔧 **Relay Circuit Configuration**

### **Relay Module Types:**
1. **Active LOW relays** (most common):
   - Relay ON when GPIO = LOW
   - Relay OFF when GPIO = HIGH

2. **Active HIGH relays**:
   - Relay ON when GPIO = HIGH
   - Relay OFF when GPIO = LOW

### **Current Firmware Configuration:**
```cpp
#define RELAY_ON_LEVEL LOW    // Active LOW relays
#define RELAY_OFF_LEVEL HIGH  // Active LOW relays
```

## 🏗️ **Backend Configuration Example**

### **Switch Configuration in Backend:**
```json
[
  {
    "id": "switch_1",
    "name": "Classroom Light 1",
    "gpio": 12,
    "manualGpio": 13,
    "manualActiveLow": false,
    "relayType": "active_low"
  },
  {
    "id": "switch_2",
    "name": "Projector Power",
    "gpio": 14,
    "manualGpio": 15,
    "manualActiveLow": true,
    "relayType": "active_low"
  },
  {
    "id": "switch_3",
    "name": "AC Unit",
    "gpio": 16,
    "manualGpio": -1,  // No manual switch
    "manualActiveLow": false,
    "relayType": "active_low"
  }
]
```

## ⚡ **ESP32 Pinout Recommendations**

### **For Classroom Automation:**
```
ESP32 GPIO → Relay Function
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 12   → Light Control 1
GPIO 13   → Light Control 2
GPIO 14   → Fan Control 1
GPIO 15   → Projector Control
GPIO 16   → AC Unit Control
GPIO 17   → Emergency Lights
GPIO 18   → Door Lock Control
GPIO 19   → Security System
GPIO 21   → Audio System
GPIO 22   → Smart Board Power
GPIO 23   → Network Equipment
GPIO 25   → Backup Power
GPIO 26   → Ventilation System
GPIO 27   → Lighting Control 3
```

### **Manual Switch Inputs (Optional):**
```
ESP32 GPIO → Manual Switch
━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 32   → Light 1 Manual
GPIO 33   → Light 2 Manual
GPIO 34   → Fan Manual (Input only)
GPIO 35   → Projector Manual (Input only)
```

## 🔧 **Hardware Connection Guide**

### **Relay Module Connection:**
```
ESP32 GPIO Pin → Relay Module Signal Pin
GND            → Relay Module GND
3.3V or 5V     → Relay Module VCC
GPIO XX        → Relay Module IN (control pin)
```

### **Manual Switch Connection:**
```
Manual Switch → ESP32 GPIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Switch NO     → GPIO XX (with pull-up)
Switch COM    → GND
```

## ⚙️ **Configuration Steps**

### **1. Hardware Setup:**
- Connect relay modules to recommended GPIO pins
- Connect manual switches (optional)
- Power the ESP32 and relay modules appropriately

### **2. Backend Configuration:**
- Configure switch settings in backend database
- Set GPIO pin assignments for each relay
- Configure manual switch pins (if used)
- Set relay active level (HIGH/LOW)

### **3. ESP32 Configuration:**
- Upload firmware to ESP32
- Configure WiFi and backend connection
- ESP32 will automatically receive pin configuration
- Test relay operation through backend interface

## 🚨 **Important Notes**

### **Power Considerations:**
- **ESP32 GPIO can source/sink max 12mA per pin**
- **Use relay modules with opto-isolation**
- **Power relays separately from ESP32**
- **Use appropriate power supplies**

### **Safety Precautions:**
- **Never connect AC mains directly to ESP32**
- **Use proper relay modules with isolation**
- **Test all connections before powering**
- **Use fuses and circuit breakers**

### **Testing:**
- **Test each relay individually first**
- **Verify correct active HIGH/LOW operation**
- **Test manual switch inputs**
- **Monitor ESP32 temperature and current draw**

## 🎯 **Summary**

**Relay pins are configured dynamically through the backend server, not hardcoded in firmware.** This provides maximum flexibility for different hardware configurations.

**Recommended pins:** GPIO 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27

**Configuration happens automatically when ESP32 connects to backend and receives switch configuration.**

*This dynamic configuration system allows you to easily change relay pin assignments without modifying the firmware code.*