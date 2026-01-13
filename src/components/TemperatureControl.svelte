<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';

  export let entities;

  // Current temperature data from Home Assistant
  $: officeSensor = entities?.['sensor.walkway_temperature'];
  $: thermostat = entities?.['climate.walkway'];
  $: currentTemp = parseFloat(officeSensor?.state) || 0;
  $: hallwayTemp = parseFloat(thermostat?.attributes?.current_temperature) || 0;
  $: currentSetpoint = thermostat?.attributes?.temperature || 0;

  // Automation status
  let automationStatus = {
    enabled: false,
    targetTemp: 73,
    threshold: 1.5,
    adjustmentStep: 1,
    minSetpoint: 68,
    maxSetpoint: 78,
    lastAdjustment: null,
    officeSensor: '',
    thermostat: ''
  };

  // Temperature history for graph
  let temperatureHistory = [];
  let adjustmentHistory = [];
  let refreshInterval = null;
  let newTargetTemp = 73;

  // Feedback state
  let feedbackMessage = '';
  let feedbackTimeout = null;

  // Analytics modal state
  let showAnalytics = false;
  let analytics = {
    feedbackSummary: { tooHot: 0, tooCold: 0, total: 0 },
    recentFeedback: [],
    recentAdjustments: [],
    detailedFeedback: []
  };

  // Load status and history on mount
  onMount(async () => {
    await loadStatus();
    await loadAdjustmentHistory();

    // Refresh status every 30 seconds
    refreshInterval = setInterval(async () => {
      await loadStatus();
      await loadAdjustmentHistory();
    }, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadStatus() {
    try {
      const result = await api.getTemperatureStatus();
      automationStatus = result;
      newTargetTemp = result.targetTemp;
    } catch (error) {
      console.error('Failed to load temperature status:', error);
    }
  }

  async function loadAdjustmentHistory() {
    try {
      const result = await api.getTemperatureHistory(30);
      adjustmentHistory = result.jobs || [];

      // Build temperature history from adjustments
      temperatureHistory = adjustmentHistory
        .filter(job => job.conditions)
        .map(job => {
          try {
            const conditions = typeof job.conditions === 'string'
              ? JSON.parse(job.conditions)
              : job.conditions;
            return {
              timestamp: new Date(job.start_time),
              officeTemp: parseFloat(conditions.officeTemp),
              targetTemp: parseFloat(conditions.targetTemp),
              oldSetpoint: parseFloat(conditions.oldSetpoint),
              newSetpoint: parseFloat(conditions.newSetpoint),
              action: conditions.action
            };
          } catch (e) {
            return null;
          }
        })
        .filter(item => item !== null)
        .reverse(); // Most recent first

    } catch (error) {
      console.error('Failed to load temperature history:', error);
    }
  }

  async function toggleAutomation() {
    try {
      const result = await api.toggleTemperatureAutomation();
      automationStatus = result;
      console.log('Temperature automation toggled:', result.enabled);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  }

  async function setTarget() {
    try {
      await api.setTargetTemperature(newTargetTemp);
      await loadStatus();
      console.log('Target temperature set to:', newTargetTemp);
    } catch (error) {
      console.error('Failed to set target temperature:', error);
    }
  }

  async function submitFeedback(feedbackType) {
    try {
      await api.submitTemperatureFeedback(feedbackType);

      // Show confirmation message
      feedbackMessage = feedbackType === 'too_hot' ? 'Feedback recorded: Too Hot' : 'Feedback recorded: Too Cold';

      // Clear previous timeout if exists
      if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
      }

      // Auto-hide message after 3 seconds
      feedbackTimeout = setTimeout(() => {
        feedbackMessage = '';
      }, 3000);

      console.log('Feedback submitted:', feedbackType);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      feedbackMessage = 'Error submitting feedback';

      if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
      }

      feedbackTimeout = setTimeout(() => {
        feedbackMessage = '';
      }, 3000);
    }
  }

  async function loadAnalytics() {
    try {
      const result = await api.getTemperatureAnalytics();
      analytics = result.analytics;
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  async function toggleAnalytics() {
    showAnalytics = !showAnalytics;
    if (showAnalytics) {
      await loadAnalytics();
    }
  }

  // Format time for display
  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Generate SVG path for temperature graph
  $: graphPath = generateGraphPath(temperatureHistory);

  function generateGraphPath(history) {
    if (history.length < 2) return { office: '', target: '', setpoint: '' };

    const width = 600;
    const height = 200;
    const padding = 40;

    // Find min/max temps for scaling
    const allTemps = history.flatMap(h => [h.officeTemp, h.targetTemp, h.newSetpoint]);
    const minTemp = Math.min(...allTemps) - 2;
    const maxTemp = Math.max(...allTemps) + 2;

    const xScale = (width - 2 * padding) / (history.length - 1);
    const yScale = (height - 2 * padding) / (maxTemp - minTemp);

    // Generate paths
    const officePath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.officeTemp - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    const targetPath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.targetTemp - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    const setpointPath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.newSetpoint - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    return { office: officePath, target: targetPath, setpoint: setpointPath, minTemp, maxTemp };
  }
</script>

<div class="temperature-control">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Smart Climate Control
  </h2>

  <!-- Status Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <!-- Active Sensor Temperature -->
    <div class="status-card">
      <div class="status-label">Active Sensor</div>
      <div class="status-value">{currentTemp.toFixed(1)}°F</div>
      <div class="status-subtitle">
        Current Reading
      </div>
    </div>

    <!-- Thermostat Reading -->
    <div class="status-card">
      <div class="status-label">Thermostat</div>
      <div class="status-value">{hallwayTemp.toFixed(1)}°F</div>
      <div class="status-subtitle">
        Built-in Sensor
      </div>
    </div>

    <!-- Target Temperature -->
    <div class="status-card">
      <div class="status-label">Target Temperature</div>
      <div class="status-value">{automationStatus.targetTemp}°F</div>
      <div class="status-subtitle">
        Setpoint: {currentSetpoint}°F
      </div>
    </div>

    <!-- Automation Status -->
    <div class="status-card">
      <div class="status-label">Automation</div>
      <div class="status-value {automationStatus.enabled ? 'text-green-400' : 'text-gray-500'}">
        {automationStatus.enabled ? 'Active' : 'Inactive'}
      </div>
      <div class="status-subtitle">
        {#if automationStatus.lastAdjustment}
          Last: {formatTime(automationStatus.lastAdjustment)}
        {:else}
          No adjustments yet
        {/if}
      </div>
    </div>
  </div>

  <!-- Control Panel -->
  <div class="control-panel mb-8">
    <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">Controls</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Toggle Automation -->
      <div class="control-group">
        <label class="control-label">Automation</label>
        <button
          class="toggle-button {automationStatus.enabled ? 'active' : ''}"
          on:click={toggleAutomation}
        >
          <div class="toggle-slider"></div>
          <span class="toggle-label">
            {automationStatus.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </button>
      </div>

      <!-- Set Target Temperature -->
      <div class="control-group">
        <label class="control-label">
          Target Temperature: {newTargetTemp}°F
        </label>
        <div class="flex gap-3 items-center">
          <input
            type="range"
            min="65"
            max="80"
            step="1"
            bind:value={newTargetTemp}
            class="temp-slider"
          />
          <button
            class="action-button"
            on:click={setTarget}
            disabled={newTargetTemp === automationStatus.targetTemp}
          >
            Set
          </button>
        </div>
      </div>
    </div>

    <!-- Feedback Buttons -->
    <div class="mt-6">
      <label class="control-label mb-3">
        System Learning Feedback
      </label>
      <div class="flex gap-4 items-center">
        <button
          class="feedback-button feedback-cold"
          on:click={() => submitFeedback('too_cold')}
        >
          Too Cold
        </button>
        <button
          class="feedback-button feedback-hot"
          on:click={() => submitFeedback('too_hot')}
        >
          Too Hot
        </button>
        {#if feedbackMessage}
          <div class="feedback-message">
            {feedbackMessage}
          </div>
        {/if}
      </div>
      <p class="text-xs text-gray-500 mt-2">
        Help improve temperature predictions by providing real-time feedback
      </p>
    </div>

    <!-- Analytics Button -->
    <div class="mt-4">
      <button
        class="analytics-button"
        on:click={toggleAnalytics}
      >
        View System Insights
      </button>
    </div>
  </div>

  <!-- Temperature Graph -->
  {#if temperatureHistory.length > 1}
  <div class="graph-container mb-8">
    <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">
      Temperature History
    </h3>
    <div class="graph-wrapper">
      <svg viewBox="0 0 600 200" class="temp-graph">
        <!-- Grid lines -->
        <line x1="40" y1="40" x2="560" y2="40" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <line x1="40" y1="120" x2="560" y2="120" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <line x1="40" y1="160" x2="560" y2="160" stroke="rgba(255,255,255,0.1)" stroke-width="1" />

        <!-- Target line (dashed) -->
        {#if graphPath.target}
          <path d={graphPath.target} fill="none" stroke="#00d4ff" stroke-width="2" stroke-dasharray="5,5" opacity="0.5" />
        {/if}

        <!-- Setpoint line -->
        {#if graphPath.setpoint}
          <path d={graphPath.setpoint} fill="none" stroke="#fbbf24" stroke-width="2" />
        {/if}

        <!-- Office temp line -->
        {#if graphPath.office}
          <path d={graphPath.office} fill="none" stroke="#00ff88" stroke-width="3" />
        {/if}

        <!-- Labels -->
        <text x="10" y="45" fill="rgba(255,255,255,0.5)" font-size="10">{graphPath.maxTemp?.toFixed(0)}°</text>
        <text x="10" y="165" fill="rgba(255,255,255,0.5)" font-size="10">{graphPath.minTemp?.toFixed(0)}°</text>
      </svg>

      <!-- Legend -->
      <div class="graph-legend">
        <div class="legend-item">
          <div class="legend-color" style="background: #00ff88;"></div>
          <span>Office Temp</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #fbbf24;"></div>
          <span>Thermostat Setpoint</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #00d4ff; opacity: 0.5;"></div>
          <span>Target (73°F)</span>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Adjustment History -->
  <div class="history-container">
    <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">
      Adjustment History
    </h3>

    {#if adjustmentHistory.length > 0}
      <div class="history-list">
        {#each adjustmentHistory as adjustment}
          {@const conditions = typeof adjustment.conditions === 'string'
            ? JSON.parse(adjustment.conditions)
            : adjustment.conditions}
          <div class="history-item">
            <div class="history-time">
              <div class="history-date">{formatDate(adjustment.start_time)}</div>
              <div class="history-clock">{formatTime(adjustment.start_time)}</div>
            </div>

            <div class="history-details">
              <div class="history-action {conditions.action === 'increase' ? 'increase' : 'decrease'}">
                {conditions.action === 'increase' ? '↑' : '↓'}
                {conditions.action === 'increase' ? 'Increased' : 'Decreased'}
              </div>
              <div class="history-temps">
                Office: {conditions.officeTemp}°F →
                Setpoint: {conditions.oldSetpoint}°F → {conditions.newSetpoint}°F
              </div>
              <div class="history-delta">
                Delta: {conditions.delta}°F from target
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="no-history">
        <p class="text-gray-500">No adjustments recorded yet</p>
        <p class="text-gray-600 text-sm mt-2">
          Adjustments will appear here when the automation makes changes
        </p>
      </div>
    {/if}
  </div>

  <!-- Analytics Modal -->
  {#if showAnalytics}
  <div class="modal-overlay" on:click={toggleAnalytics}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2 class="text-2xl font-light">📊 System Insights</h2>
        <button class="modal-close" on:click={toggleAnalytics}>×</button>
      </div>

      <div class="modal-body">
        <!-- Feedback Summary -->
        <div class="analytics-section">
          <h3 class="section-title">User Feedback Summary (Last 7 Days)</h3>
          <div class="grid grid-cols-3 gap-4">
            <div class="stat-card">
              <div class="stat-icon">🔥</div>
              <div class="stat-value">{analytics.feedbackSummary.tooHot}</div>
              <div class="stat-label">Too Hot</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">❄️</div>
              <div class="stat-value">{analytics.feedbackSummary.tooCold}</div>
              <div class="stat-label">Too Cold</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-value">{analytics.feedbackSummary.total}</div>
              <div class="stat-label">Total Feedback</div>
            </div>
          </div>
        </div>

        <!-- Recent Feedback -->
        {#if analytics.recentFeedback.length > 0}
        <div class="analytics-section">
          <h3 class="section-title">Recent Feedback</h3>
          <div class="feedback-list">
            {#each analytics.recentFeedback.slice(0, 5) as feedback}
            <div class="feedback-item">
              <span class="feedback-type {feedback.feedback_type}">
                {feedback.feedback_type === 'too_hot' ? '🔥 Too Hot' : '❄️ Too Cold'}
              </span>
              <span class="feedback-temp">{feedback.office_temp}°F</span>
              <span class="feedback-time">{formatTime(feedback.created_at)}</span>
            </div>
            {/each}
          </div>
        </div>
        {/if}

        <!-- System Performance -->
        {#if analytics.recentAdjustments.length > 0}
        <div class="analytics-section">
          <h3 class="section-title">Recent Adjustments</h3>
          <div class="adjustments-list">
            {#each analytics.recentAdjustments.slice(0, 5) as adj}
            <div class="adjustment-item">
              <div class="adj-info">
                <span class="adj-action {adj.conditions.action}">
                  {adj.conditions.action === 'increase' ? '↑' : '↓'} {adj.conditions.oldSetpoint}°F → {adj.conditions.newSetpoint}°F
                </span>
                <span class="adj-temp">Office: {adj.conditions.officeTemp}°F</span>
              </div>
              {#if adj.conditions.tempChangeRate15min !== undefined}
              <div class="adj-rate">
                Rate: {adj.conditions.tempChangeRate15min.toFixed(3)}°F/min
                <span class="rate-confidence">({adj.conditions.confidence15min})</span>
              </div>
              {/if}
            </div>
            {/each}
          </div>
        </div>
        {/if}
      </div>
    </div>
  </div>
  {/if}
</div>

<style>
  .temperature-control {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .status-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
    transition: all 300ms ease;
  }

  .status-card:hover {
    border-color: rgba(0, 212, 255, 0.2);
    box-shadow: 0 10px 40px rgba(0, 212, 255, 0.1);
  }

  .status-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
  }

  .status-value {
    font-size: 2.5rem;
    font-weight: 200;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.5rem;
  }

  .status-subtitle {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .control-panel {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .control-label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .toggle-button {
    position: relative;
    width: 100%;
    height: 60px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 300ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-button.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
  }

  .toggle-label {
    font-size: 1.125rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .temp-slider {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    outline: none;
    -webkit-appearance: none;
  }

  .temp-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  }

  .temp-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  }

  .action-button {
    padding: 0.75rem 2rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 10px;
    color: #00d4ff;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 300ms ease;
  }

  .action-button:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.5);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .graph-container {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .graph-wrapper {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 1rem;
  }

  .temp-graph {
    width: 100%;
    height: auto;
  }

  .graph-legend {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .legend-color {
    width: 20px;
    height: 3px;
    border-radius: 2px;
  }

  .history-container {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    gap: 1.5rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    transition: all 200ms ease;
  }

  .history-item:hover {
    background: rgba(0, 212, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.2);
  }

  .history-time {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
    padding-right: 1.5rem;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .history-date {
    font-size: 0.75rem;
    color: rgba(0, 212, 255, 0.8);
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .history-clock {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .history-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-action {
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .history-action.increase {
    color: #ff6b6b;
  }

  .history-action.decrease {
    color: #00ff88;
  }

  .history-temps {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .history-delta {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .no-history {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
  }

  /* Feedback buttons */
  .feedback-button {
    padding: 0.75rem 2rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 10px;
    color: #00d4ff;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 300ms ease;
    flex: 1;
  }

  .feedback-button:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.5);
  }

  .feedback-cold {
    /* Uses base feedback-button styles */
  }

  .feedback-hot {
    /* Uses base feedback-button styles */
  }

  .feedback-message {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.5);
    color: #86efac;
    font-size: 0.875rem;
    font-weight: 500;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Analytics button */
  .analytics-button {
    padding: 0.75rem 2rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 10px;
    color: #00d4ff;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 300ms ease;
    width: 100%;
  }

  .analytics-button:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.5);
  }

  /* Analytics Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }

  .modal-content {
    background: linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(31, 41, 55, 0.95));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.5rem;
    max-width: 800px;
    width: 90%;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    color: white;
    transform: rotate(90deg);
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
  }

  .analytics-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .stat-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  .stat-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 300;
    color: white;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .feedback-list,
  .adjustments-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feedback-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
  }

  .feedback-type {
    font-weight: 500;
  }

  .feedback-type.too_hot {
    color: #f87171;
  }

  .feedback-type.too_cold {
    color: #60a5fa;
  }

  .feedback-temp {
    color: rgba(255, 255, 255, 0.7);
  }

  .feedback-time {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .adjustment-item {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
  }

  .adj-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .adj-action {
    font-weight: 500;
  }

  .adj-action.increase {
    color: #f87171;
  }

  .adj-action.decrease {
    color: #60a5fa;
  }

  .adj-temp {
    color: rgba(255, 255, 255, 0.6);
  }

  .adj-rate {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .rate-confidence {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }

  @media (max-width: 768px) {
    .temperature-control {
      padding: 1rem;
    }

    .history-item {
      flex-direction: column;
      gap: 1rem;
    }

    .history-time {
      flex-direction: row;
      justify-content: space-between;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-right: 0;
      padding-bottom: 1rem;
      min-width: auto;
      width: 100%;
    }
  }
</style>
