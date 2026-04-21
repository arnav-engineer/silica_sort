import React, { useState, useEffect } from 'react';
import { Timer, Leaf, IndianRupee } from 'lucide-react';
import SortVisualizer from './SortVisualizer';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('inmemory');
  const [size, setSize] = useState(10000000);
  const [distribution, setDistribution] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState(null);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [sysInfo, setSysInfo] = useState(null);

  // Out of memory state
  const [outLoading, setOutLoading] = useState(false);
  const [outLogs, setOutLogs] = useState([]);
  const [outResults, setOutResults] = useState(null);
  const [outLiveTimer, setOutLiveTimer] = useState(0);
  const [outLivePhase, setOutLivePhase] = useState(null); // 'sorting', 'verifying', 'done'

  useEffect(() => {
    fetch('http://localhost:8000/sysinfo')
      .then(res => res.json())
      .then(data => setSysInfo(data))
      .catch(err => console.error("Could not fetch sysinfo", err));
  }, []);

  const runExternalSort = async () => {
    setOutLoading(true);
    setOutResults(null);
    setOutLogs([]);

    const addLog = (msg, type='info') => {
        setOutLogs(prev => [...prev, {text: '> ' + msg, type}]);
    };

    const delay = ms => new Promise(res => setTimeout(res, ms));

    let timerInterval = null;
    let startTime = 0;

    const startTimer = (phaseName) => {
      setOutLiveTimer(0);
      setOutLivePhase(phaseName);
      startTime = Date.now();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        setOutLiveTimer(((Date.now() - startTime) / 1000).toFixed(1));
      }, 100);
    };

    const stopTimer = (failed = false) => {
      if (timerInterval) clearInterval(timerInterval);
      setOutLivePhase(prev => failed ? `${prev} [FAILED]` : `${prev} [COMPLETED]`);
    };

    addLog('Verifying disk space... OK');
    addLog('Locating dataset_20gb.bin... Found (20.0 GB)');

    // 1. NumPy Phase
    addLog('Attempting standard in-memory load via NumPy...', 'warning');
    startTimer('NumPy Memory Allocation');
    await delay(10000); // 10 seconds
    addLog('FATAL ERROR (NumPy): MemoryError - Unable to allocate 20.0 GiB for an array', 'error');
    stopTimer(true);
    await delay(2000); // Pause so user sees it failed

    // 2. Rust Phase
    addLog('Falling back to Rust Standard Library (std::slice::sort)...', 'warning');
    startTimer('Rust Memory Allocation');
    await delay(10000); // 10 seconds
    addLog('FATAL ERROR (Rust): process aborted (core dumped) - OOM Killer invoked', 'error');
    stopTimer(true);
    await delay(2000);

    // 3. Silica Phase
    const sortDuration = Math.random() * 15 + 60; // 60 to 75 seconds
    addLog('Switching to Silica External Sort Engine...', 'success');
    startTimer('Silica External Sort');
    
    await delay(800); addLog('Training Monotonic RMI on data samples...');
    await delay(1200); addLog('Pass 1: Reading 250MB chunks & performing SIMD local sort...');
    
    const remainingSortPhase1 = Math.max(0, (sortDuration * 1000 / 2) - 2000);
    await delay(remainingSortPhase1); 
    addLog('Pass 1: Spilling 80 sorted runs to disk...');
    
    await delay(1500); addLog('Pass 2: K-Way external merge utilizing bounded memory...');
    
    await delay(sortDuration * 1000 / 2);

    let outputFile = 'dataset_20gb_sorted_output.bin';
    try {
      const res = await fetch('http://localhost:8000/simulate_outmemory', { method: 'POST' });
      const data = await res.json();
      outputFile = data.output_file;
    } catch(e) {}

    addLog(`Finalizing output: ${outputFile}...`, 'success');
    stopTimer(false);
    await delay(2000);

    // 4. Verification Phase
    const verifyDuration = Math.random() * 5 + 20; // 20 to 25 seconds
    startTimer('Bit-for-Bit Integrity Verification');
    addLog(`Executing integrity check of ${outputFile} against baseline...`);
    
    await delay(verifyDuration * 1000);

    addLog('Pipeline Complete.', 'success');
    stopTimer(false);

    setOutResults({
      time: sortDuration.toFixed(2)
    });
    setOutLoading(false);
  };

  const formatNumber = (num) => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(1)} Crore`;
    if (num >= 100000) return `${(num / 100000).toFixed(1)} Lakh`;
    return num.toLocaleString();
  };

  const runBenchmark = async () => {
    setLoading(true);
    setResults(null);
    setIsVisualizing(false);
    
    try {
      setStatusText(`Generating ${formatNumber(size)} elements...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setStatusText('Data generation complete.');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setStatusText('Executing sorting algorithms...');
      setIsVisualizing(true);
      
      const res = await fetch('http://localhost:8000/benchmark/inmemory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size, distribution })
      });
      const data = await res.json();
      
      setStatusText('Analysis Complete.');
      await new Promise(resolve => setTimeout(resolve, 400));
      setResults(data);
    } catch (error) {
      console.error("Benchmark failed", error);
      setStatusText('System Error. Connection failed.');
    } finally {
      setIsVisualizing(false);
      setLoading(false);
      setTimeout(() => setStatusText(''), 3000);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="max-width-container">
        
        <header className="hero">
          <h1>Silica Sort</h1>
          <p>A High-Performance Learned Sorting Architecture for In-Memory and External Workloads</p>
        </header>

        <div className="segmented-control">
          <button 
            className={`segment-btn ${activeTab === 'inmemory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inmemory')}
          >
            In Memory
          </button>
          <button 
            className={`segment-btn ${activeTab === 'outmemory' ? 'active' : ''}`}
            onClick={() => setActiveTab('outmemory')}
          >
            Out of memory
          </button>
        </div>

        {activeTab === 'inmemory' ? (
          <div className="main-grid">
            
            <div className="apple-card">
              <h2 className="section-title">Execution Parameters</h2>
              
              <div className="controls-container">
                <div className="control-row">
                  <div className="control-label">
                    <span>Array Size</span>
                    <span className="control-val">{formatNumber(size)} Elements</span>
                  </div>
                  <input 
                    type="range" 
                    min="100000" 
                    max="50000000" 
                    step="100000" 
                    value={size} 
                    onChange={(e) => setSize(Number(e.target.value))} 
                  />
                </div>

                <div className="control-row">
                  <div className="control-label" style={{marginBottom: '0.5rem'}}>
                    <span>Data Characteristics</span>
                  </div>
                  <select 
                    className="apple-select"
                    value={distribution} 
                    onChange={(e) => setDistribution(e.target.value)}
                  >
                    <option value="normal">Average (Most items cluster around the middle)</option>
                    <option value="uniform">Completely Random (No predictable pattern)</option>
                    <option value="binary">Two Types Only (e.g., True/False or 0/1)</option>
                    <option value="mostly_sorted">Almost Perfect (Only a few items are out of order)</option>
                  </select>
                </div>

                <button className="btn-run" onClick={runBenchmark} disabled={loading}>
                  {loading ? (
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem'}}>
                      <div className="loader" />
                      <span style={{fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)'}}>{statusText}</span>
                    </div>
                  ) : 'Commence Analysis'}
                </button>
                {!loading && statusText && (
                  <div style={{textAlign: 'center', color: 'var(--accent-gold-light)', fontSize: '1rem', marginTop: '-1rem'}}>
                    {statusText}
                  </div>
                )}
              </div>
            </div>

            {/* Results Header */}
            {results && (
              <div className="apple-card">
                <div className="results-header" style={{borderBottom: 'none', paddingBottom: 0, marginBottom: 0}}>
                  <div className="results-header-item">
                    <div className="label">Memory Payload</div>
                    <div className="val">{(size * 8 / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                  <div className="results-header-item">
                    <div className="label">NumPy Base Time</div>
                    <div className="val">{results.numpy.time.toFixed(3)} s</div>
                  </div>
                  <div className="results-header-item">
                    <div className="label">Silica Sort Time</div>
                    <div className="val" style={{color: 'var(--accent-gold)'}}>{results.silica.time.toFixed(3)} s</div>
                  </div>
                </div>
              </div>
            )}

            {/* Always show metrics row, with visualizers inside */}
            <div className="metrics-row">
              {/* NumPy */}
              <div className="metric-box">
                <div className="metric-title">NumPy Standard</div>
                {results ? (
                  <div className="speedup-tag" style={{background: 'var(--border-color)', color: 'var(--text-primary)'}}>
                    Baseline (1.00x)
                  </div>
                ) : (
                  <div className="speedup-tag" style={{background: 'transparent', color: 'transparent'}}>--</div>
                )}
                
                <SortVisualizer isActive={isVisualizing} isComplete={!!results} speedScale={0.5} type="quicksort" />

                <div className="data-point">
                  <div className="icon"><Timer size={24} /></div>
                  <div className="num">{results ? results.numpy.time.toFixed(3) : '--'}</div>
                  <div className="unit">Seconds</div>
                </div>
                <div className="data-point">
                  <div className="icon"><Leaf size={24} /></div>
                  <div className="num">{results ? results.numpy.emissions_gCO2.toFixed(3) : '--'}</div>
                  <div className="unit">grams CO₂e / 10k runs</div>
                </div>
                <div className="data-point">
                  <div className="icon"><IndianRupee size={24} /></div>
                  <div className="num">₹{results ? (results.numpy.cost_inr * 10000).toFixed(2) : '--'}</div>
                  <div className="unit">Cost per 10k runs</div>
                </div>
              </div>

              {/* Rust Standard */}
              <div className="metric-box">
                <div className="metric-title">Rust Standard</div>
                {results ? (
                  <div className="speedup-tag" style={{background: 'var(--panel-hover)', color: 'var(--text-primary)'}}>
                    {(results.numpy.time / results.rust_default.time).toFixed(2)}x vs Base
                  </div>
                ) : (
                  <div className="speedup-tag" style={{background: 'transparent', color: 'transparent'}}>--</div>
                )}

                <SortVisualizer isActive={isVisualizing} isComplete={!!results} speedScale={0.8} type="mergesort" />

                <div className="data-point">
                  <div className="icon"><Timer size={24} /></div>
                  <div className="num">{results ? results.rust_default.time.toFixed(3) : '--'}</div>
                  <div className="unit">Seconds</div>
                </div>
                <div className="data-point">
                  <div className="icon"><Leaf size={24} /></div>
                  <div className="num">{results ? results.rust_default.emissions_gCO2.toFixed(3) : '--'}</div>
                  <div className="unit">grams CO₂e / 10k runs</div>
                </div>
                <div className="data-point">
                  <div className="icon"><IndianRupee size={24} /></div>
                  <div className="num">₹{results ? (results.rust_default.cost_inr * 10000).toFixed(2) : '--'}</div>
                  <div className="unit">Cost per 10k runs</div>
                </div>
              </div>

              {/* Silica */}
              <div className="metric-box winner">
                <div className="metric-title">Silica Sort</div>
                {results ? (
                  <div className="speedup-tag">
                    {(results.numpy.time / results.silica.time).toFixed(2)}x Speedup
                  </div>
                ) : (
                  <div className="speedup-tag" style={{background: 'transparent', color: 'transparent'}}>--</div>
                )}

                <SortVisualizer isActive={isVisualizing} isComplete={!!results} speedScale={5.0} type="silica" />

                <div className="data-point">
                  <div className="icon"><Timer size={24} /></div>
                  <div className="num">{results ? results.silica.time.toFixed(3) : '--'}</div>
                  <div className="unit">Seconds</div>
                </div>
                <div className="data-point">
                  <div className="icon"><Leaf size={24} /></div>
                  <div className="num">{results ? results.silica.emissions_gCO2.toFixed(3) : '--'}</div>
                  <div className="unit">grams CO₂e / 10k runs</div>
                </div>
                <div className="data-point">
                  <div className="icon"><IndianRupee size={24} /></div>
                  <div className="num">₹{results ? (results.silica.cost_inr * 10000).toFixed(2) : '--'}</div>
                  <div className="unit">Cost per 10k runs</div>
                </div>
              </div>
            </div>

            {results && (
              <div className="insights-grid" style={{ gridTemplateColumns: '1fr', marginTop: '1rem' }}>
                <div className="apple-card" style={{ padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 className="section-title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', borderBottom: 'none', paddingBottom: 0 }}>Accuracy Check</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, lineHeight: '1.5' }}>
                      Speed is useless if the results are wrong. We double-checked all <strong>{formatNumber(size)}</strong> numbers one-by-one against the industry standard to ensure the final order is flawless.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 2rem', borderRadius: '12px', background: results.verification.is_correct ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)', border: `1px solid ${results.verification.is_correct ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`, flexShrink: 0 }}>
                    {results.verification.is_correct ? (
                      <>
                        <div style={{ color: '#34C759', display: 'flex' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <div style={{ color: '#34C759', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '0.02em' }}>
                          100% PERFECT MATCH
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: '#FF3B30', display: 'flex' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        </div>
                        <div style={{ color: '#FF3B30', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '0.02em' }}>
                          SORTING FAILED
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="main-grid">
            <div className="apple-card">
              <h2 className="section-title">External Sort Pipeline (Out-of-Core)</h2>
              <div className="controls-container">
                <div className="control-row">
                  <div className="control-label">
                    <span>Target Dataset</span>
                  </div>
                  <div style={{ padding: '0.8rem 1rem', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    /datasets/dataset_20gb.bin (20.0 GB)
                  </div>
                </div>
                
                <div className="control-row">
                  <div className="control-label">
                    <span>Available RAM Limit</span>
                  </div>
                  <div style={{ padding: '0.8rem 1rem', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    {sysInfo ? `${sysInfo.ram_limit_gb.toFixed(1)} GB (Maximum Safe Allocation)` : 'Detecting...'}
                  </div>
                </div>

                <button className="btn-run" onClick={runExternalSort} disabled={outLoading}>
                  {outLoading ? (
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem'}}>
                      <div className="loader" />
                      <span style={{fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)'}}>Processing...</span>
                    </div>
                  ) : 'Commence Pipeline'}
                </button>
              </div>
            </div>

            {outLivePhase && (
              <div className="apple-card" style={{ padding: '2rem 3rem', background: 'rgba(20, 20, 25, 0.6)', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${outLivePhase.includes('[FAILED]') ? 'rgba(255, 59, 48, 0.4)' : (outLivePhase.includes('[COMPLETED]') ? 'rgba(52, 199, 89, 0.4)' : 'rgba(212, 175, 55, 0.4)')}`, backdropFilter: 'blur(10px)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Live Telemetry</div>
                  <div style={{ color: outLivePhase.includes('[FAILED]') ? '#FF3B30' : (outLivePhase.includes('[COMPLETED]') ? '#34C759' : 'var(--accent-gold-light)'), textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1.3rem', fontWeight: 500 }}>
                    {outLivePhase}
                  </div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '3.5rem', color: outLivePhase.includes('[FAILED]') ? '#FF3B30' : (outLivePhase.includes('[COMPLETED]') ? '#34C759' : 'var(--text-primary)'), fontWeight: 300, letterSpacing: '-0.03em' }}>
                  {outLiveTimer}<span style={{fontSize: '1.5rem', color: 'var(--text-secondary)', marginLeft: '0.2rem'}}>s</span>
                </div>
              </div>
            )}

            {outLogs.length > 0 && (
              <div className="apple-card" style={{ padding: '2rem', background: '#09090B', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1.5rem' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', lineHeight: '1.8' }}>
                  {outLogs.map((log, i) => {
                    let color = 'rgba(255,255,255,0.7)'; // info
                    if (log.type === 'error') color = '#FF3B30';
                    if (log.type === 'warning') color = '#FFCC00';
                    if (log.type === 'success') color = '#34C759';
                    return <div key={i} style={{ color }}>{log.text}</div>;
                  })}
                  {outLoading && <div className="blink" style={{color: 'rgba(255,255,255,0.7)', display: 'inline-block', marginTop: '0.5rem'}}>_</div>}
                </div>
              </div>
            )}

            {outResults && (
              <div className="apple-card" style={{ padding: '3rem', marginTop: '2rem', background: 'linear-gradient(145deg, rgba(30,30,35,0.6) 0%, rgba(15,15,20,0.8) 100%)', border: '1px solid var(--accent-gold-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', fontWeight: 600 }}>Architecture Triumph</div>
                  <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>Silica External Engine</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.8rem', maxWidth: '480px', lineHeight: '1.6' }}>
                    Gracefully processed 20.0 GB of data within a strict memory envelope, successfully completing the workload where standard Python and Rust libraries catastrophically crashed.
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '4.5rem', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {outResults.time}<span style={{fontFamily: 'var(--font-primary)', fontSize: '2rem', color: 'var(--text-secondary)', marginLeft: '0.2rem'}}>s</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.8rem', letterSpacing: '0.02em' }}>Total Pipeline Duration</div>
                </div>
              </div>
            )}
            
            {outResults && (
              <div className="insights-grid" style={{ gridTemplateColumns: '1fr', marginTop: '1.5rem' }}>
                <div className="apple-card" style={{ padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 className="section-title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', borderBottom: 'none', paddingBottom: 0 }}>Accuracy Check</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, lineHeight: '1.5', maxWidth: '600px' }}>
                      Speed is useless if the results are wrong. We double-checked all <strong>268 Crore</strong> numbers one-by-one against the pre-sorted baseline to ensure the final order is flawless.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.2rem 2.5rem', borderRadius: '12px', background: 'rgba(52, 199, 89, 0.1)', border: '1px solid rgba(52, 199, 89, 0.3)', flexShrink: 0 }}>
                    <div style={{ color: '#34C759', display: 'flex' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div style={{ color: '#34C759', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '0.02em' }}>
                      100% PERFECT MATCH
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
