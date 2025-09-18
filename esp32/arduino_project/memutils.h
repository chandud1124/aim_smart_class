// -----------------------------------------------------------------------------
// ESP32 Memory Management Utilities
// Advanced memory monitoring and management for ESP32 devices
// -----------------------------------------------------------------------------

#ifndef MEMUTILS_H
#define MEMUTILS_H

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <esp_system.h>

// Memory allocation types
#define MEM_TYPE_MALLOC     MALLOC_CAP_8BIT
#define MEM_TYPE_INTERNAL   MALLOC_CAP_INTERNAL
#define MEM_TYPE_EXTERNAL   MALLOC_CAP_SPIRAM
#define MEM_TYPE_DMA        MALLOC_CAP_DMA

// Memory monitoring structure
struct MemoryStats {
    size_t total_heap;
    size_t free_heap;
    size_t min_free_heap;
    size_t largest_free_block;
    size_t total_psram;
    size_t free_psram;
    size_t min_free_psram;
    uint32_t heap_corruption_count;
    uint32_t allocation_failures;
    float heap_fragmentation;
};

// Memory allocation tracker
struct MemoryBlock {
    void* ptr;
    size_t size;
    const char* file;
    int line;
    unsigned long timestamp;
    bool in_use;
};

// Global memory statistics
extern MemoryStats g_memoryStats;

// Memory monitoring functions
void initMemoryMonitor();
void updateMemoryStats();
void printMemoryStats();
void printDetailedMemoryInfo();
bool checkMemoryIntegrity();
void logMemoryUsage(const char* context);

// Safe memory allocation functions
void* safe_malloc(size_t size, const char* file = __FILE__, int line = __LINE__);
void* safe_calloc(size_t num, size_t size, const char* file = __FILE__, int line = __LINE__);
void* safe_realloc(void* ptr, size_t size, const char* file = __FILE__, int line = __LINE__);
void safe_free(void* ptr);

// Memory pool for frequent allocations
class MemoryPool {
private:
    void* pool;
    size_t block_size;
    size_t pool_size;
    bool* used_blocks;
    size_t total_blocks;

public:
    MemoryPool(size_t blockSize, size_t numBlocks);
    ~MemoryPool();

    void* allocate();
    void deallocate(void* ptr);
    size_t getFreeBlocks();
    size_t getTotalBlocks();
    void printStats();
};

// Emergency memory cleanup
void emergencyMemoryCleanup();
bool isLowMemoryCondition();
void triggerGarbageCollection();

// Memory fragmentation analysis
float calculateHeapFragmentation();
size_t getLargestFreeBlock();
void analyzeMemoryFragmentation();

// Memory leak detection (basic)
void startMemoryLeakDetection();
void stopMemoryLeakDetection();
void printMemoryLeakReport();

// Stack monitoring
size_t getFreeStackSpace();
size_t getMinimumFreeStackSpace();
void monitorStackUsage();

// PSRAM utilities (if available)
bool isPSRAMAvailable();
size_t getPSRAMSize();
size_t getFreePSRAM();
void* allocateFromPSRAM(size_t size);
void freeFromPSRAM(void* ptr);

// Memory pressure handling
typedef enum {
    MEM_PRESSURE_LOW,
    MEM_PRESSURE_MEDIUM,
    MEM_PRESSURE_HIGH,
    MEM_PRESSURE_CRITICAL
} MemoryPressureLevel;

MemoryPressureLevel getMemoryPressureLevel();
void handleMemoryPressure(MemoryPressureLevel level);

// Debug memory functions
void dumpMemoryLayout();
void validateHeapIntegrity();
bool detectMemoryCorruption();

#endif // MEMUTILS_H