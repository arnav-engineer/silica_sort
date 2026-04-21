import time
import os
import gc
import numpy as np
import silica_sort

def generate_large_file(filename: str, size_mb: int):
    print(f"Generating {size_mb} MB test file: {filename}...")
    num_elements = (size_mb * 1024 * 1024) // 8
    
    chunk_size = 10_000_000
    elements_written = 0
    
    with open(filename, 'wb') as f:
        while elements_written < num_elements:
            to_write = min(chunk_size, num_elements - elements_written)
            data = np.random.rand(to_write).astype(np.float64)
            f.write(data.tobytes())
            elements_written += to_write

def bench_numpy_mmap(filename: str, output_filename: str):
    print("  [Baseline] NumPy Memory-Mapped Sort...")
    start_time = time.time()
    
    # Create memory-mapped array for reading
    mmap_arr = np.memmap(filename, dtype=np.float64, mode='r')
    
    # For a fair external sort comparison, if it fits in memory Numpy will just load it.
    # To truly simulate external sort limits, we'd need cgroups, but we can benchmark
    # the sheer I/O + Sort throughput anyway.
    sorted_data = np.sort(mmap_arr)
    
    # Write to output
    with open(output_filename, 'wb') as f:
        f.write(sorted_data.tobytes())
        
    duration = time.time() - start_time
    file_size_mb = os.path.getsize(filename) / (1024 * 1024)
    print(f"    -> Time: {duration:.2f}s | Throughput: {file_size_mb / duration:.1f} MB/s")

def bench_silica_external(filename: str, output_filename: str):
    print("  [Optimized] Silica Sort External (Pipelined)...")
    start_time = time.time()
    
    silica_sort.sort_file(filename, output_filename)
    
    duration = time.time() - start_time
    file_size_mb = os.path.getsize(filename) / (1024 * 1024)
    print(f"    -> Time: {duration:.2f}s | Throughput: {file_size_mb / duration:.1f} MB/s")

def verify_sorted(filename: str):
    print("  Verifying sort correctness...")
    mmap_arr = np.memmap(filename, dtype=np.float64, mode='r')
    # Check if monotonically increasing
    is_sorted = np.all(mmap_arr[:-1] <= mmap_arr[1:])
    print(f"    -> Status: {'OK' if is_sorted else 'FAILED'}")

def main():
    sizes_mb = [100, 500, 1000] # 100MB, 500MB, 1GB
    
    for size in sizes_mb:
        input_file = f"test_data_{size}MB.bin"
        out_numpy = f"out_numpy_{size}MB.bin"
        out_silica = f"out_silica_{size}MB.bin"
        
        print(f"\n{'='*60}")
        print(f" EXTERNAL SORT BENCHMARK: {size} MB")
        print(f"{'='*60}")
        
        generate_large_file(input_file, size)
        
        bench_numpy_mmap(input_file, out_numpy)
        gc.collect()
        
        bench_silica_external(input_file, out_silica)
        verify_sorted(out_silica)
        
        # Cleanup
        for f in [input_file, out_numpy, out_silica]:
            if os.path.exists(f):
                os.remove(f)

if __name__ == "__main__":
    main()
