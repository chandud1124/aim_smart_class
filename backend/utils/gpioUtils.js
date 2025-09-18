// GPIO Pin Utilities for ESP32 Device Management
// Provides validation, safety checks, and recommendations for GPIO pin usage

// ESP32 GPIO pin classifications
const PROBLEMATIC_PINS = new Set([4, 5, 12, 13, 14, 15]);
const RESERVED_PINS = new Set([6, 7, 8, 9, 10, 11]);
const SAFE_PINS = Array.from({ length: 40 }, (_, i) => i).filter(p => !PROBLEMATIC_PINS.has(p) && !RESERVED_PINS.has(p));

// Pin purpose recommendations
const RECOMMENDED_PINS = {
  relay: {
    primary: [16, 17, 18, 19, 21, 22], // Best for relay control
    secondary: [23, 25, 26, 27, 32, 33], // Alternative relay pins
    description: 'GPIO pins 16-19, 21-23, 25-27, 32-33 are recommended for relay control'
  },
  manual: {
    primary: [23, 25, 26, 27, 32, 33], // Best for manual switches
    secondary: [16, 17, 18, 19, 21, 22], // Alternative manual pins
    description: 'GPIO pins 23, 25-27, 32-33 are recommended for manual switches'
  },
  pir: {
    primary: [34, 35, 36, 39], // Input-only pins (best for PIR)
    secondary: [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33], // Alternative PIR pins
    description: 'GPIO pins 34-36, 39 are recommended for PIR sensors (input-only)'
  }
};

/**
 * Validate if a GPIO pin is safe to use
 * @param {number} pin - GPIO pin number (0-39)
 * @param {boolean} allowProblematic - Allow problematic pins (default: false)
 * @returns {boolean} - True if pin is valid and safe
 */
function validateGpioPin(pin, allowProblematic = false) {
  if (typeof pin !== 'number' || pin < 0 || pin > 39) {
    return false;
  }

  // Always reject reserved pins
  if (RESERVED_PINS.has(pin)) {
    return false;
  }

  // For problematic pins, only allow if explicitly permitted
  if (PROBLEMATIC_PINS.has(pin) && !allowProblematic) {
    return false;
  }

  return true;
}

/**
 * Get detailed status information for a GPIO pin
 * @param {number} pin - GPIO pin number (0-39)
 * @returns {object} - Pin status information
 */
function getGpioPinStatus(pin) {
  if (typeof pin !== 'number' || pin < 0 || pin > 39) {
    return {
      safe: false,
      status: 'invalid',
      reason: 'Invalid GPIO pin number (must be 0-39)',
      category: 'invalid'
    };
  }

  if (RESERVED_PINS.has(pin)) {
    return {
      safe: false,
      status: 'reserved',
      reason: 'Reserved for internal ESP32 use (pins 6-11)',
      category: 'reserved',
      bootImpact: 'Will prevent ESP32 from booting'
    };
  }

  if (PROBLEMATIC_PINS.has(pin)) {
    return {
      safe: false,
      status: 'problematic',
      reason: 'May cause ESP32 boot issues (pins 4, 5, 12-15)',
      category: 'problematic',
      bootImpact: 'May cause boot loops or prevent booting',
      alternativePins: getRecommendedPins('relay')
    };
  }

  if (SAFE_PINS.includes(pin)) {
    const isInputOnly = pin >= 34 && pin <= 39;
    return {
      safe: true,
      status: 'safe',
      reason: 'Safe for ESP32 boot and operation',
      category: 'safe',
      inputOnly: isInputOnly,
      recommendedFor: getRecommendedUses(pin)
    };
  }

  return {
    safe: false,
    status: 'unknown',
    reason: 'Unknown GPIO pin status',
    category: 'unknown'
  };
}

/**
 * Get recommended uses for a safe GPIO pin
 * @param {number} pin - GPIO pin number
 * @returns {string[]} - Array of recommended uses
 */
function getRecommendedUses(pin) {
  const uses = [];

  if (RECOMMENDED_PINS.relay.primary.includes(pin) || RECOMMENDED_PINS.relay.secondary.includes(pin)) {
    uses.push('relay');
  }

  if (RECOMMENDED_PINS.manual.primary.includes(pin) || RECOMMENDED_PINS.manual.secondary.includes(pin)) {
    uses.push('manual_switch');
  }

  if (RECOMMENDED_PINS.pir.primary.includes(pin) || RECOMMENDED_PINS.pir.secondary.includes(pin)) {
    uses.push('pir_sensor');
  }

  if (pin >= 34 && pin <= 39) {
    uses.push('input_only');
  }

  return uses;
}

/**
 * Get recommended pins for a specific purpose
 * @param {string} purpose - 'relay', 'manual', or 'pir'
 * @param {string} priority - 'primary' or 'secondary' (default: 'primary')
 * @returns {number[]} - Array of recommended GPIO pins
 */
function getRecommendedPins(purpose, priority = 'primary') {
  const recommendations = RECOMMENDED_PINS[purpose];
  if (!recommendations) {
    return [];
  }

  return recommendations[priority] || recommendations.primary || [];
}

/**
 * Validate a complete GPIO configuration
 * @param {object} config - Configuration object
 * @param {Array} config.switches - Array of switch configurations
 * @param {boolean} config.pirEnabled - Whether PIR is enabled
 * @param {number} config.pirGpio - PIR GPIO pin
 * @returns {object} - Validation result
 */
function validateGpioConfiguration(config) {
  const { switches = [], pirEnabled = false, pirGpio } = config;
  const errors = [];
  const warnings = [];
  const usedPins = new Set();

  // Validate switches
  switches.forEach((sw, index) => {
    const switchNum = index + 1;

    // Check relay GPIO
    if (sw.gpio !== undefined) {
      if (usedPins.has(sw.gpio)) {
        errors.push({
          type: 'duplicate_pin',
          switch: switchNum,
          pin: sw.gpio,
          message: `GPIO ${sw.gpio} is already used by another component`
        });
      } else {
        usedPins.add(sw.gpio);
        const status = getGpioPinStatus(sw.gpio);
        if (!status.safe) {
          if (status.status === 'problematic') {
            warnings.push({
              type: 'problematic_pin',
              switch: switchNum,
              pin: sw.gpio,
              message: status.reason,
              alternatives: status.alternativePins
            });
          } else {
            errors.push({
              type: 'invalid_pin',
              switch: switchNum,
              pin: sw.gpio,
              message: status.reason
            });
          }
        }
      }
    }

    // Check manual switch GPIO
    if (sw.manualSwitchEnabled && sw.manualSwitchGpio !== undefined) {
      if (usedPins.has(sw.manualSwitchGpio)) {
        errors.push({
          type: 'duplicate_pin',
          switch: switchNum,
          pin: sw.manualSwitchGpio,
          message: `Manual GPIO ${sw.manualSwitchGpio} is already used by another component`
        });
      } else {
        usedPins.add(sw.manualSwitchGpio);
        const status = getGpioPinStatus(sw.manualSwitchGpio);
        if (!status.safe) {
          if (status.status === 'problematic') {
            warnings.push({
              type: 'problematic_pin',
              switch: switchNum,
              pin: sw.manualSwitchGpio,
              message: `Manual switch: ${status.reason}`,
              alternatives: status.alternativePins
            });
          } else {
            errors.push({
              type: 'invalid_pin',
              switch: switchNum,
              pin: sw.manualSwitchGpio,
              message: `Manual switch: ${status.reason}`
            });
          }
        }
      }
    }
  });

  // Validate PIR GPIO
  if (pirEnabled && pirGpio !== undefined) {
    if (usedPins.has(pirGpio)) {
      errors.push({
        type: 'duplicate_pin',
        pin: pirGpio,
        message: `PIR GPIO ${pirGpio} is already used by another component`
      });
    } else {
      const status = getGpioPinStatus(pirGpio);
      if (!status.safe) {
        if (status.status === 'problematic') {
          warnings.push({
            type: 'problematic_pin',
            pin: pirGpio,
            message: `PIR sensor: ${status.reason}`,
            alternatives: getRecommendedPins('pir')
          });
        } else {
          errors.push({
            type: 'invalid_pin',
            pin: pirGpio,
            message: `PIR sensor: ${status.reason}`
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalSwitches: switches.length,
      errors: errors.length,
      warnings: warnings.length,
      usedPins: Array.from(usedPins)
    }
  };
}

/**
 * Get all available pins for a device configuration
 * @param {string} deviceId - Device ID (optional)
 * @param {Array} existingConfig - Existing device configuration
 * @returns {object} - Available pins information
 */
function getAvailablePins(deviceId = null, existingConfig = []) {
  const usedPins = new Set();

  // Mark existing pins as used
  existingConfig.forEach(item => {
    if (item.gpio !== undefined) usedPins.add(item.gpio);
    if (item.manualSwitchGpio !== undefined) usedPins.add(item.manualSwitchGpio);
    if (item.pirGpio !== undefined) usedPins.add(item.pirGpio);
  });

  const available = {
    relay: [],
    manual: [],
    pir: [],
    all: []
  };

  SAFE_PINS.forEach(pin => {
    if (!usedPins.has(pin)) {
      available.all.push(pin);

      if (getRecommendedUses(pin).includes('relay')) {
        available.relay.push(pin);
      }

      if (getRecommendedUses(pin).includes('manual_switch')) {
        available.manual.push(pin);
      }

      if (getRecommendedUses(pin).includes('pir_sensor')) {
        available.pir.push(pin);
      }
    }
  });

  return available;
}

module.exports = {
  PROBLEMATIC_PINS,
  RESERVED_PINS,
  SAFE_PINS,
  RECOMMENDED_PINS,
  validateGpioPin,
  getGpioPinStatus,
  getRecommendedUses,
  getRecommendedPins,
  validateGpioConfiguration,
  getAvailablePins
};