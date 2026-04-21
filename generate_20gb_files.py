import numpy as np
import os
import time

def generate_large_dataset(filename: str, sorted_filename: str, target_gb: int = 20):
    elements_per_gb = (1024 ** 3) // 8
    total_elements = target_gb * elements_per_gb
    chunk_size = elements_per_gb // 4 
    
    print(f"Generating {target_gb} GB dataset ({total_elements} elements)...")
    print(f"This will require {target_gb * 2} GB of free disk space.")
    
    stat = os.statvfs('.')
    free_space_gb = (stat.f_bavail * stat.f_frsize) / (1024 ** 3)
    if free_space_gb < (target_gb * 2.2):
        print(f"WARNING: You only have {free_space_gb:.1f} GB of free space.")
        print(f"Generating {target_gb}GB files requires ~{target_gb*2} GB.")
        response = input("Do you want to create smaller files instead? (y/N): ")
        if response.lower() == 'y':
            target_gb = int(input("Enter new size in GB: "))
            total_elements = target_gb * elements_per_gb

    print(f"\nWriting {filename}...")
    t0 = time.time()
    with open(filename, 'wb') as f:
        elements_written = 0
        while elements_written < total_elements:
            write_size = min(chunk_size, total_elements - elements_written)
            chunk = np.random.rand(write_size).astype(np.float64)
            f.write(chunk.tobytes())
            elements_written += write_size
            print(f"  Progress: {elements_written / total_elements * 100:.1f}%")
    
    print(f"Finished writing raw dataset in {time.time() - t0:.1f} seconds.")
    
    print(f"\nWriting {sorted_filename} using Silica External Sort...")
    import silica_sort
    t0 = time.time()
    silica_sort.sort_file(filename, sorted_filename)
    print(f"Finished globally sorting dataset in {time.time() - t0:.1f} seconds.")
    
    print("\nFiles are ready for the dashboard!")

if __name__ == "__main__":
    generate_large_dataset("dataset_20gb.bin", "dataset_20gb_sorted.bin", target_gb=20)
