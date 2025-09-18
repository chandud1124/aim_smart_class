// -----------------------------------------------------------------------------
// ESP32 Memory Management Implementation
// Advanced memory monitoring and debugging for ESP32
// -----------------------------------------------------------------------------

#include "memutils.h"
#include <esp_heap_trace.h>

// Global memory statistics
MemoryStats g_memoryStats = {0};
static bool memoryMonitorInitialized = false;
static MemoryPool* stringPool = nullptr;
static MemoryPool* jsonPool = nullptr;

// Heap tracing for memory leak detection
#define HEAP_TRACE_BUFFER_SIZE 100
static heap_trace_record_t heapTraceBuffer[HEAP_TRACE_BUFFER_SIZE];

// Memory allocation tracking
#define MAX_MEMORY_BLOCKS 100
static MemoryBlock memoryBlocks[MAX_MEMORY_BLOCKS];
static size_t memoryBlockCount = 0;
static bool leakDetectionEnabled = false;

// Stack monitoring
static size_t minFreeStack = UINT32_MAX;
static UBaseType_t initialStackHighWaterMark = 0;

// Initialize memory monitor
void initMemoryMonitor() {
    if (memoryMonitorInitialized) return;

    Serial.println("[MEM] Initializing memory monitor...");

    // Initialize memory pools for common allocations
    stringPool = new MemoryPool(64, 20);   // 64-byte blocks for strings
    jsonPool = new MemoryPool(256, 10);    // 256-byte blocks for JSON

    // Initialize heap tracing for leak detection
    heap_trace_init_standalone(heapTraceBuffer, HEAP_TRACE_BUFFER_SIZE);

    // Get initial stack information
    initialStackHighWaterMark = uxTaskGetStackHighWaterMark(NULL);

    updateMemoryStats();
    memoryMonitorInitialized = true;

    Serial.printf("[MEM] Memory monitor initialized. Free heap: %u bytes\n", g_memoryStats.free_heap);
}

// Update memory statistics
void updateMemoryStats() {
    g_memoryStats.total_heap = heap_caps_get_total_size(MALLOC_CAP_8BIT);
    g_memoryStats.free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    g_memoryStats.min_free_heap = heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);
    g_memoryStats.largest_free_block = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);

    // PSRAM information (if available)
    if (isPSRAMAvailable()) {
        g_memoryStats.total_psram = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
        g_memoryStats.free_psram = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
        g_memoryStats.min_free_psram = heap_caps_get_minimum_free_size(MALLOC_CAP_SPIRAM);
    }

    // Calculate fragmentation
    g_memoryStats.heap_fragmentation = calculateHeapFragmentation();

    // Update stack monitoring
    size_t currentFreeStack = getFreeStackSpace();
    if (currentFreeStack < minFreeStack) {
        minFreeStack = currentFreeStack;
    }
}

// Print memory statistics
void printMemoryStats() {
    Serial.println("\n=== ESP32 Memory Statistics ===");
    Serial.printf("Total Heap: %u KB\n", g_memoryStats.total_heap / 1024);
    Serial.printf("Free Heap: %u KB\n", g_memoryStats.free_heap / 1024);
    Serial.printf("Min Free Heap: %u KB\n", g_memoryStats.min_free_heap / 1024);
    Serial.printf("Largest Free Block: %u KB\n", g_memoryStats.largest_free_block / 1024);
    Serial.printf("Heap Fragmentation: %.1f%%\n", g_memoryStats.heap_fragmentation);

    if (isPSRAMAvailable()) {
        Serial.printf("PSRAM Total: %u KB\n", g_memoryStats.total_psram / 1024);
        Serial.printf("PSRAM Free: %u KB\n", g_memoryStats.free_psram / 1024);
    }

    Serial.printf("Free Stack: %u bytes\n", getFreeStackSpace());
    Serial.printf("Min Free Stack: %u bytes\n", minFreeStack);
    Serial.printf("Allocation Failures: %u\n", g_memoryStats.allocation_failures);
    Serial.printf("Heap Corruption Count: %u\n", g_memoryStats.heap_corruption_count);
}

// Print detailed memory information
void printDetailedMemoryInfo() {
    Serial.println("\n=== Detailed Memory Analysis ===");

    // Heap capabilities
    Serial.println("Heap by Capability:");
    Serial.printf("  MALLOC_CAP_8BIT: %u free\n", heap_caps_get_free_size(MALLOC_CAP_8BIT));
    Serial.printf("  MALLOC_CAP_32BIT: %u free\n", heap_caps_get_free_size(MALLOC_CAP_32BIT));
    Serial.printf("  MALLOC_CAP_INTERNAL: %u free\n", heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
    Serial.printf("  MALLOC_CAP_SPIRAM: %u free\n", heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
    Serial.printf("  MALLOC_CAP_DMA: %u free\n", heap_caps_get_free_size(MALLOC_CAP_DMA));

    // Memory pools status
    if (stringPool) {
        Serial.printf("String Pool: %u/%u blocks free\n", stringPool->getFreeBlocks(), stringPool->getTotalBlocks());
    }
    if (jsonPool) {
        Serial.printf("JSON Pool: %u/%u blocks free\n", jsonPool->getFreeBlocks(), jsonPool->getTotalBlocks());
    }

    // Task information
    Serial.println("Task Stack Usage:");
    Serial.printf("  Current Task Stack HWM: %u bytes\n", uxTaskGetStackHighWaterMark(NULL));
    Serial.printf("  Initial Stack HWM: %u bytes\n", initialStackHighWaterMark);

    // Memory pressure
    MemoryPressureLevel pressure = getMemoryPressureLevel();
    Serial.printf("Memory Pressure: ");
    switch (pressure) {
        case MEM_PRESSURE_LOW: Serial.println("LOW"); break;
        case MEM_PRESSURE_MEDIUM: Serial.println("MEDIUM"); break;
        case MEM_PRESSURE_HIGH: Serial.println("HIGH"); break;
        case MEM_PRESSURE_CRITICAL: Serial.println("CRITICAL"); break;
    }
}

// Check memory integrity
bool checkMemoryIntegrity() {
    // Basic heap integrity check
    if (heap_caps_check_integrity_all(true)) {
        return true;
    } else {
        g_memoryStats.heap_corruption_count++;
        Serial.println("[MEM] Heap corruption detected!");
        return false;
    }
}

// Log memory usage with context
void logMemoryUsage(const char* context) {
    updateMemoryStats();
    Serial.printf("[MEM] %s - Free: %u KB, Min: %u KB, Frag: %.1f%%\n",
                 context,
                 g_memoryStats.free_heap / 1024,
                 g_memoryStats.min_free_heap / 1024,
                 g_memoryStats.heap_fragmentation);
}

// Safe memory allocation functions
void* safe_malloc(size_t size, const char* file, int line) {
    void* ptr = heap_caps_malloc(size, MALLOC_CAP_8BIT);
    if (!ptr) {
        g_memoryStats.allocation_failures++;
        Serial.printf("[MEM] Allocation failed: %u bytes at %s:%d\n", size, file, line);
        emergencyMemoryCleanup();
        return nullptr;
    }

    // Track allocation if leak detection is enabled
    if (leakDetectionEnabled && memoryBlockCount < MAX_MEMORY_BLOCKS) {
        memoryBlocks[memoryBlockCount].ptr = ptr;
        memoryBlocks[memoryBlockCount].size = size;
        memoryBlocks[memoryBlockCount].file = file;
        memoryBlocks[memoryBlockCount].line = line;
        memoryBlocks[memoryBlockCount].timestamp = millis();
        memoryBlocks[memoryBlockCount].in_use = true;
        memoryBlockCount++;
    }

    return ptr;
}

void* safe_calloc(size_t num, size_t size, const char* file, int line) {
    size_t totalSize = num * size;
    void* ptr = safe_malloc(totalSize, file, line);
    if (ptr) {
        memset(ptr, 0, totalSize);
    }
    return ptr;
}

void* safe_realloc(void* ptr, size_t size, const char* file, int line) {
    if (!ptr) return safe_malloc(size, file, line);

    void* newPtr = heap_caps_realloc(ptr, size, MALLOC_CAP_8BIT);
    if (!newPtr) {
        g_memoryStats.allocation_failures++;
        Serial.printf("[MEM] Reallocation failed: %u bytes at %s:%d\n", size, file, line);
        return nullptr;
    }

    // Update tracking
    if (leakDetectionEnabled) {
        for (size_t i = 0; i < memoryBlockCount; i++) {
            if (memoryBlocks[i].ptr == ptr && memoryBlocks[i].in_use) {
                memoryBlocks[i].ptr = newPtr;
                memoryBlocks[i].size = size;
                break;
            }
        }
    }

    return newPtr;
}

void safe_free(void* ptr) {
    if (!ptr) return;

    // Update tracking
    if (leakDetectionEnabled) {
        for (size_t i = 0; i < memoryBlockCount; i++) {
            if (memoryBlocks[i].ptr == ptr) {
                memoryBlocks[i].in_use = false;
                break;
            }
        }
    }

    heap_caps_free(ptr);
}

// Memory Pool Implementation
MemoryPool::MemoryPool(size_t blockSize, size_t numBlocks) {
    this->block_size = blockSize;
    this->total_blocks = numBlocks;
    this->pool_size = blockSize * numBlocks;

    pool = heap_caps_malloc(pool_size, MALLOC_CAP_8BIT);
    if (pool) {
        used_blocks = (bool*)heap_caps_malloc(numBlocks * sizeof(bool), MALLOC_CAP_8BIT);
        if (used_blocks) {
            memset(used_blocks, 0, numBlocks * sizeof(bool));
        }
    }
}

MemoryPool::~MemoryPool() {
    if (pool) heap_caps_free(pool);
    if (used_blocks) heap_caps_free(used_blocks);
}

void* MemoryPool::allocate() {
    for (size_t i = 0; i < total_blocks; i++) {
        if (!used_blocks[i]) {
            used_blocks[i] = true;
            return (void*)((uint8_t*)pool + (i * block_size));
        }
    }
    return nullptr;
}

void MemoryPool::deallocate(void* ptr) {
    if (!ptr || ptr < pool || ptr >= (void*)((uint8_t*)pool + pool_size)) return;

    size_t offset = (uint8_t*)ptr - (uint8_t*)pool;
    size_t blockIndex = offset / block_size;

    if (blockIndex < total_blocks) {
        used_blocks[blockIndex] = false;
    }
}

size_t MemoryPool::getFreeBlocks() {
    size_t free = 0;
    for (size_t i = 0; i < total_blocks; i++) {
        if (!used_blocks[i]) free++;
    }
    return free;
}

size_t MemoryPool::getTotalBlocks() {
    return total_blocks;
}

void MemoryPool::printStats() {
    Serial.printf("Memory Pool: %u/%u blocks free (%u bytes each)\n",
                  getFreeBlocks(), total_blocks, block_size);
}

// Emergency memory cleanup
void emergencyMemoryCleanup() {
    Serial.println("[MEM] Emergency memory cleanup initiated");

    // Force garbage collection if available
    if (ESP.getPsramSize() > 0) {
        heap_caps_malloc(1, MALLOC_CAP_SPIRAM); // Trigger PSRAM GC
    }

    // Clear any cached data
    // Add your cleanup code here

    updateMemoryStats();
    Serial.printf("[MEM] Cleanup complete. Free heap: %u bytes\n", g_memoryStats.free_heap);
}

// Check for low memory condition
bool isLowMemoryCondition() {
    return g_memoryStats.free_heap < 20000 || // Less than 20KB
           g_memoryStats.heap_fragmentation > 80.0; // High fragmentation
}

// Trigger garbage collection
void triggerGarbageCollection() {
    Serial.println("[MEM] Triggering garbage collection");

    // ESP32 doesn't have explicit GC, but we can try to consolidate memory
    void* temp = heap_caps_malloc(1024, MALLOC_CAP_8BIT);
    if (temp) heap_caps_free(temp);
}

// Calculate heap fragmentation
float calculateHeapFragmentation() {
    size_t total = heap_caps_get_total_size(MALLOC_CAP_8BIT);
    size_t free = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);

    if (free == 0) return 100.0;

    return ((free - largest) * 100.0) / free;
}

// Get largest free block
size_t getLargestFreeBlock() {
    return heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
}

// Analyze memory fragmentation
void analyzeMemoryFragmentation() {
    Serial.println("\n=== Memory Fragmentation Analysis ===");
    Serial.printf("Total Free: %u bytes\n", g_memoryStats.free_heap);
    Serial.printf("Largest Block: %u bytes\n", g_memoryStats.largest_free_block);
    Serial.printf("Fragmentation: %.1f%%\n", g_memoryStats.heap_fragmentation);

    if (g_memoryStats.heap_fragmentation > 50.0) {
        Serial.println("⚠️  High fragmentation detected!");
        Serial.println("Consider: Reducing dynamic allocations, using memory pools");
    }
}

// Memory leak detection
void startMemoryLeakDetection() {
    leakDetectionEnabled = true;
    memoryBlockCount = 0;
    Serial.println("[MEM] Memory leak detection started");
}

void stopMemoryLeakDetection() {
    leakDetectionEnabled = false;
    Serial.println("[MEM] Memory leak detection stopped");
}

void printMemoryLeakReport() {
    Serial.println("\n=== Memory Leak Report ===");
    size_t leaks = 0;
    size_t totalLeaked = 0;

    for (size_t i = 0; i < memoryBlockCount; i++) {
        if (memoryBlocks[i].in_use) {
            Serial.printf("LEAK: %u bytes at %s:%d (allocated %lu ms ago)\n",
                         memoryBlocks[i].size,
                         memoryBlocks[i].file,
                         memoryBlocks[i].line,
                         millis() - memoryBlocks[i].timestamp);
            leaks++;
            totalLeaked += memoryBlocks[i].size;
        }
    }

    if (leaks == 0) {
        Serial.println("✓ No memory leaks detected");
    } else {
        Serial.printf("⚠️  %u leaks found, %u bytes total\n", leaks, totalLeaked);
    }
}

// Stack monitoring
size_t getFreeStackSpace() {
    return uxTaskGetStackHighWaterMark(NULL);
}

size_t getMinimumFreeStackSpace() {
    return minFreeStack;
}

void monitorStackUsage() {
    size_t current = getFreeStackSpace();
    Serial.printf("[STACK] Free: %u bytes, Min: %u bytes\n", current, minFreeStack);

    if (current < 1024) {
        Serial.println("⚠️  Low stack space!");
    }
}

// PSRAM utilities
bool isPSRAMAvailable() {
    return ESP.getPsramSize() > 0;
}

size_t getPSRAMSize() {
    return ESP.getPsramSize();
}

size_t getFreePSRAM() {
    return heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
}

void* allocateFromPSRAM(size_t size) {
    if (!isPSRAMAvailable()) return nullptr;
    return heap_caps_malloc(size, MALLOC_CAP_SPIRAM);
}

void freeFromPSRAM(void* ptr) {
    if (ptr) heap_caps_free(ptr);
}

// Memory pressure handling
MemoryPressureLevel getMemoryPressureLevel() {
    if (g_memoryStats.free_heap < 10000) return MEM_PRESSURE_CRITICAL;
    if (g_memoryStats.free_heap < 20000) return MEM_PRESSURE_HIGH;
    if (g_memoryStats.free_heap < 50000) return MEM_PRESSURE_MEDIUM;
    return MEM_PRESSURE_LOW;
}

void handleMemoryPressure(MemoryPressureLevel level) {
    switch (level) {
        case MEM_PRESSURE_CRITICAL:
            Serial.println("[MEM] Critical memory pressure - emergency cleanup");
            emergencyMemoryCleanup();
            ESP.restart(); // Last resort
            break;

        case MEM_PRESSURE_HIGH:
            Serial.println("[MEM] High memory pressure - triggering cleanup");
            emergencyMemoryCleanup();
            break;

        case MEM_PRESSURE_MEDIUM:
            Serial.println("[MEM] Medium memory pressure - monitoring closely");
            triggerGarbageCollection();
            break;

        case MEM_PRESSURE_LOW:
            // Normal operation
            break;
    }
}

// Debug functions
void dumpMemoryLayout() {
    Serial.println("\n=== Memory Layout Dump ===");
    heap_caps_print_heap_info(MALLOC_CAP_8BIT);
}

void validateHeapIntegrity() {
    if (heap_caps_check_integrity_all(true)) {
        Serial.println("[MEM] ✓ Heap integrity OK");
    } else {
        Serial.println("[MEM] ✗ Heap corruption detected!");
    }
}

bool detectMemoryCorruption() {
    return !heap_caps_check_integrity_all(true);
}