#pragma once
#include <Arduino.h>

class RateLimiter {
public:
  RateLimiter(unsigned long refillIntervalMs, int capacity)
    : refillIntervalMs_(refillIntervalMs),
      capacity_(capacity),
      tokens_(capacity),
      lastRefillMs_(millis()) {}

  bool allow(int cost = 1) {
    refill();
    if (tokens_ >= cost) {
      tokens_ -= cost;
      return true;
    }
    return false;
  }

  void reset() {
    tokens_ = capacity_;
    lastRefillMs_ = millis();
  }

  int getTokens() const { return tokens_; }
  int getCapacity() const { return capacity_; }

private:
  void refill() {
    unsigned long now = millis();
    if (now < lastRefillMs_) {
      // Handle millis() overflow
      lastRefillMs_ = now;
      return;
    }
    unsigned long delta = now - lastRefillMs_;
    if (delta < refillIntervalMs_) return;

    unsigned long cycles = delta / refillIntervalMs_;
    tokens_ = min(capacity_, tokens_ + (int)cycles);
    lastRefillMs_ += cycles * refillIntervalMs_;
  }

  unsigned long refillIntervalMs_;
  int capacity_;
  int tokens_;
  unsigned long lastRefillMs_;
};