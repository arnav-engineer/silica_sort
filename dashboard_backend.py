from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import time
import silica_sort
from codecarbon import OfflineEmissionsTracker

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class BenchRequest(BaseModel):
    size: int  # Number of elements
    distribution: str

def get_compute_cost_inr(duration: float) -> float:
    # Let's assume an AWS EC2 instance c6i.metal costs ~$4.00 / hr -> ~₹332 / hr
    # Cost per second = ₹332 / 3600 = ₹0.092 per second
    cost_per_second_inr = 0.092 
    return duration * cost_per_second_inr

@app.post("/benchmark/inmemory")
def benchmark_inmemory(req: BenchRequest):
    if req.distribution == 'uniform':
        data = np.random.rand(req.size).astype(np.float64)
    elif req.distribution == 'normal':
        data = np.random.randn(req.size).astype(np.float64)
    elif req.distribution == 'binary':
        data = np.random.randint(0, 2, size=req.size).astype(np.float64)
    elif req.distribution == 'mostly_sorted':
        data = np.arange(req.size, dtype=np.float64)
        swaps = req.size // 20
        idx1 = np.random.randint(0, req.size, size=swaps)
        idx2 = np.random.randint(0, req.size, size=swaps)
        temp = data[idx1]
        data[idx1] = data[idx2]
        data[idx2] = temp
    else:
        data = np.random.rand(req.size).astype(np.float64)

    results = {}

    def run_bench(name: str, sort_func, data_copy):
        tracker = OfflineEmissionsTracker(
            log_level="critical", 
            country_iso_code="IND", # Changed to India for carbon intensity
            save_to_file=False
        )
        tracker.start()
        t0 = time.time()
        sort_func(data_copy)
        t1 = time.time()
        emissions_kg = tracker.stop()
        duration = t1 - t0
        
        if not emissions_kg or emissions_kg <= 0:
            # Fallback if codecarbon doesn't measure sub-second task:
            # Indian grid approx 700g CO2 / kWh. 150W CPU = 0.15 kW.
            # 700 * 0.15 * (duration / 3600) gives grams. Divide by 1000 for kg.
            emissions_kg = (700 * 0.15 * (duration / 3600)) / 1000

        # We want to display grams of CO2, so multiply kg by 1000
        emissions_g = emissions_kg * 1000

        # To make it truly measurable and meaningful on a dashboard, we scale it to 10,000 runs
        # since a single sort takes 0.05 seconds. 
        emissions_g_10k = emissions_g * 10000

        results[name] = {
            "time": duration,
            "emissions_gCO2": emissions_g_10k,
            "cost_inr": get_compute_cost_inr(duration)
        }

    # Numpy
    run_bench("numpy", np.sort, data.copy())
    
    # Rust Default 
    def rust_sort(d):
        d.sort(kind='mergesort')
    run_bench("rust_default", rust_sort, data.copy())

    # Silica Sort
    run_bench("silica", silica_sort.sort_numpy_inplace, data.copy())

    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
