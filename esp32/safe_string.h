#pragma once
#include <cstring>

// Safe string copy with bounds checking
inline void safe_strcpy(char* dst, size_t dst_sz, const char* src) {
  if (!dst || dst_sz == 0) return;
  if (!src) {
    dst[0] = '\0';
    return;
  }
  size_t src_len = strlen(src);
  size_t copy_len = (src_len < dst_sz - 1) ? src_len : dst_sz - 1;
  memcpy(dst, src, copy_len);
  dst[copy_len] = '\0';
}

// Safe string concatenation with bounds checking
inline void safe_strcat(char* dst, size_t dst_sz, const char* src) {
  if (!dst || dst_sz == 0 || !src) return;
  size_t dst_len = strlen(dst);
  size_t remaining = dst_sz - dst_len - 1;
  if (remaining == 0) return;
  size_t src_len = strlen(src);
  size_t copy_len = (src_len < remaining) ? src_len : remaining;
  memcpy(dst + dst_len, src, copy_len);
  dst[dst_len + copy_len] = '\0';
}

// Safe string formatting with bounds checking
inline int safe_snprintf(char* dst, size_t dst_sz, const char* fmt, ...) {
  if (!dst || dst_sz == 0) return -1;
  va_list args;
  va_start(args, fmt);
  int result = vsnprintf(dst, dst_sz, fmt, args);
  va_end(args);
  return result;
}