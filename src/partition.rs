use crate::rmi::MonotonicRMI;
use rayon::prelude::*;

pub struct PartitionedData {
    pub data: Vec<f64>,
    pub bucket_offsets: Vec<usize>,
}

/// Coarse partition using RMI. Uses few buckets (num_threads * 2) for cache-friendly scatter.
/// Partitions from `data` into a newly allocated output buffer.
pub fn parallel_partition(data: &[f64], rmi: &MonotonicRMI) -> PartitionedData {
    let n = data.len();
    let num_buckets = rmi.num_buckets;
    let num_threads = rayon::current_num_threads().max(1);
    let chunk_size = n.div_ceil(num_threads);
    let num_chunks = n.div_ceil(chunk_size);

    // Pass 1: Per-thread histograms
    let mut local_histograms = vec![0usize; num_chunks * num_buckets];

    data.par_chunks(chunk_size)
        .zip(local_histograms.par_chunks_mut(num_buckets))
        .for_each(|(chunk, hist)| {
            for &x in chunk {
                hist[rmi.predict(x)] += 1;
            }
        });

    // Global prefix sum + per-thread write offsets
    let mut global_offsets = vec![0usize; num_buckets + 1];
    let mut thread_starts = vec![0usize; num_chunks * num_buckets];

    let mut offset = 0usize;
    for b in 0..num_buckets {
        global_offsets[b] = offset;
        for c in 0..num_chunks {
            thread_starts[c * num_buckets + b] = offset;
            offset += local_histograms[c * num_buckets + b];
        }
    }
    global_offsets[num_buckets] = n;

    // Pass 2: Parallel scatter
    let mut output: Vec<f64> = Vec::with_capacity(n);
    unsafe { output.set_len(n); }
    let out_ptr = output.as_mut_ptr() as usize;

    data.par_chunks(chunk_size)
        .enumerate()
        .for_each(|(c_idx, chunk)| {
            let base = c_idx * num_buckets;
            let mut offsets = vec![0usize; num_buckets];
            for b in 0..num_buckets {
                offsets[b] = thread_starts[base + b];
            }

            let ptr = out_ptr as *mut f64;
            for &x in chunk {
                let b = rmi.predict(x);
                unsafe { *ptr.add(offsets[b]) = x; }
                offsets[b] += 1;
            }
        });

    PartitionedData {
        data: output,
        bucket_offsets: global_offsets,
    }
}
