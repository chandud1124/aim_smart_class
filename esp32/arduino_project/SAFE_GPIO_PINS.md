# ESP32 Safe GPIO Pins for 6 Switches (12 Pins Total)

## 📊 **Current Problematic Pins (Avoid These)**

### **Your Current Configuration:**
```cpp
❌ GPIO 4, 5    - Used for flash chip, may prevent booting
❌ GPIO 12, 13  - Used for flash memory, may cause boot loops
❌ GPIO 14, 15  - Used for flash memory, may cause boot issues
```

### **Other ESP32 Restricted Pins:**
```cpp
❌ GPIO 0       - Boot mode selection
❌ GPIO 1, 3    - Serial communication (UART0)
❌ GPIO 6-11    - SPI flash memory
❌ GPIO 34, 35  - Input only (no pull-up, no output)
❌ GPIO 36, 39  - Input only (no pull-up, no output)
```

## ✅ **Safe GPIO Pins for ESP32**

### **Recommended Safe Pins:**
```
✅ GPIO 16, 17, 18, 19, 21, 22, 23, 25, 26, 27
✅ GPIO 32, 33 (input-only but perfect for manual switches)
```

## 🎯 **Suggested Configuration for 6 Switches**

### **Option 1: All Digital I/O Pins**
```cpp
// 6 Relay Pins (Output)
{16, 32, "Fan1", true},       // GPIO 16 → Relay, GPIO 32 → Manual
{17, 33, "Fan2", true},       // GPIO 17 → Relay, GPIO 33 → Manual
{18, 25, "Light1", true},     // GPIO 18 → Relay, GPIO 25 → Manual
{19, 26, "Light2", true},     // GPIO 19 → Relay, GPIO 26 → Manual
{21, 27, "Projector", true},  // GPIO 21 → Relay, GPIO 27 → Manual
{22, 23, "AC Unit", true}     // GPIO 22 → Relay, GPIO 23 → Manual
```

### **Option 2: Sequential Pin Groups**
```cpp
// 6 Relay Pins (Output)
{16, 25, "Fan1", true},       // GPIO 16 → Relay, GPIO 25 → Manual
{17, 26, "Fan2", true},       // GPIO 17 → Relay, GPIO 26 → Manual
{18, 27, "Light1", true},     // GPIO 18 → Relay, GPIO 27 → Manual
{19, 32, "Light2", true},     // GPIO 19 → Relay, GPIO 32 → Manual
{21, 33, "Projector", true},  // GPIO 21 → Relay, GPIO 33 → Manual
{22, 23, "AC Unit", true}     // GPIO 22 → Relay, GPIO 23 → Manual
```

## 📋 **Complete ESP32 GPIO Pin Reference**

### **Safe for Relays (Output):**
```
GPIO 16 ✅ - Safe, no restrictions
GPIO 17 ✅ - Safe, no restrictions
GPIO 18 ✅ - Safe, no restrictions
GPIO 19 ✅ - Safe, no restrictions
GPIO 21 ✅ - Safe, no restrictions
GPIO 22 ✅ - Safe, no restrictions
GPIO 23 ✅ - Safe, no restrictions
GPIO 25 ✅ - Safe, no restrictions
GPIO 26 ✅ - Safe, no restrictions
GPIO 27 ✅ - Safe, no restrictions
```

### **Safe for Manual Switches (Input):**
```
GPIO 23 ✅ - Can be used for both input and output
GPIO 25 ✅ - Safe for input
GPIO 26 ✅ - Safe for input
GPIO 27 ✅ - Safe for input
GPIO 32 ✅ - Input only, perfect for manual switches
GPIO 33 ✅ - Input only, perfect for manual switches
GPIO 34 ❌ - Input only, no pull-up resistor
GPIO 35 ❌ - Input only, no pull-up resistor
GPIO 36 ❌ - Input only, no pull-up resistor
GPIO 39 ❌ - Input only, no pull-up resistor
```

## 🔧 **Why These Pins Are Safe**

### **GPIO 16-19, 21-23, 25-27:**
- ✅ **No boot restrictions**
- ✅ **No flash memory conflicts**
- ✅ **Full digital I/O capability**
- ✅ **Can be used for relays and manual switches**
- ✅ **Support pull-up/pull-down resistors**
- ✅ **Interrupt capability**

### **GPIO 32-33:**
- ✅ **Safe for manual switches only**
- ✅ **No boot restrictions**
- ✅ **Input with pull-up capability**
- ✅ **Perfect for switch inputs**
- ❌ **Cannot be used for relay outputs**

## 📊 **ESP32 Pinout Layout**

### **ESP32-WROOM-32 Pinout (Common Module):**
```
GPIO 16, 17, 18, 19, 21, 22, 23, 25, 26, 27 - SAFE FOR RELAYS
GPIO 32, 33 - SAFE FOR MANUAL SWITCHES
GPIO 34, 35, 36, 39 - INPUT ONLY (limited use)
```

## 🎯 **Recommended 6-Switch Configuration**

### **Final Recommendation:**
```cpp
const SwitchConfig DEFAULT_SWITCHES[] = {
    {16, 25, "Fan1", true},       // GPIO 16 → Relay, GPIO 25 → Manual
    {17, 26, "Fan2", true},       // GPIO 17 → Relay, GPIO 26 → Manual
    {18, 27, "Light1", true},     // GPIO 18 → Relay, GPIO 27 → Manual
    {19, 32, "Light2", true},     // GPIO 19 → Relay, GPIO 32 → Manual
    {21, 33, "Projector", true},  // GPIO 21 → Relay, GPIO 33 → Manual
    {22, 23, "AC Unit", true}     // GPIO 22 → Relay, GPIO 23 → Manual
};
```

### **Why This Configuration:**
- ✅ **All pins are 100% safe** - no boot or flash conflicts
- ✅ **6 relays + 6 manual switches** = 12 pins total
- ✅ **Mix of regular and input-only pins** for optimal usage
- ✅ **Easy to wire** - sequential pin grouping
- ✅ **No GPIO conflicts** with ESP32 boot process

## 🚨 **ESP32 Boot Process Warnings**

### **Pins That Can Cause Boot Issues:**
```cpp
❌ GPIO 0  - Must be LOW during boot (has pull-up)
❌ GPIO 2  - Connected to onboard LED
❌ GPIO 4  - Connected to flash chip
❌ GPIO 5  - Connected to flash chip
❌ GPIO 12 - Connected to flash memory
❌ GPIO 13 - Connected to flash memory (HSPI)
❌ GPIO 14 - Connected to flash memory (HSPI)
❌ GPIO 15 - Connected to flash memory
❌ GPIO 1, 3 - Serial communication
❌ GPIO 6-11 - SPI flash memory
```

## ✅ **Summary**

### **Safe Pins for Your 6 Switches:**
- **6 Relay Pins:** 16, 17, 18, 19, 21, 22
- **6 Manual Pins:** 23, 25, 26, 27, 32, 33

### **Total Available Safe Pins:**
- **Digital I/O:** 12 pins (16, 17, 18, 19, 21, 22, 23, 25, 26, 27)
- **Input Only:** 2 pins (32, 33)
- **Total:** 14 safe pins available

**Use the recommended configuration above for reliable ESP32 operation!** 🚀