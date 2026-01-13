<script>
  import { haStore } from '../stores/haStore';
  import { api } from '../lib/api';
  import { onMount, onDestroy } from 'svelte';
  import JobHistory from './JobHistory.svelte';

  export let entities;

  // Derive device states from Home Assistant input_boolean entities (source of truth)
  $: sprinklerState = entities?.['input_boolean.sprinkler_state']?.state === 'on';
  $: poolPumpState = entities?.['input_boolean.pool_pump_state']?.state === 'on';
  $: poolLightState = entities?.['input_boolean.pool_light_state']?.state === 'on';

  // Pool pump scheduling (now managed by backend)
  let pumpScheduleEnabled = false;
  let pumpSchedule = {
    hours: 8,
    totalHours: 8,
    reason: 'Not calculated yet',
    startTime: '10:00',
    nextStart: null,
    nextEnd: null
  };
  let isRunning = false;
  let rainExtensionApplied = false;

  let pumpJobHistory = [];
  let sprinklerJobHistory = [];
  let sprinklerAIDecisions = [];
  let currentPumpJob = null;
  let currentSprinklerJob = null;
  let scheduleRefreshInterval = null;

  // AI decision from app (not HA)
  let aiDecisionData = {
    duration: 15,
    temperature: null,
    humidity: null,
    forecast: null,
    reasoning: 'Loading AI decision...',
    calculated: false
  };

  async function startJobTracking(device, session = null) {
    const conditions = {};

    if (device === 'Pool Pump' && session) {
      conditions.temperature = entities?.['sensor.nws_temperature']?.state;
      conditions.reason = pumpSchedule.reason;
    } else if (device === 'Sprinkler') {
      // Zone job - records actual zone runs
      conditions.aiDecision = aiDecisionData.reasoning;
      conditions.duration = aiDecisionData.duration;
      conditions.temperature = aiDecisionData.temperature;
      conditions.humidity = aiDecisionData.humidity;
      conditions.forecast = aiDecisionData.forecast;
      if (session) {
        conditions.zone = session.replace('Zone ', ''); // Extract zone number
      }
    }

    try {
      const result = await api.createJob(device, session, conditions);

      if (device === 'Pool Pump') {
        currentPumpJob = result.jobId;
      } else if (device === 'Sprinkler') {
        currentSprinklerJob = result.jobId;
      }

      return result.jobId;
    } catch (error) {
      console.error('Failed to start job tracking:', error);
      return null;
    }
  }

  async function endJobTracking(device) {
    const jobId = device === 'Pool Pump' ? currentPumpJob : currentSprinklerJob;
    if (!jobId) return;

    try {
      await api.endJob(jobId);
      await loadJobHistory(device);

      if (device === 'Pool Pump') {
        currentPumpJob = null;
      } else if (device === 'Sprinkler') {
        currentSprinklerJob = null;
      }
    } catch (error) {
      console.error('Failed to end job tracking:', error);
    }
  }

  async function runSprinklerCycle() {
    const duration = aiDecisionData.duration || 15;
    const durationMs = duration * 60 * 1000; // Convert minutes to milliseconds
    const breakPeriodMs = 3 * 60 * 1000; // 3 minutes break between zones
    const numZones = 4;

    console.log(`Starting sprinkler cycle: ${numZones} zones, ${duration} min each, 3 min break`);

    // Start job tracking for the full cycle
    await startJobTracking('Sprinkler');

    try {
      for (let zone = 1; zone <= numZones; zone++) {
        console.log(`Zone ${zone}: Turning pump ON for ${duration} minutes`);

        // Turn pump ON
        await haStore.callService('switch', 'turn_on', 'switch.sprinkler');

        // Wait for zone duration
        await new Promise(resolve => setTimeout(resolve, durationMs));

        console.log(`Zone ${zone}: Turning pump OFF`);

        // Turn pump OFF
        await haStore.callService('switch', 'turn_off', 'switch.sprinkler');

        // Wait for break period (except after last zone)
        if (zone < numZones) {
          console.log(`Break period: Waiting 3 minutes for check valve to rotate to Zone ${zone + 1}`);
          await new Promise(resolve => setTimeout(resolve, breakPeriodMs));
        }
      }

      console.log('Sprinkler cycle complete');
    } catch (error) {
      console.error('Sprinkler cycle error:', error);
    } finally {
      // End job tracking
      await endJobTracking('Sprinkler');
    }
  }

  async function loadJobHistory(device) {
    try {
      if (device === 'Pool Pump') {
        const result = await api.getJobs(device, 20);
        pumpJobHistory = result.jobs;
      } else if (device === 'Sprinkler') {
        // Fetch AI decisions (includes both water and skip decisions)
        const decisionsResult = await api.getSprinklerHistory(30);
        sprinklerAIDecisions = decisionsResult.data || [];
      }
    } catch (error) {
      console.error('Failed to load job history:', error);
    }
  }

  async function loadAIDecision() {
    try {
      const result = await api.getSprinklerDuration();
      if (result.success && result.data) {
        aiDecisionData = {
          duration: result.data.duration,
          temperature: result.data.temperature,
          humidity: result.data.humidity,
          forecast: result.data.forecast,
          reasoning: result.data.reasoning,
          calculated: result.data.calculated
        };
        console.log('AI Decision loaded:', aiDecisionData);
      }
    } catch (error) {
      console.error('Failed to load AI decision:', error);
    }
  }

  function toggleSprinkler() {
    // State is derived from HA entity, so we toggle based on current HA state
    const action = sprinklerState ? 'off' : 'on';
    const scriptName = `turn_${action}_sprinkler`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
  }

  function togglePoolPump() {
    // State is derived from HA entity, so we toggle based on current HA state
    const action = poolPumpState ? 'off' : 'on';
    const scriptName = `turn_${action}_pool_pump`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
  }

  function togglePoolLight() {
    // State is derived from HA entity, so we toggle based on current HA state
    const action = poolLightState ? 'off' : 'on';
    const scriptName = `turn_${action}_pool_light`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
  }

  // Fetch pool schedule from backend
  async function fetchPoolSchedule() {
    try {
      const response = await fetch('/api/pool/schedule');
      const data = await response.json();

      if (data.success) {
        pumpScheduleEnabled = data.enabled;
        pumpSchedule = data.schedule;
        isRunning = data.isRunning;
        rainExtensionApplied = data.rainExtensionApplied;
      }
    } catch (error) {
      console.error('Failed to fetch pool schedule:', error);
    }
  }

  // Toggle pool scheduler (enable/disable backend scheduler)
  async function togglePumpSchedule() {
    try {
      const response = await fetch('/api/pool/schedule/toggle', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        pumpScheduleEnabled = data.enabled;
        pumpSchedule = data.schedule;
        isRunning = data.isRunning;
        rainExtensionApplied = data.rainExtensionApplied;
      }
    } catch (error) {
      console.error('Failed to toggle pool schedule:', error);
    }
  }

  // Force recalculate schedule
  async function recalculateSchedule() {
    try {
      const response = await fetch('/api/pool/schedule/recalculate', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        pumpSchedule = data.schedule;
        await fetchPoolSchedule(); // Refresh full schedule
      }
    } catch (error) {
      console.error('Failed to recalculate schedule:', error);
    }
  }

  // Format time for display
  function formatTime(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  // Get next action text
  function getNextAction() {
    if (!pumpScheduleEnabled) {
      return 'Enable auto-schedule to begin';
    }

    if (isRunning) {
      const endTime = pumpSchedule.nextEnd ? formatTime(pumpSchedule.nextEnd) : 'calculating...';
      return `Pump running until ${endTime}${rainExtensionApplied ? ' (rain extension applied)' : ''}`;
    }

    const nextStart = pumpSchedule.nextStart ? formatTime(pumpSchedule.nextStart) : 'calculating...';
    return `Next session starts at ${nextStart}`;
  }

  onMount(async () => {
    // Load pool schedule from backend
    await fetchPoolSchedule();

    // Load AI decision from app
    await loadAIDecision();

    // Load job histories
    await loadJobHistory('Pool Pump');
    await loadJobHistory('Sprinkler');

    // Refresh pool schedule every 30 seconds to keep UI in sync
    scheduleRefreshInterval = setInterval(async () => {
      await fetchPoolSchedule();
    }, 30000);
  });

  onDestroy(() => {
    if (scheduleRefreshInterval) clearInterval(scheduleRefreshInterval);
  });

  // Helper to check if scripts exist
  function scriptExists(scriptName) {
    return entities && entities[`script.${scriptName}`];
  }

  // Make scriptsConfigured reactive so it updates when entities load
  $: scriptsConfigured =
    scriptExists('turn_on_sprinkler') ||
    scriptExists('turn_on_pool_pump') ||
    scriptExists('turn_on_pool_light');
</script>

<div class="pool-control">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Outside
  </h2>

  {#if !scriptsConfigured}
    <div class="setup-message glass">
      <div class="text-center">
        <div class="text-yellow-400 text-4xl mb-4">⚠️</div>
        <h3 class="text-lg font-light text-gray-300 mb-2">Setup Required</h3>
        <p class="text-sm text-gray-400 mb-4">
          Pool and sprinkler scripts need to be configured in Home Assistant.
        </p>
        <p class="text-xs text-gray-500 font-mono">
          See: ha_scripts_config.yaml in project folder
        </p>
      </div>
    </div>
  {:else}
    <!-- Pool Pump Auto-Schedule Card -->
    <div class="ai-recommendation-card glass mb-8">
      <div class="ai-header">
        <div class="ai-title-section">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-icon">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/></svg>
          <div>
            <h3 class="ai-title">Pool Pump Schedule</h3>
            <p class="ai-subtitle">Miami-optimized peak sun operation with rain detection</p>
          </div>
        </div>
        <button
          class="ai-toggle-btn"
          class:active={pumpScheduleEnabled}
          on:click={togglePumpSchedule}
        >
          {pumpScheduleEnabled ? 'AUTO ON' : 'AUTO OFF'}
        </button>
      </div>

      {#if pumpScheduleEnabled}
        <div class="status-timeline">
          <div class="status-item">
            <div class="status-content">
              <div class="status-label">What's Next</div>
              <div class="status-value">{getNextAction()}</div>
            </div>
          </div>
          <div class="workflow-explanation">
            Daily recalculation at 5:00 AM • Peak sun session at 10:00 AM • Auto rain detection
          </div>
        </div>

        <div class="ai-decision-section">
          <p class="ai-reasoning">{pumpSchedule.reason || 'Calculating Miami-optimized schedule...'}</p>
          <div class="ai-details-grid">
            <div class="detail-item">
              <span class="detail-label">Session Start</span>
              <span class="detail-value">{pumpSchedule.startTime} (peak sun)</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Duration</span>
              <span class="detail-value">{pumpSchedule.hours} hours{rainExtensionApplied ? ' + rain ext' : ''}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total Runtime</span>
              <span class="detail-value">{pumpSchedule.totalHours} hours/day</span>
            </div>
          </div>

          <div class="manual-controls">
            <button class="control-btn tertiary" on:click={recalculateSchedule}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              Recalculate Now
            </button>
          </div>

          <JobHistory
            jobs={pumpJobHistory}
            title="Pool Pump Job History"
            jobType="pool"
          />
        </div>
      {/if}
    </div>

    <!-- Sprinkler AI Recommendation Card -->
    {@const duration = aiDecisionData.duration}
    {@const aiDecisionText = aiDecisionData.reasoning}


    <div class="ai-recommendation-card glass mb-8">
      <div class="ai-header">
        <div class="ai-title-section">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-icon">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          </svg>
          <div>
            <h3 class="ai-title">Smart Sprinkler Schedule</h3>
            <p class="ai-subtitle">AI-powered irrigation for Miami</p>
          </div>
        </div>
      </div>

      <!-- Status/Next Action Section -->
      <div class="status-timeline">
        <div class="status-item">
          <div class="status-content">
            <div class="status-label">What's Next</div>
            <div class="status-value">Next AI check</div>
            <div class="status-time">Tomorrow at 6:00 AM</div>
          </div>
        </div>
        <div class="workflow-explanation">
          AI analyzes Miami weather daily at 6:00 AM
        </div>
      </div>

      <div class="ai-decision-section">
        <p class="ai-reasoning">{aiDecisionText}</p>
        <div class="ai-details-grid">
          <div class="detail-item">
            <span class="detail-label">Duration/Zone</span>
            <span class="detail-value">{duration} min</span>
          </div>
          {#if aiDecisionData.temperature}
            <div class="detail-item">
              <span class="detail-label">Temperature</span>
              <span class="detail-value">{aiDecisionData.temperature}°F</span>
            </div>
          {/if}
          {#if aiDecisionData.humidity}
            <div class="detail-item">
              <span class="detail-label">Humidity</span>
              <span class="detail-value">{aiDecisionData.humidity}%</span>
            </div>
          {/if}
          {#if aiDecisionData.forecast}
            <div class="detail-item">
              <span class="detail-label">Forecast</span>
              <span class="detail-value">{aiDecisionData.forecast}</span>
            </div>
          {/if}
        </div>
      </div>

        <!-- Sprinkler AI Decision History -->
        <JobHistory
          jobs={sprinklerAIDecisions}
          title="Sprinkler Job History"
          jobType="sprinkler-ai"
        />

        <!-- Manual Control Buttons -->
        <div class="manual-controls">
          <button class="control-btn primary" on:click={() => runSprinklerCycle()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Run All Zones (4 cycles)
          </button>
          <button class="control-btn secondary" on:click={async () => {
            const duration = aiDecisionData.duration || 15;
            const durationMs = duration * 60 * 1000;

            await startJobTracking('Sprinkler');
            await haStore.callService('switch', 'turn_on', 'switch.sprinkler');
            setTimeout(async () => {
              await haStore.callService('switch', 'turn_off', 'switch.sprinkler');
              await endJobTracking('Sprinkler');
            }, durationMs);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/></svg>
            Single Zone
          </button>
        </div>
    </div>

    <div class="controls-grid">
      <!-- Sprinkler Control -->
      <div class="control-card glass" class:active={sprinklerState}>
        <div class="card-content">
          <div class="control-header">
            <div class="icon-wrapper" class:active={sprinklerState}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v4"/>
                <path d="M12 18v4"/>
                <path d="m4.93 4.93 2.83 2.83"/>
                <path d="m16.24 16.24 2.83 2.83"/>
                <path d="M2 12h4"/>
                <path d="M18 12h4"/>
                <path d="m4.93 19.07 2.83-2.83"/>
                <path d="m16.24 7.76 2.83-2.83"/>
              </svg>
            </div>
            <div class="control-info">
              <h3 class="control-name">Sprinkler</h3>
              <p class="control-status">{sprinklerState ? 'Running' : 'Off'}</p>
            </div>
          </div>
          <button class="toggle-switch" class:active={sprinklerState} on:click={toggleSprinkler}>
            <div class="toggle-track">
              <div class="toggle-thumb"></div>
            </div>
          </button>
        </div>
      </div>

      <!-- Pool Pump Control -->
      <div class="control-card glass" class:active={poolPumpState}>
        <div class="card-content">
          <div class="control-header">
            <div class="icon-wrapper" class:active={poolPumpState}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4"/>
                <path d="M12 18v4"/>
                <path d="m4.93 4.93 2.83 2.83"/>
                <path d="m16.24 16.24 2.83 2.83"/>
                <path d="M2 12h4"/>
                <path d="M18 12h4"/>
                <path d="m4.93 19.07 2.83-2.83"/>
                <path d="m16.24 7.76 2.83-2.83"/>
              </svg>
            </div>
            <div class="control-info">
              <h3 class="control-name">Pool Pump</h3>
              <p class="control-status">{poolPumpState ? 'Running' : 'Off'}</p>
            </div>
          </div>
          <button class="toggle-switch" class:active={poolPumpState} on:click={togglePoolPump}>
            <div class="toggle-track">
              <div class="toggle-thumb"></div>
            </div>
          </button>
        </div>
      </div>

      <!-- Pool Light Control -->
      <div class="control-card glass" class:active={poolLightState}>
        <div class="card-content">
          <div class="control-header">
            <div class="icon-wrapper" class:active={poolLightState}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                <path d="M9 18h6"/>
                <path d="M10 22h4"/>
              </svg>
            </div>
            <div class="control-info">
              <h3 class="control-name">Pool Light</h3>
              <p class="control-status">{poolLightState ? 'On' : 'Off'}</p>
            </div>
          </div>
          <button class="toggle-switch" class:active={poolLightState} on:click={togglePoolLight}>
            <div class="toggle-track">
              <div class="toggle-thumb"></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .pool-control {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .setup-message {
    padding: 3rem 2rem;
    border-radius: 20px;
    margin: 2rem auto;
    max-width: 600px;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .control-card {
    border-radius: 20px;
    transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .control-card:hover {
    border-color: rgba(0, 212, 255, 0.15);
    box-shadow: 0 10px 40px rgba(0, 212, 255, 0.08);
    transform: translateY(-2px);
  }

  .control-card.active {
    background: rgba(0, 212, 255, 0.04);
    border-color: rgba(0, 212, 255, 0.2);
  }

  .card-content {
    padding: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .control-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    transition: all 300ms ease;
  }

  .icon-wrapper.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
  }

  .control-info {
    flex: 1;
  }

  .control-name {
    font-size: 1rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.025em;
    margin-bottom: 0.25rem;
  }

  .control-status {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 300;
  }

  .control-card.active .control-status {
    color: #00d4ff;
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    width: 56px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .toggle-track {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-switch:hover .toggle-track {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .toggle-switch.active .toggle-track {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.5);
  }

  .toggle-thumb {
    position: absolute;
    top: 50%;
    left: 3px;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch.active .toggle-thumb {
    left: calc(100% - 27px);
    background: #00d4ff;
    box-shadow:
      0 0 12px rgba(0, 212, 255, 0.6),
      0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch:active .toggle-thumb {
    width: 28px;
  }

  @media (max-width: 768px) {
    .controls-grid {
      grid-template-columns: 1fr;
    }

    .card-content {
      padding: 1.5rem;
    }
  }

  /* AI Recommendation Card */
  .ai-recommendation-card {
    border-radius: 20px;
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .ai-title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .ai-icon {
    color: rgba(0, 212, 255, 0.8);
  }

  .ai-title {
    font-size: 1.125rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.025em;
    margin-bottom: 0.25rem;
  }

  .ai-subtitle {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ai-toggle-btn {
    padding: 0.5rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 300ms ease;
    text-transform: uppercase;
  }

  .ai-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .ai-toggle-btn.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.4);
    color: #00d4ff;
  }

  /* Status Timeline Section */
  .status-timeline {
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: rgba(0, 212, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(0, 212, 255, 0.15);
  }

  .status-item {
    margin-bottom: 1rem;
  }

  .status-content {
    flex: 1;
  }

  .status-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 0.25rem;
  }

  .status-value {
    font-size: 1.125rem;
    font-weight: 500;
    color: #00d4ff;
    margin-bottom: 0.125rem;
  }

  .status-time {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .workflow-explanation {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    line-height: 1.5;
  }

  .ai-decision-section {
    margin-top: 1.5rem;
  }

  .decision-badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .decision-badge.water {
    background: rgba(0, 212, 255, 0.15);
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  .decision-badge.skip {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .ai-reasoning {
    font-size: 0.9375rem;
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .ai-details-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 1.5rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 500;
    color: #00d4ff;
  }

  .manual-controls {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .control-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.875rem 1.5rem;
    border-radius: 12px;
    font-size: 0.8125rem;
    font-weight: 400;
    letter-spacing: 0.025em;
    cursor: pointer;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .control-btn.primary {
    background: rgba(0, 212, 255, 0.15);
    border: 1.5px solid rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  .control-btn.primary:hover {
    background: rgba(0, 212, 255, 0.25);
    border-color: rgba(0, 212, 255, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0, 212, 255, 0.2);
  }

  .control-btn.secondary {
    background: rgba(255, 255, 255, 0.03);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
  }

  .control-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(0, 212, 255, 0.2);
    color: #00d4ff;
  }

  .control-btn.tertiary {
    background: rgba(255, 255, 255, 0.02);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  .control-btn.tertiary:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 768px) {
    .ai-details-grid {
      grid-template-columns: 1fr;
    }

    .manual-controls {
      flex-direction: column;
    }

    .control-btn {
      min-width: auto;
    }
  }
</style>
