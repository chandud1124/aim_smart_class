# ESP32 Restart Behavior Analysis

## Scenario: Manual Switch ON vs Web Command OFF Conflict

Let's analyze what happens when the ESP32 restarts in a conflict situation:

### Initial State Before Restart
```
Manual Wall Switch: ON (physically closed)
Last Web Command: OFF (saved in NVS)
Physical Relay: OFF (due to web command)
```

### ESP32 Restart Sequence

#### 1. **Power-On / Boot**
```cpp
void setup() {
  // Step 1: Initialize system
  cmdQueue = xQueueCreate(MAX_COMMAND_QUEUE, sizeof(Command));
  
  // Step 2: Setup relays and load saved state
  setupRelays();
}
```

#### 2. **Load Configuration from NVS**
```cpp
void setupRelays() {
  // Load from NVS (Non-Volatile Storage)
  loadConfigFromNVS();
  
  // If saved config exists, restore it
  for (auto &sw : switchesLocal) {
    pinMode(sw.gpio, OUTPUT);
    // ✅ CRITICAL: Restores LAST SAVED STATE from NVS
    digitalWrite(sw.gpio, sw.state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
  }
}
```

**At this point:** Relay is set to OFF (last web command state)

#### 3. **Read Manual Switch Position**
```cpp
void setupRelays() {
  // Initialize manual switch reading
  sw.lastManualLevel = digitalRead(sw.manualGpio);
  sw.stableManualLevel = sw.lastManualLevel;
  sw.lastManualActive = sw.manualActiveLow ? 
    (sw.stableManualLevel == LOW) : (sw.stableManualLevel == HIGH);
}
```

**At this point:** ESP32 knows manual switch is ON but relay is OFF

#### 4. **Main Loop Starts - Conflict Detection**
```cpp
void loop() {
  // Process manual switches
  handleManualSwitches();
}

void handleManualSwitches() {
  // For maintained switches, follow switch position
  if (active != sw.state) {
    // 🔥 CONFLICT DETECTED: Manual=ON, Stored=OFF
    queueSwitchCommand(sw.gpio, active);  // Commands relay ON
    sw.manualOverride = true;             // Marks as manual override
  }
}
```

### **RESOLUTION: Manual Switch WINS**

The ESP32 immediately detects the conflict and prioritizes the physical manual switch:

```
Time 0ms:   Relay OFF (web command from NVS)
Time 100ms: Manual switch reading = ON
Time 200ms: Conflict detected, relay switched to ON
Time 300ms: manualOverride = true
```

### Real-World Example

```cpp
// Classroom scenario:
// 1. Teacher turns light ON via web interface
// 2. Teacher manually turns switch OFF at wall
// 3. Power outage occurs
// 4. ESP32 restarts

// Startup sequence:
Serial.println("[RESTART] Loading saved state...");
// ↳ Loads: Light = ON (last web command)

Serial.println("[RESTART] Setting relays...");  
// ↳ Relay set to ON

Serial.println("[RESTART] Reading manual switches...");
// ↳ Manual switch reads OFF

Serial.println("[MANUAL] Conflict detected: stored=ON, manual=OFF");
// ↳ Override triggered

Serial.println("[MANUAL] Switching to manual position: OFF");
// ↳ Relay switched to OFF
// ↳ manualOverride = true
```

### Conflict Resolution Priority

1. **Manual Switch** (Highest Priority)
   - Physical wall switch position always takes precedence
   - Immediate override upon conflict detection
   - Sets `manualOverride = true` flag

2. **PIR Sensor** (Medium Priority)
   - Can activate switches automatically
   - Respects manual override (`dontAutoOff` flag)
   - Won't turn off manually overridden switches

3. **Web Commands** (Lowest Priority)
   - Saved to NVS for persistence
   - Used as initial state on restart
   - Overridden by manual switches

### State Persistence Logic

```cpp
bool applySwitchState(int gpio, bool state) {
  // Update switch state
  sw.state = state;
  digitalWrite(sw.gpio, state ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
  
  // 💾 Save to NVS for restart persistence
  sw.defaultState = state;
  saveConfigToNVS();
  
  return true;
}
```

### Manual Override Protection

```cpp
// PIR sensor respects manual override
if (sw.usePir && sw.pirActivated && !sw.dontAutoOff && sw.state) {
  // Only auto-off if NOT manually overridden
  if (!sw.manualOverride) {
    queueSwitchCommand(sw.gpio, false);
  }
}
```

## Summary

**When ESP32 restarts with manual switch conflicts:**

1. ✅ **Restores last web command** from NVS storage
2. ✅ **Reads current manual switch position**
3. ✅ **Detects conflict** within ~200ms
4. ✅ **Manual switch ALWAYS WINS** - relay follows wall switch
5. ✅ **Sets manual override flag** to protect from automation
6. ✅ **Updates NVS** with new state for next restart

**Result:** Physical manual switches have absolute priority and will override any stored web commands immediately after restart.

This ensures **user safety** and **intuitive behavior** - if someone physically operates a wall switch, the system respects that choice even after power cycles.
