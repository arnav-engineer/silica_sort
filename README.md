# Silica Sort

**A High-Performance Learned Sorting Architecture for In-Memory and External Workloads.**

Silica Sort is a hybrid, production-grade sorting framework built in Rust with Python bindings. It leverages hardware-specific optimizations (SIMD) and learned index structures (Recursive Model Indexes) to significantly outperform standard sorting algorithms like `pdqsort` and mergesort, particularly for large numeric arrays.

## Key Features

- **Learned Indexing (RMI)**: Uses a fast linear regression model trained on a data sample to predict the approximate position of elements, enabling `O(N)` expected time complexity by scattering elements into buckets in a single pass.
- **SIMD Acceleration**: Fallback sorting for small buckets (≤ 64 elements) uses AVX2 sorting networks for maximum throughput.
- **Out-of-Core External Sort**: Automatically handles files larger than available RAM using an optimized chunked pipeline with a multi-threaded reader-sorter-writer architecture and K-Way merge.
- **Adaptive Execution**: Dynamically switches to counting sort for low-cardinality data, and bypasses partitioning entirely for already sorted or reverse-sorted data.
- **Zero-Copy In-Place Sorting**: Native Python bindings allow sorting NumPy arrays directly in memory without the GIL.

## Architecture Highlights

1. **Phase 1: Sampling & Training**: A small subset of the data is sampled to train a Monotonic RMI model.
2. **Phase 2: Parallel Partitioning**: Elements are scattered into 2,048 buckets using the RMI's predictions. Write-combining buffers ensure cache-friendly memory access patterns.
3. **Phase 3: Bucket Sort**: Each bucket is sorted in parallel. Depending on the bucket size and data distribution, the algorithm delegates to:
   - **AVX2 Sorting Networks** (for tiny arrays ≤ 16 elements).
   - **Optimized Insertion Sort** (for small arrays ≤ 64 elements).
   - **pdqsort** (Pattern-Defeating Quicksort) for mid-sized buckets.
   - **Radix Sort** for large outlier buckets where the RMI prediction was inaccurate.

## Performance

Silica Sort regularly achieves **2x to 4x speedups** over NumPy's highly optimized `np.sort` (quicksort) and standard `pdqsort` implementations, especially on uniform, normally distributed, and mostly-sorted datasets.

## Cross-Platform

Dynamically detects hardware limits and scales. Memory limits and cache sizes are parsed dynamically using the `sysinfo` and `raw-cpuid` crates, ensuring optimal chunk sizing for out-of-core operations across Linux, macOS, and Windows.
