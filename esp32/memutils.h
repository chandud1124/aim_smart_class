#pragma once
#include <esp_heap_caps.h>
#include <cstdlib>

// Safe memory allocation wrapper for ESP32
static inline void* safe_malloc(size_t size) {
  if (size == 0) return nullptr;
  // Prefer 8-bit accessible internal memory to avoid PSRAM fragmentation
  void* p = heap_caps_malloc(size, MALLOC_CAP_8BIT);
  return p;
}

static inline void safe_free(void* p) {
  if (p) heap_caps_free(p);
}

// Get current free heap size
static inline size_t get_free_heap() {
  return heap_caps_get_free_size(MALLOC_CAP_8BIT);
}

// Get minimum free heap since boot
static inline size_t get_min_free_heap() {
  return heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);
}