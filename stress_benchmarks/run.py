import time
import numpy as np
import silica_sort
import gc
import os
import tempfile

def generate_data(size, dist):
    rng = np.random.default_rng(1337)
    if dist == 'uniform':
        return rng.uniform(-1e6, 1e6, size).astype(np.float64)
    elif dist == 'normal':
        return rng.normal(0, 1, size).astype(np.float64)
    elif dist == 'exponential':
        return rng.exponential(1.0, size).astype(np.float64)
    elif dist == 'binary':
        return rng.choice([0.0, 1.0], size=size).astype(np.float64)
    elif dist == 'low_cardinality':
        return rng.choice(np.linspace(0, 100, 16), size=size).astype(np.float64)
    elif dist == 'sorted':
        return np.arange(size, dtype=np.float64)
    elif dist == 'reverse':
        return np.arange(size, 0, -1, dtype=np.float64)
    elif dist == 'mostly_sorted':
        arr = np.arange(size, dtype=np.float64)
        num_swaps = max(1, size // 100)
        idx1 = rng.integers(0, size, num_swaps)
        idx2 = rng.integers(0, size, num_swaps)
        arr[idx1], arr[idx2] = arr[idx2], arr[idx1]
        return arr
    else:
        raise ValueError(f"Unknown dist: {dist}")

def verify(arr):
    if len(arr) < 2:
        return True
    return bool(np.all(arr[:-1] <= arr[1:]))

def run_benchmarks():
    sizes = [10_000, 1_000_000, 10_000_000, 50_000_000]
    dists = ['uniform', 'normal', 'binary', 'low_cardinality', 'mostly_sorted']
    
    print(f"\n================================================================================")
    print(f"  SILICA SORT BENCHMARK SUITE")
    print(f"================================================================================")
    sys_info = silica_sort.get_system_info()
    print(f"Hardware Info: L1 Cache: {sys_info.get('l1_cache_size', 'Unknown')} B | L2 Cache: {sys_info.get('l2_cache_size', 'Unknown')} B | SIMD: {sys_info.get('simd_level', 'Unknown')}")
    
    for size in sizes:
        mb = size * 8 / (1024 * 1024)
        print(f"\n\n>>> ARRAY SIZE: {size:,} elements ({mb:.1f} MB)")
        
        # Header
        print(f"{'-'*92}")
        print(f"{'Distribution':<16} | {'Algorithm':<18} | {'Time (s)':<9} | {'Throughput':<14} | {'Status':<6} | {'Speedup'}")
        print(f"{'-'*92}")
        
        for dist in dists:
            data = generate_data(size, dist)
            
            competitors = {
                'NumPy Quicksort': lambda arr: np.sort(arr, kind='quicksort'),
                'NumPy Stable':    lambda arr: np.sort(arr, kind='stable'),
                'Silica Sort':  lambda arr: silica_sort.sort_numpy_inplace(arr),
            }
            
            baseline_time = None
            
            for i, (name, func) in enumerate(competitors.items()):
                gc.collect()
                arr_copy = data.copy()
                
                start_time = time.perf_counter()
                try:
                    res = func(arr_copy)
                    duration = time.perf_counter() - start_time
                    
                    if res is None:
                        res = arr_copy
                        
                    is_sorted = verify(res)
                    mb_s = mb / duration if duration > 0 else 0
                    status = "OK" if is_sorted else "FAIL"
                    
                    if name == 'NumPy Quicksort':
                        baseline_time = duration
                    
                    speedup = f"{baseline_time / duration:.2f}x" if baseline_time and duration > 0 else "-"
                    
                    # Formatting logic for column
                    dist_label = dist if i == 0 else ""
                    print(f"{dist_label:<16} | {name:<18} | {duration:>8.4f}s | {mb_s:>8.1f} MB/s | {status:<6} | {speedup}")
                except Exception as e:
                    dist_label = dist if i == 0 else ""
                    print(f"{dist_label:<16} | {name:<18} | FAILED: {str(e)}")
                
                del arr_copy
                if 'res' in locals() and res is not None:
                    del res
            print(f"{'-'*92}")

    print("\n\n>>> EXTERNAL FILE SORT BENCHMARK")
    size = 10_000_000  # 80 MB file
    mb = size * 8 / (1024 * 1024)
    print(f"Generating {mb:.1f} MB file...")
    data = generate_data(size, 'uniform')
    
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.bin")
        output_path = os.path.join(tmpdir, "output.bin")
        
        with open(input_path, 'wb') as f:
            f.write(data.tobytes())
            
        del data
        gc.collect()
        
        print("Sorting external file...")
        start_time = time.perf_counter()
        silica_sort.sort_file(input_path, output_path)
        duration = time.perf_counter() - start_time
        
        mb_s = mb / duration if duration > 0 else 0
        
        # Verify
        sorted_data = np.fromfile(output_path, dtype=np.float64)
        is_sorted = verify(sorted_data)
        status = "OK" if is_sorted else "FAIL"
        
        print(f"External Sort Result: {duration:.4f}s | {mb_s:.1f} MB/s | {status}")


if __name__ == '__main__':
    run_benchmarks()
