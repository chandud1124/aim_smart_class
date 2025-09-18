// -----------------------------------------------------------------------------
// Safe String Operations for ESP32
// Prevents buffer overflows and memory corruption
// -----------------------------------------------------------------------------
// This provides safe string operations with bounds checking
// to prevent common ESP32 crash causes.

#ifndef SAFE_STRING_H
#define SAFE_STRING_H

#include <Arduino.h>
#include <cstring>
#include <cstdarg>

// Safe string copy with bounds checking
inline size_t safe_strncpy(char* dest, const char* src, size_t dest_size) {
    if (!dest || !src || dest_size == 0) return 0;

    size_t src_len = strlen(src);
    size_t copy_len = (src_len < dest_size - 1) ? src_len : dest_size - 1;

    memcpy(dest, src, copy_len);
    dest[copy_len] = '\0';

    return copy_len;
}

// Safe string concatenation with bounds checking
inline size_t safe_strncat(char* dest, const char* src, size_t dest_size) {
    if (!dest || !src || dest_size == 0) return 0;

    size_t dest_len = strlen(dest);
    if (dest_len >= dest_size - 1) return dest_len; // Already full

    size_t remaining = dest_size - dest_len - 1;
    size_t src_len = strlen(src);
    size_t copy_len = (src_len < remaining) ? src_len : remaining;

    memcpy(dest + dest_len, src, copy_len);
    dest[dest_len + copy_len] = '\0';

    return dest_len + copy_len;
}

// Safe sprintf with bounds checking
inline int safe_snprintf(char* buffer, size_t buffer_size, const char* format, ...) {
    if (!buffer || !format || buffer_size == 0) return -1;

    va_list args;
    va_start(args, format);
    int result = vsnprintf(buffer, buffer_size, format, args);
    va_end(args);

    // Ensure null termination
    if (result >= 0 && (size_t)result >= buffer_size) {
        buffer[buffer_size - 1] = '\0';
        return buffer_size - 1;
    }

    return result;
}

// Safe string formatting for JSON
inline String safe_json_string(const char* input) {
    if (!input) return String("\"\"");

    String result = "\"";
    for (size_t i = 0; input[i] != '\0' && i < 100; i++) { // Limit length
        char c = input[i];
        switch (c) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (c >= 32 && c <= 126) { // Printable ASCII
                    result += c;
                } else {
                    // Escape non-printable characters
                    char hex[8];
                    safe_snprintf(hex, sizeof(hex), "\\u%04x", (unsigned char)c);
                    result += hex;
                }
                break;
        }
    }
    result += "\"";
    return result;
}

// Safe string to integer conversion
inline long safe_strtol(const char* str, int base = 10) {
    if (!str) return 0;

    char* endptr;
    long result = strtol(str, &endptr, base);

    // Check for conversion errors
    if (endptr == str) return 0; // No conversion performed

    return result;
}

// Safe string to float conversion
inline float safe_strtof(const char* str) {
    if (!str) return 0.0f;

    char* endptr;
    float result = strtof(str, &endptr);

    // Check for conversion errors
    if (endptr == str) return 0.0f; // No conversion performed

    return result;
}

#endif // SAFE_STRING_H