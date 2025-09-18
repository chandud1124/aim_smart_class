// -----------------------------------------------------------------------------
// Rate Limiter for ESP32
// Prevents command flooding and ensures system stability
// -----------------------------------------------------------------------------
// This provides rate limiting functionality to prevent
// excessive commands that could cause system instability.

#ifndef RATE_LIMITER_H
#define RATE_LIMITER_H

#include <Arduino.h>

// Rate limiter class
class RateLimiter {
private:
    unsigned long window_ms;      // Time window in milliseconds
    unsigned int max_requests;    // Maximum requests per window
    unsigned int current_count;   // Current request count in window
    unsigned long window_start;   // Start time of current window
    unsigned long last_request;   // Time of last request

public:
    // Constructor
    RateLimiter(unsigned long windowMs = 1000, unsigned int maxReq = 5)
        : window_ms(windowMs), max_requests(maxReq), current_count(0),
          window_start(0), last_request(0) {}

    // Check if request is allowed
    bool allow() {
        unsigned long now = millis();

        // Reset window if needed
        if (now - window_start >= window_ms) {
            current_count = 0;
            window_start = now;
        }

        // Check if under limit
        if (current_count < max_requests) {
            current_count++;
            last_request = now;
            return true;
        }

        return false;
    }

    // Get remaining requests in current window
    unsigned int remaining() {
        unsigned long now = millis();

        // Reset window if needed
        if (now - window_start >= window_ms) {
            current_count = 0;
            window_start = now;
        }

        if (current_count >= max_requests) {
            return 0;
        }

        return max_requests - current_count;
    }

    // Get time until next request is allowed
    unsigned long timeUntilNext() {
        unsigned long now = millis();

        // If we're under the limit, no wait needed
        if (remaining() > 0) {
            return 0;
        }

        // Calculate time until window resets
        unsigned long window_end = window_start + window_ms;
        if (now >= window_end) {
            return 0; // Window should have reset
        }

        return window_end - now;
    }

    // Get current request count
    unsigned int getCount() {
        unsigned long now = millis();

        // Reset window if needed
        if (now - window_start >= window_ms) {
            current_count = 0;
            window_start = now;
        }

        return current_count;
    }

    // Get capacity (max requests per window)
    unsigned int getCapacity() {
        return max_requests;
    }

    // Get tokens (remaining requests)
    unsigned int getTokens() {
        return remaining();
    }

    // Reset the rate limiter
    void reset() {
        current_count = 0;
        window_start = millis();
        last_request = 0;
    }

    // Get time since last request
    unsigned long timeSinceLast() {
        if (last_request == 0) return 0;
        return millis() - last_request;
    }

    // Check if rate limiter is active (has requests in current window)
    bool isActive() {
        return current_count > 0;
    }
};

#endif // RATE_LIMITER_H