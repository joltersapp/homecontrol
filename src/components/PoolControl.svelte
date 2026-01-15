<script>
  import { haStore } from '../stores/haStore';
  import { api } from '../lib/api';
  import { onMount, onDestroy } from 'svelte';
  import PoolSetupMessage from './pool/PoolSetupMessage.svelte';
  import PoolScheduleCard from './pool/PoolScheduleCard.svelte';
  import SprinklerAICard from './pool/SprinklerAICard.svelte';
  import PoolDeviceControls from './pool/PoolDeviceControls.svelte';

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

  async function handleRunSingleZone() {
    const duration = aiDecisionData.duration || 15;
    const durationMs = duration * 60 * 1000;

    await startJobTracking('Sprinkler');
    await haStore.callService('switch', 'turn_on', 'switch.sprinkler');
    setTimeout(async () => {
      await haStore.callService('switch', 'turn_off', 'switch.sprinkler');
      await endJobTracking('Sprinkler');
    }, durationMs);
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
  {#if !scriptsConfigured}
    <PoolSetupMessage />
  {:else}
    <PoolScheduleCard
      {pumpScheduleEnabled}
      {pumpSchedule}
      {isRunning}
      {rainExtensionApplied}
      {pumpJobHistory}
      {formatTime}
      {getNextAction}
      on:toggleSchedule={togglePumpSchedule}
      on:recalculateSchedule={recalculateSchedule}
    />

    <SprinklerAICard
      {aiDecisionData}
      {sprinklerAIDecisions}
      on:runSprinklerCycle={runSprinklerCycle}
      on:runSingleZone={handleRunSingleZone}
    />

    <PoolDeviceControls
      {sprinklerState}
      {poolPumpState}
      {poolLightState}
      on:toggleSprinkler={toggleSprinkler}
      on:togglePoolPump={togglePoolPump}
      on:togglePoolLight={togglePoolLight}
    />
  {/if}
</div>

<style>
  .pool-control {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .pool-control {
      padding: 1rem;
    }
  }
</style>
