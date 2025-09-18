# ESP32 GPIO Pin Configuration - Manual Switch Support

## ✅ **Changes Made**

### **1. Default Switch Configuration Added**
The ESP32 now works with manual switches **before connecting to backend** using these pins:

```cpp
const SwitchConfig DEFAULT_SWITCHES[] = {
    {4, 25, "Fan1", true},       // ⚠️ GPIO 4 may cause boot issues
    {16, 27, "Fan2", true},
    {17, 32, "Light1", true},
    {5, 33, "Light2", true},    // ⚠️ GPIO 5 may cause boot issues
    {19, 12, "Projector", true}, // ⚠️ GPIO 12 may cause boot issues
    {18, 14, "NComputing", true}, // ⚠️ GPIO 14 may cause boot issues
    {21, 13, "AC Unit", true},  // ⚠️ GPIO 13 may cause boot issues
    {22, 15, "Printer", true}   // ⚠️ GPIO 15 may cause boot issues
};
```

### **2. Manual Switch Support**
- **Works immediately** after power-on (no backend required)
- **Debounced inputs** prevent false triggers
- **Configurable active level** (HIGH/LOW)
- **Real-time state monitoring**

### **3. Backend Override**
- Uses default configuration initially
- **Automatically switches** to backend configuration when connected
- **Maintains manual switch functionality** in both modes

## 🔌 **Hardware Connections**

### **Relay Control Pins (Output):**
```
ESP32 GPIO → Device → Function
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 4     → Relay  → Fan 1
GPIO 5     → Relay  → Light 2
GPIO 16    → Relay  → Fan 2
GPIO 17    → Relay  → Light 1
GPIO 18    → Relay  → NComputing
GPIO 19    → Relay  → Projector
GPIO 21    → Relay  → AC Unit
GPIO 22    → Relay  → Printer
```

### **Manual Switch Pins (Input):**
```
ESP32 GPIO → Manual Switch → Function
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 12    → Switch → Projector
GPIO 13    → Switch → AC Unit
GPIO 14    → Switch → NComputing
GPIO 15    → Switch → Printer
GPIO 25    → Switch → Fan 1
GPIO 27    → Switch → Fan 2
GPIO 32    → Switch → Light 1
GPIO 33    → Switch → Light 2
```

## ⚠️ **Important GPIO Warnings**

### **Potentially Problematic Pins:**
```
❌ GPIO 4, 5    - Used for flash chip, may prevent booting
❌ GPIO 12, 13  - Used for flash, may cause boot loops
❌ GPIO 14, 15  - Used for flash, may cause boot issues
```

### **Safe Alternatives:**
```
✅ GPIO 16, 17, 18, 19, 21, 22, 23, 25, 26, 27
```

## 🔧 **How It Works**

### **1. Power-On (No Backend):**
- ESP32 initializes with default pin configuration
- Manual switches work immediately
- Relays can be controlled via physical switches
- Serial monitor shows switch states

### **2. Backend Connection:**
- ESP32 connects to backend server
- If backend provides configuration → switches to backend config
- If no backend config → continues with defaults
- Manual switches remain functional

### **3. Manual Switch Operation:**
- **Active LOW switches** (as configured)
- **Debounced inputs** (200ms debounce)
- **State changes logged** to backend when connected
- **Real-time relay control**

## 📋 **Testing Procedure**

### **1. Hardware Setup:**
```cpp
// Connect relays to GPIO outputs
ESP32_GPIO → Relay_IN → Device

// Connect manual switches to GPIO inputs
Switch_NO → ESP32_GPIO (with 10K pull-up)
Switch_COM → GND
```

### **2. Power On:**
- ESP32 boots with default configuration
- Check Serial Monitor (115200 baud)
- Should see: "Initializing with default switch configuration"

### **3. Test Manual Switches:**
- Toggle physical switches
- Observe relay activation/deactivation
- Check Serial Monitor for state changes

### **4. Backend Connection:**
- Configure WiFi and backend settings
- ESP32 connects and may receive new configuration
- Manual switches continue working

## 🎯 **Configuration Details**

### **Relay Settings:**
```cpp
#define RELAY_ON_LEVEL LOW    // Active LOW relays
#define RELAY_OFF_LEVEL HIGH
```

### **Manual Switch Settings:**
- **All configured as active LOW**
- **200ms debounce time**
- **Pull-up resistors enabled**
- **State monitoring every loop**

### **Serial Debug Output:**
```
=== ESP32 Production System Starting ===
GPIO PIN WARNINGS: Some pins may cause boot issues!
Initializing with default switch configuration (8 switches)
Added switch: Fan1 (GPIO 4, Manual GPIO 25, Active LOW)
Setup relay GPIO 4 (manual pin 25, active LOW) - Fan1
Manual switch: GPIO 4 = ON (triggered by physical switch)
```

## 🚨 **Troubleshooting**

### **ESP32 Won't Boot:**
- **Problem:** GPIO 4, 5, 12, 13, 14, 15 may interfere with boot
- **Solution:** Try different GPIO pins or remove connections during boot

### **Manual Switches Not Working:**
- **Check:** Wiring connections and pull-up resistors
- **Verify:** Active LOW/HIGH configuration matches hardware
- **Test:** Use multimeter to verify switch signals

### **Backend Override Issues:**
- **Check:** Backend sends proper switch configuration
- **Verify:** GPIO pins in backend match hardware connections
- **Monitor:** Serial output for configuration changes

## ✅ **Ready for Testing**

The ESP32 firmware now supports:
- ✅ **8 switches** with manual control
- ✅ **Immediate operation** without backend
- ✅ **Backend configuration override**
- ✅ **Comprehensive logging** and debugging
- ✅ **GPIO warnings** for troubleshooting

**Upload the firmware and test the manual switches - they should work immediately!** 🚀