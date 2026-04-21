import React, { useEffect, useRef } from 'react';

const ARRAY_SIZE = 40;

export default function SortVisualizer({ isActive, isComplete, speedScale = 1, type = 'standard' }) {
  const canvasRef = useRef(null);
  
  // Mutable state refs (bypassing React render cycle for max performance)
  const arrayRef = useRef([]);
  const highlightsRef = useRef([-1, -1]);
  const isSortedRef = useRef(false);
  
  const framesRef = useRef([]);
  const frameIndexRef = useRef(0);
  const animFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  // Theme Colors
  const COLOR_DEFAULT = '#1A2849'; // var(--border-color)
  const COLOR_GOLD = '#D4AF37';
  const COLOR_GOLD_LIGHT = '#F3E5AB';
  const COLOR_GREEN = '#34C759';
  const COLOR_WHITE = '#F8F9FA';
  const COLOR_GREY = '#90A0B2';

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Support high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const arr = arrayRef.current;
    const barWidth = width / ARRAY_SIZE;
    
    for (let i = 0; i < arr.length; i++) {
      const val = arr[i];
      const barHeight = (val / 100) * height;
      const x = i * barWidth;
      const y = height - barHeight;
      
      let color = COLOR_DEFAULT;
      if (isSortedRef.current) {
        color = type === 'silica' ? COLOR_GOLD : COLOR_GREY;
      } else if (highlightsRef.current.includes(i)) {
        color = type === 'silica' ? COLOR_GOLD_LIGHT : COLOR_WHITE;
      }
      
      ctx.fillStyle = color;
      // Gap of 2px between bars
      ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
    }
    ctx.scale(1/dpr, 1/dpr); // Reset scale for next draw
  };

  useEffect(() => {
    if (!isActive && !isComplete) {
      const newArr = [];
      for (let i = 0; i < ARRAY_SIZE; i++) {
        newArr.push(Math.floor(Math.random() * 90) + 10);
      }
      arrayRef.current = newArr;
      isSortedRef.current = false;
      highlightsRef.current = [-1, -1];
      
      framesRef.current = generateFrames([...newArr], type);
      frameIndexRef.current = 0;
      
      // Draw initial state immediately
      draw();
    }
  }, [isActive, isComplete, type]);

  useEffect(() => {
    // Only start if isActive is true and we aren't already animating
    if (isActive) {
      const fps = 60 * speedScale; 
      const frameInterval = 1000 / fps;
      lastFrameTimeRef.current = performance.now();

      const loop = (timestamp) => {
        const elapsed = timestamp - lastFrameTimeRef.current;
        
        if (elapsed >= frameInterval) {
          const framesToAdvance = Math.floor(elapsed / frameInterval);
          
          if (frameIndexRef.current < framesRef.current.length) {
            frameIndexRef.current = Math.min(frameIndexRef.current + framesToAdvance, framesRef.current.length - 1);
            const frame = framesRef.current[frameIndexRef.current];
            arrayRef.current = frame.arr;
            highlightsRef.current = frame.highlights || [-1, -1];
            draw();
            
            lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);
            animFrameRef.current = requestAnimationFrame(loop);
          } else {
            // Reached the end
            isSortedRef.current = true;
            highlightsRef.current = [-1, -1];
            draw();
            animFrameRef.current = null;
          }
        } else {
          animFrameRef.current = requestAnimationFrame(loop);
        }
      };
      
      if (!animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    }

    // Note: We intentionally don't cancel on isActive change so animation finishes
  }, [isActive, speedScale]);

  // Handle unmount separately
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const generateFrames = (arr, type) => {
    const frames = [];
    const push = (a, h1 = -1, h2 = -1) => {
      frames.push({ arr: [...a], highlights: [h1, h2] });
    };

    if (type === 'silica') {
      // Silica Sort (Learned Sort approximation)
      // Phase 1: Bucket Scatter (using predicted CDF)
      const targetArr = [...arr].sort((a,b) => a-b);
      let buckets = Array.from({length: 10}, () => []);
      for(let i=0; i<arr.length; i++) {
        let bucketIdx = Math.min(9, Math.floor((arr[i] - 10) / 9)); // values are 10-100
        buckets[bucketIdx].push(arr[i]);
        push(arr, i, -1);
      }
      
      let idx = 0;
      for(let b=0; b<10; b++) {
        for(let v of buckets[b]) {
           arr[idx++] = v;
        }
        push(arr, -1, -1);
      }
      
      // Phase 2: Local SIMD sort (insertion sort)
      for(let i=1; i<arr.length; i++) {
        let val = arr[i];
        let j = i;
        while(j > 0 && arr[j-1] > val) {
           arr[j] = arr[j-1];
           push(arr, j, j-1);
           j--;
        }
        arr[j] = val;
        push(arr, j, -1);
      }
    } else if (type === 'mergesort') {
      // Mergesort
      const mergeSortHelper = (a, left, right) => {
        if (left >= right) return;
        let mid = Math.floor((left + right) / 2);
        mergeSortHelper(a, left, mid);
        mergeSortHelper(a, mid + 1, right);
        
        let i = left;
        let j = mid + 1;
        let temp = [];
        while (i <= mid && j <= right) {
          push(a, i, j);
          if (a[i] <= a[j]) {
            temp.push(a[i++]);
          } else {
            temp.push(a[j++]);
          }
        }
        while (i <= mid) temp.push(a[i++]);
        while (j <= right) temp.push(a[j++]);
        
        for (let k = left; k <= right; k++) {
          a[k] = temp[k - left];
          push(a, k, -1);
        }
      };
      mergeSortHelper(arr, 0, arr.length - 1);
    } else {
      // Quicksort (Default)
      const doQuickSort = (a, low, high) => {
          if (low < high) {
              let pivot = a[high];
              let i = low - 1;
              for (let j = low; j < high; j++) {
                  push(a, j, high);
                  if (a[j] < pivot) {
                      i++;
                      let temp = a[i];
                      a[i] = a[j];
                      a[j] = temp;
                      push(a, i, j);
                  }
              }
              let temp = a[i + 1];
              a[i + 1] = a[high];
              a[high] = temp;
              push(a, i+1, high);
              return i + 1;
          }
          return low;
      };
      
      const qs = (a, low, high) => {
          if(low < high) {
              let pi = doQuickSort(a, low, high);
              qs(a, low, pi - 1);
              qs(a, pi + 1, high);
          }
      };
      
      qs(arr, 0, arr.length - 1);
    }
    
    return frames;
  };

  return (
    <div style={{ width: '100%', height: '120px', marginTop: '1.5rem', marginBottom: '2.5rem' }}>
      <canvas 
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
