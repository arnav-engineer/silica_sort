# Silica Sort

**A High-Performance Learned Sorting Architecture for In-Memory and External Workloads.**

Silica Sort is a hybrid, production-grade sorting framework built in Rust with Python bindings. It leverages hardware-specific optimizations (SIMD) and learned index structures (Recursive Model Indexes) to significantly outperform standard sorting algorithms like `pdqsort` and mergesort, particularly for large numeric arrays.

## 🚀 Performance Dashboard

The project includes a posh, luxury-themed dashboard inspired by Apple's UI philosophy to benchmark and visualize Silica Sort's performance.

### Features
- **In-Memory Analysis**: Compare Silica Sort against NumPy and Rust Standard Library across various distributions (Normal, Uniform, Binary, Mostly Sorted).
- **Interactive Visualizers**: Real-time canvas-based visualizations of partitioning and merging behaviors.
- **Out-of-Core Simulation**: A dedicated pipeline for massive datasets (e.g., 20 GB) that simulates real-world failures of standard libraries (OOM crashes) and highlights Silica's robust execution.
- **Accuracy Verification**: Bit-for-bit integrity checks against baseline standards for every run.
- **Indian Numbering Support**: All metrics are localized (Lakhs/Crores) for clear communication.

### Running the Dashboard
Ensure you have `uv` and `npm` installed, then run:
```bash
./run_dashboard.sh
```
This will launch the FastAPI backend (Port 8000) and the Vite frontend simultaneously.

---

## 🛠 Technical Highlights

- **Learned Indexing (RMI)**: Uses a fast linear regression model trained on a data sample to predict the approximate position of elements, enabling `O(N)` expected time complexity.
- **SIMD Acceleration**: Fallback sorting for small buckets uses AVX2 sorting networks for maximum throughput.
- **External Sort Pipeline**: Automatically handles files larger than available RAM using an optimized chunked architecture with K-Way merge.
- **Zero-Copy In-Place Sorting**: Native Python bindings (PyO3) allow sorting NumPy arrays directly in memory without GIL overhead.

---

## 📂 Out-of-Core Setup
To test the "Out of Memory" capabilities with real data files (40 GB total disk space required):
1. Run the generation script:
   ```bash
   uv run python generate_20gb_files.py
   ```
2. The dashboard will automatically detect these files and enable the full simulation pipeline.

## 🏗 Installation

### Requirements
- Rust (Cargo)
- Python 3.9+
- `uv` (recommended)
- Node.js & npm

### Build from Source
```bash
# Build the python extension
uv pip install -e .
```

## ⚖️ License
Licensed under the Apache License, Version 2.0.
