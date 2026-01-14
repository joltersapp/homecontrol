<script>
  import { onMount, onDestroy } from 'svelte';

  let isOpen = false;
  let isMinimized = false;

  // Performance metrics
  let fps = 0;
  let memoryUsed = 0;
  let memoryLimit = 0;
  let memoryPercent = 0;
  let renderCount = 0;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsHistory = [];

  // Network tracking
  let networkRequests = 0;
  let wsMessages = 0;
  let lastNetworkActivity = '';

  // Store tracking
  let storeUpdates = 0;
  let activeSubscriptions = 0;

  // Component tracking
  let componentMounts = 0;
  let componentUpdates = 0;

  // Browser info
  let userAgent = '';
  let platform = '';
  let cores = 1;
  let connection = '';

  let intervals = [];

  onMount(() => {
    // Get browser info
    userAgent = navigator.userAgent;
    platform = navigator.platform;
    cores = navigator.hardwareConcurrency || 1;

    // Check connection
    if (navigator.connection) {
      connection = `${navigator.connection.effectiveType} (${navigator.connection.downlink}Mbps)`;
    }

    // FPS Counter
    const fpsInterval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastFrameTime;
      fps = Math.round(1000 / delta);
      fpsHistory.push(fps);
      if (fpsHistory.length > 60) fpsHistory.shift();
      lastFrameTime = now;
      frameCount++;
    }, 1000 / 60); // 60 times per second

    // Memory tracking (Chrome only)
    const memoryInterval = setInterval(() => {
      if (performance.memory) {
        memoryUsed = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
        memoryLimit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
        memoryPercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);
      }
    }, 1000);

    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      networkRequests++;
      lastNetworkActivity = `Fetch: ${args[0]?.toString().substring(0, 50)}`;
      return originalFetch.apply(this, args);
    };

    // Monitor WebSocket messages (if haStore uses WebSocket)
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new originalWebSocket(...args);
      const originalSend = ws.send;
      ws.send = function(...sendArgs) {
        wsMessages++;
        lastNetworkActivity = `WS Send: ${sendArgs[0]?.toString().substring(0, 50)}`;
        return originalSend.apply(this, sendArgs);
      };
      ws.addEventListener('message', () => {
        wsMessages++;
        lastNetworkActivity = 'WS Message received';
      });
      return ws;
    };

    intervals = [fpsInterval, memoryInterval];

    // Keyboard shortcut: Ctrl+Shift+D to toggle
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        isOpen = !isOpen;
      }
    };
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      intervals.forEach(clearInterval);
      window.removeEventListener('keydown', handleKeyPress);
    };
  });

  onDestroy(() => {
    intervals.forEach(clearInterval);
  });

  function toggleConsole() {
    isOpen = !isOpen;
  }

  function toggleMinimize() {
    isMinimized = !isMinimized;
  }

  function clearMetrics() {
    networkRequests = 0;
    wsMessages = 0;
    storeUpdates = 0;
    componentMounts = 0;
    componentUpdates = 0;
    renderCount = 0;
  }

  $: avgFps = fpsHistory.length ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
  $: minFps = fpsHistory.length ? Math.min(...fpsHistory) : 0;
  $: maxFps = fpsHistory.length ? Math.max(...fpsHistory) : 0;

  $: fpsStatus = avgFps >= 55 ? 'good' : avgFps >= 30 ? 'warning' : 'critical';
  $: memoryStatus = memoryPercent < 70 ? 'good' : memoryPercent < 85 ? 'warning' : 'critical';
</script>

<!-- Floating Debug Button -->
<button
  class="debug-toggle"
  on:click={toggleConsole}
  title="Debug Console (Ctrl+Shift+D)"
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
</button>

{#if isOpen}
<div class="debug-console" class:minimized={isMinimized}>
  <div class="debug-header">
    <h3>Performance Monitor</h3>
    <div class="debug-controls">
      <button on:click={toggleMinimize} class="debug-btn" title="Minimize">
        {isMinimized ? '▲' : '▼'}
      </button>
      <button on:click={clearMetrics} class="debug-btn" title="Clear metrics">
        🗑
      </button>
      <button on:click={toggleConsole} class="debug-btn" title="Close">
        ✕
      </button>
    </div>
  </div>

  {#if !isMinimized}
  <div class="debug-content">
    <!-- FPS Section -->
    <div class="metric-section">
      <div class="metric-header">Frame Rate</div>
      <div class="metric-grid">
        <div class="metric-item status-{fpsStatus}">
          <span class="metric-label">Current FPS</span>
          <span class="metric-value">{fps}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg FPS</span>
          <span class="metric-value">{avgFps}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Min/Max</span>
          <span class="metric-value">{minFps}/{maxFps}</span>
        </div>
      </div>
      <div class="fps-graph">
        {#each fpsHistory as fpsValue, i}
          <div
            class="fps-bar"
            style="height: {(fpsValue / 60) * 100}%; background: {fpsValue >= 55 ? '#22c55e' : fpsValue >= 30 ? '#f59e0b' : '#ef4444'}"
          ></div>
        {/each}
      </div>
    </div>

    <!-- Memory Section -->
    {#if performance.memory}
    <div class="metric-section">
      <div class="metric-header">Memory Usage</div>
      <div class="metric-grid">
        <div class="metric-item status-{memoryStatus}">
          <span class="metric-label">Used</span>
          <span class="metric-value">{memoryUsed} MB</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Limit</span>
          <span class="metric-value">{memoryLimit} MB</span>
        </div>
        <div class="metric-item status-{memoryStatus}">
          <span class="metric-label">Usage</span>
          <span class="metric-value">{memoryPercent}%</span>
        </div>
      </div>
      <div class="memory-bar">
        <div class="memory-fill status-{memoryStatus}" style="width: {memoryPercent}%"></div>
      </div>
    </div>
    {:else}
    <div class="metric-section">
      <div class="metric-note">Memory API not available (Chrome only)</div>
    </div>
    {/if}

    <!-- Network Activity -->
    <div class="metric-section">
      <div class="metric-header">Network Activity</div>
      <div class="metric-grid">
        <div class="metric-item">
          <span class="metric-label">HTTP Requests</span>
          <span class="metric-value">{networkRequests}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">WS Messages</span>
          <span class="metric-value">{wsMessages}</span>
        </div>
      </div>
      {#if lastNetworkActivity}
      <div class="metric-note">{lastNetworkActivity}</div>
      {/if}
    </div>

    <!-- Browser Info -->
    <div class="metric-section">
      <div class="metric-header">Browser Info</div>
      <div class="metric-grid">
        <div class="metric-item">
          <span class="metric-label">CPU Cores</span>
          <span class="metric-value">{cores}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Platform</span>
          <span class="metric-value">{platform}</span>
        </div>
      </div>
      {#if connection}
      <div class="metric-note">Connection: {connection}</div>
      {/if}
      <div class="metric-note small">{userAgent}</div>
    </div>

    <!-- Performance Tips -->
    <div class="metric-section">
      <div class="metric-header">Performance Status</div>
      <div class="tips">
        {#if avgFps < 30}
        <div class="tip critical">⚠️ Low FPS detected. Consider closing other tabs.</div>
        {/if}
        {#if memoryPercent > 85}
        <div class="tip critical">⚠️ High memory usage. Refresh may help.</div>
        {/if}
        {#if avgFps >= 55 && memoryPercent < 70}
        <div class="tip good">✓ Performance is optimal</div>
        {/if}
        {#if wsMessages > 100}
        <div class="tip warning">ℹ️ High WebSocket activity ({wsMessages} messages)</div>
        {/if}
      </div>
    </div>
  </div>
  {/if}
</div>
{/if}

<style>
  .debug-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9998;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(0, 212, 255, 0.5);
    color: #00d4ff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .debug-toggle:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    transform: scale(1.1);
  }

  .debug-console {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 12px;
    z-index: 9999;
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 12px;
    overflow: hidden;
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 50px rgba(0, 212, 255, 0.3);
  }

  .debug-console.minimized {
    max-height: 50px;
  }

  .debug-header {
    padding: 12px 16px;
    background: rgba(0, 212, 255, 0.1);
    border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .debug-header h3 {
    margin: 0;
    color: #00d4ff;
    font-size: 14px;
    font-weight: 600;
  }

  .debug-controls {
    display: flex;
    gap: 8px;
  }

  .debug-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .debug-btn:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
  }

  .debug-content {
    padding: 16px;
    max-height: 540px;
    overflow-y: auto;
  }

  .metric-section {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .metric-section:last-child {
    border-bottom: none;
  }

  .metric-header {
    font-weight: 600;
    color: #00d4ff;
    margin-bottom: 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }

  .metric-item {
    background: rgba(255, 255, 255, 0.05);
    padding: 8px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-item.status-good {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .metric-item.status-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .metric-item.status-critical {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .metric-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 10px;
  }

  .metric-value {
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .metric-note {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    margin-top: 4px;
  }

  .metric-note.small {
    font-size: 9px;
    word-break: break-all;
  }

  .fps-graph {
    display: flex;
    gap: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 4px;
    align-items: flex-end;
  }

  .fps-bar {
    flex: 1;
    min-width: 2px;
    border-radius: 1px;
    transition: height 0.3s ease;
  }

  .memory-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .memory-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .memory-fill.status-good {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .memory-fill.status-warning {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }

  .memory-fill.status-critical {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .tips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tip {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
  }

  .tip.good {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .tip.warning {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .tip.critical {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .debug-console {
      width: calc(100vw - 40px);
      right: 20px;
      left: 20px;
      max-height: 70vh;
    }

    .metric-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
