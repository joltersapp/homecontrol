<script>
  import { haStore } from '../stores/haStore';
  import { onMount, onDestroy } from 'svelte';

  export let entities;

  // Local state tracking (optimistic UI)
  let sprinklerState = false;
  let poolPumpState = false;
  let poolLightState = false;

  // Pool pump scheduling
  let pumpScheduleEnabled = false;
  let pumpSchedule = {
    morningStart: '06:00',
    morningHours: 6,
    eveningStart: '21:00',
    eveningHours: 4,
    totalHours: 10,
    reason: 'Not calculated yet',
    nextAction: 'Enable auto-schedule to begin',
    morningActive: false,
    eveningActive: false
  };

  let pumpJobHistory = [];
  let sprinklerJobHistory = [];
  let scheduleTimers = [];
  let scheduleCheckInterval = null;
  let currentPumpJob = null;
  let currentSprinklerJob = null;

  function startJobTracking(device, session = null) {
    const job = {
      id: Date.now(),
      device,
      session,
      startTime: new Date(),
      endTime: null,
      duration: null,
      conditions: {}
    };

    if (device === 'Pool Pump') {
      currentPumpJob = job;
      if (session) {
        job.conditions.temperature = entities?.['sensor.nws_temperature']?.state;
        job.conditions.reason = pumpSchedule.reason;
      }
    } else if (device === 'Sprinkler') {
      currentSprinklerJob = job;
      job.conditions.aiDecision = entities?.['input_text.sprinkler_ai_decision']?.state;
      job.conditions.shouldWater = entities?.['input_boolean.sprinkler_should_water_today']?.state === 'on';
      job.conditions.duration = entities?.['input_number.sprinkler_duration']?.state;
    }

    return job;
  }

  function endJobTracking(device) {
    const job = device === 'Pool Pump' ? currentPumpJob : currentSprinklerJob;
    if (!job) return;

    job.endTime = new Date();
    job.duration = Math.round((job.endTime - job.startTime) / 1000 / 60); // minutes

    if (device === 'Pool Pump') {
      pumpJobHistory = [job, ...pumpJobHistory].slice(0, 20);
      localStorage.setItem('pool_pump_jobs', JSON.stringify(pumpJobHistory));
      currentPumpJob = null;
    } else if (device === 'Sprinkler') {
      sprinklerJobHistory = [job, ...sprinklerJobHistory].slice(0, 20);
      localStorage.setItem('sprinkler_jobs', JSON.stringify(sprinklerJobHistory));
      currentSprinklerJob = null;
    }
  }

  function formatJobTime(date) {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Load saved states from localStorage
  if (typeof localStorage !== 'undefined') {
    sprinklerState = localStorage.getItem('pool_sprinkler_state') === 'true';
    poolPumpState = localStorage.getItem('pool_pump_state') === 'true';
    poolLightState = localStorage.getItem('pool_light_state') === 'true';
    pumpScheduleEnabled = localStorage.getItem('pool_pump_schedule_enabled') === 'true';

    const savedSchedule = localStorage.getItem('pool_pump_schedule');
    if (savedSchedule) {
      pumpSchedule = JSON.parse(savedSchedule);
    }

    const savedPumpJobs = localStorage.getItem('pool_pump_jobs');
    if (savedPumpJobs) {
      pumpJobHistory = JSON.parse(savedPumpJobs);
    }

    const savedSprinklerJobs = localStorage.getItem('sprinkler_jobs');
    if (savedSprinklerJobs) {
      sprinklerJobHistory = JSON.parse(savedSprinklerJobs);
    }
  }

  function toggleSprinkler() {
    sprinklerState = !sprinklerState;
    const action = sprinklerState ? 'on' : 'off';
    const scriptName = `turn_${action}_sprinkler`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
    localStorage.setItem('pool_sprinkler_state', sprinklerState.toString());
  }

  function togglePoolPump() {
    poolPumpState = !poolPumpState;
    const action = poolPumpState ? 'on' : 'off';
    const scriptName = `turn_${action}_pool_pump`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
    localStorage.setItem('pool_pump_state', poolPumpState.toString());
  }

  function togglePoolLight() {
    poolLightState = !poolLightState;
    const action = poolLightState ? 'on' : 'off';
    const scriptName = `turn_${action}_pool_light`;
    haStore.callService('script', 'turn_on', `script.${scriptName}`);
    localStorage.setItem('pool_light_state', poolLightState.toString());
  }

  // Calculate pool pump schedule based on temperature and season
  function calculateSchedule() {
    const temp = entities?.['sensor.nws_temperature']?.state ? parseFloat(entities['sensor.nws_temperature'].state) : 80;
    const month = new Date().getMonth() + 1; // 1-12
    const isSummer = month >= 5 && month <= 10;

    let morningHours, eveningHours, reason;

    if (isSummer) {
      if (temp > 90) {
        morningHours = 7;
        eveningHours = 5;
        reason = `Summer + Very hot (${temp}°F) = 12hrs total`;
      } else if (temp >= 85) {
        morningHours = 6;
        eveningHours = 4;
        reason = `Summer + Hot (${temp}°F) = 10hrs total`;
      } else {
        morningHours = 5.5;
        eveningHours = 3.5;
        reason = `Summer + Mild (${temp}°F) = 9hrs total`;
      }
    } else {
      if (temp > 80) {
        morningHours = 5;
        eveningHours = 3;
        reason = `Winter + Warm (${temp}°F) = 8hrs total`;
      } else if (temp < 65) {
        morningHours = 3.5;
        eveningHours = 1.5;
        reason = `Winter + Cool (${temp}°F) = 5hrs total`;
      } else {
        morningHours = 5;
        eveningHours = 2;
        reason = `Winter + Normal (${temp}°F) = 7hrs total`;
      }
    }

    pumpSchedule = {
      ...pumpSchedule,
      morningHours,
      eveningHours,
      totalHours: morningHours + eveningHours,
      reason,
      morningStart: '06:00',
      eveningStart: '21:00'
    };

    localStorage.setItem('pool_pump_schedule', JSON.stringify(pumpSchedule));
    updateNextAction();
  }

  // Update next action text
  function updateNextAction() {
    if (!pumpScheduleEnabled) {
      pumpSchedule.nextAction = 'Enable auto-schedule to begin';
      return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [morningH, morningM] = pumpSchedule.morningStart.split(':').map(Number);
    const morningStartMin = morningH * 60 + morningM;
    const morningEndMin = morningStartMin + (pumpSchedule.morningHours * 60);

    const [eveningH, eveningM] = pumpSchedule.eveningStart.split(':').map(Number);
    const eveningStartMin = eveningH * 60 + eveningM;
    const eveningEndMin = eveningStartMin + (pumpSchedule.eveningHours * 60);

    if (pumpSchedule.morningActive) {
      pumpSchedule.nextAction = `Morning session ends at ${formatEndTime(morningEndMin)}`;
    } else if (pumpSchedule.eveningActive) {
      pumpSchedule.nextAction = `Evening session ends at ${formatEndTime(eveningEndMin)}`;
    } else if (currentTime < morningStartMin) {
      pumpSchedule.nextAction = `Morning session starts at ${pumpSchedule.morningStart}`;
    } else if (currentTime < eveningStartMin) {
      pumpSchedule.nextAction = `Evening session starts at ${pumpSchedule.eveningStart}`;
    } else {
      pumpSchedule.nextAction = `Next morning session at ${pumpSchedule.morningStart}`;
    }
  }

  function formatEndTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.floor(totalMinutes % 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  // Setup schedule timers
  function setupScheduleTimers() {
    // Clear existing timers
    scheduleTimers.forEach(timer => clearTimeout(timer));
    scheduleTimers = [];

    if (!pumpScheduleEnabled) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Morning session
    const [morningH, morningM] = pumpSchedule.morningStart.split(':').map(Number);
    const morningStartMin = morningH * 60 + morningM;
    const morningEndMin = morningStartMin + (pumpSchedule.morningHours * 60);

    // Evening session
    const [eveningH, eveningM] = pumpSchedule.eveningStart.split(':').map(Number);
    const eveningStartMin = eveningH * 60 + eveningM;
    const eveningEndMin = eveningStartMin + (pumpSchedule.eveningHours * 60);

    // Schedule morning start
    if (currentTime < morningStartMin) {
      const delay = (morningStartMin - currentTime) * 60 * 1000;
      scheduleTimers.push(setTimeout(() => startMorningSession(), delay));
    } else if (currentTime >= morningStartMin && currentTime < morningEndMin) {
      // Currently in morning session
      pumpSchedule.morningActive = true;
      const delay = (morningEndMin - currentTime) * 60 * 1000;
      scheduleTimers.push(setTimeout(() => stopMorningSession(), delay));
    }

    // Schedule evening start
    if (currentTime < eveningStartMin) {
      const delay = (eveningStartMin - currentTime) * 60 * 1000;
      scheduleTimers.push(setTimeout(() => startEveningSession(), delay));
    } else if (currentTime >= eveningStartMin && currentTime < eveningEndMin) {
      // Currently in evening session
      pumpSchedule.eveningActive = true;
      const delay = (eveningEndMin - currentTime) * 60 * 1000;
      scheduleTimers.push(setTimeout(() => stopEveningSession(), delay));
    }
  }

  function startMorningSession() {
    haStore.callService('script', 'turn_on', 'script.turn_on_pool_pump');
    pumpSchedule.morningActive = true;
    poolPumpState = true;
    localStorage.setItem('pool_pump_state', 'true');
    startJobTracking('Pool Pump', 'Morning');
    updateNextAction();

    // Schedule stop
    const delay = pumpSchedule.morningHours * 60 * 60 * 1000;
    scheduleTimers.push(setTimeout(() => stopMorningSession(), delay));
  }

  function stopMorningSession() {
    haStore.callService('script', 'turn_on', 'script.turn_off_pool_pump');
    pumpSchedule.morningActive = false;
    poolPumpState = false;
    localStorage.setItem('pool_pump_state', 'false');
    endJobTracking('Pool Pump');
    updateNextAction();
  }

  function startEveningSession() {
    haStore.callService('script', 'turn_on', 'script.turn_on_pool_pump');
    pumpSchedule.eveningActive = true;
    poolPumpState = true;
    localStorage.setItem('pool_pump_state', 'true');
    startJobTracking('Pool Pump', 'Evening');
    updateNextAction();

    // Schedule stop
    const delay = pumpSchedule.eveningHours * 60 * 60 * 1000;
    scheduleTimers.push(setTimeout(() => stopEveningSession(), delay));
  }

  function stopEveningSession() {
    haStore.callService('script', 'turn_on', 'script.turn_off_pool_pump');
    pumpSchedule.eveningActive = false;
    poolPumpState = false;
    localStorage.setItem('pool_pump_state', 'false');
    endJobTracking('Pool Pump');
    updateNextAction();
  }

  function togglePumpSchedule() {
    pumpScheduleEnabled = !pumpScheduleEnabled;
    localStorage.setItem('pool_pump_schedule_enabled', pumpScheduleEnabled.toString());

    if (pumpScheduleEnabled) {
      calculateSchedule();
      setupScheduleTimers();
    } else {
      scheduleTimers.forEach(timer => clearTimeout(timer));
      scheduleTimers = [];
      pumpSchedule.morningActive = false;
      pumpSchedule.eveningActive = false;
      updateNextAction();
    }
  }

  // Run daily schedule calculation at 5 AM
  onMount(() => {
    // Check every minute if it's 5 AM
    scheduleCheckInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 5 && now.getMinutes() === 0 && pumpScheduleEnabled) {
        calculateSchedule();
        setupScheduleTimers();
      }
      updateNextAction();
    }, 60000); // Check every minute

    // Initial calculation
    if (pumpScheduleEnabled) {
      calculateSchedule();
      setupScheduleTimers();
    }
  });

  onDestroy(() => {
    scheduleTimers.forEach(timer => clearTimeout(timer));
    if (scheduleCheckInterval) clearInterval(scheduleCheckInterval);
  });

  // Helper to check if scripts exist
  function scriptExists(scriptName) {
    return entities && entities[`script.${scriptName}`];
  }

  const scriptsConfigured =
    scriptExists('turn_on_sprinkler') ||
    scriptExists('turn_on_pool_pump') ||
    scriptExists('turn_on_pool_light');
</script>

<div class="pool-control">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Pool & Sprinkler
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
            <p class="ai-subtitle">Temperature-based FPL off-peak optimization</p>
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
              <div class="status-value">{pumpSchedule.nextAction}</div>
            </div>
          </div>
          <div class="workflow-explanation">
            Daily recalculation at 5:00 AM • Morning 6 AM-12 PM • Evening 9 PM-1 AM (off-peak)
          </div>
        </div>

        <div class="ai-decision-section">
          <p class="ai-reasoning">{pumpSchedule.reason}</p>
          <div class="ai-details-grid">
            <div class="detail-item">
              <span class="detail-label">Morning Session</span>
              <span class="detail-value">{pumpSchedule.morningStart} ({pumpSchedule.morningHours}hrs)</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Evening Session</span>
              <span class="detail-value">{pumpSchedule.eveningStart} ({pumpSchedule.eveningHours}hrs)</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total Runtime</span>
              <span class="detail-value">{pumpSchedule.totalHours} hours/day</span>
            </div>
          </div>

          {#if pumpJobHistory.length > 0}
            <div class="job-report">
              <h4 class="job-report-title">Job History</h4>
              <div class="job-table">
                {#each pumpJobHistory.slice(0, 5) as job}
                  <div class="job-row">
                    <div class="job-session">
                      <span class="job-label">{job.session || 'Manual'}</span>
                    </div>
                    <div class="job-time">
                      <span class="job-date">{formatJobTime(job.startTime)}</span>
                      <span class="job-duration">{formatDuration(job.duration)}</span>
                    </div>
                    {#if job.conditions.temperature}
                      <div class="job-conditions">
                        <span class="job-temp">{job.conditions.temperature}°F</span>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Sprinkler AI Recommendation Card -->
    {@const aiEnabled = entities['input_boolean.sprinkler_ai_enabled']?.state === 'on'}
    {@const shouldWater = entities['input_boolean.sprinkler_should_water_today']?.state === 'on'}
    {@const aiDecisionRaw = entities['input_text.sprinkler_ai_decision']?.state}
    {@const duration = entities['input_number.sprinkler_duration']?.state || '10'}
    {@const nextRunRaw = entities['input_datetime.sprinkler_next_run']?.state}
    {@const lastRunRaw = entities['input_datetime.sprinkler_last_run']?.state}

    <!-- Computed values for better UX -->
    {@const now = new Date()}
    {@const currentHour = now.getHours()}

    <!-- Determine next action status -->
    {@const nextAction = (() => {
      if (!aiEnabled) return { text: 'AI scheduling is disabled', time: '' };
      if (!aiDecisionRaw || aiDecisionRaw === 'unknown') {
        // Before first AI check
        if (currentHour < 6) return { text: 'Next AI check', time: 'Today at 6:00 AM' };
        return { text: 'Next AI check', time: 'Tomorrow at 6:00 AM' };
      }
      if (shouldWater) {
        if (currentHour < 6) return { text: 'AI will check weather', time: 'Today at 6:00 AM' };
        if (currentHour === 6 && now.getMinutes() < 30) return { text: 'Watering starts', time: 'Today at 6:30 AM' };
        return { text: 'Next AI check', time: 'Tomorrow at 6:00 AM' };
      }
      return { text: 'Next AI check', time: 'Tomorrow at 6:00 AM' };
    })()}

    <!-- Format AI decision text -->
    {@const aiDecision = !aiDecisionRaw || aiDecisionRaw === 'unknown'
      ? 'Waiting for daily weather analysis at 6:00 AM'
      : aiDecisionRaw}

    <!-- Format times -->
    {@const formatTime = (dateStr) => {
      if (!dateStr || dateStr === 'Not scheduled') return 'Not set';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Not set';
        return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
      } catch {
        return 'Not set';
      }
    }}

    {@const formatDate = (dateStr) => {
      if (!dateStr || dateStr === 'Never') return 'Never';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Never';
        return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
      } catch {
        return 'Never';
      }
    }}

    {@const nextRun = formatTime(nextRunRaw)}
    {@const lastRun = formatDate(lastRunRaw)}

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
        <button
          class="ai-toggle-btn"
          class:active={aiEnabled}
          on:click={() => haStore.callService('input_boolean', aiEnabled ? 'turn_off' : 'turn_on', 'input_boolean.sprinkler_ai_enabled')}
        >
          {aiEnabled ? 'AI ON' : 'AI OFF'}
        </button>
      </div>

      {#if aiEnabled}
        <!-- Status/Next Action Section -->
        <div class="status-timeline">
          <div class="status-item">
            <div class="status-content">
              <div class="status-label">What's Next</div>
              <div class="status-value">{nextAction.text}</div>
              {#if nextAction.time}
                <div class="status-time">{nextAction.time}</div>
              {/if}
            </div>
          </div>
          <div class="workflow-explanation">
            AI analyzes Miami weather daily at 6:00 AM • Auto-waters at 6:30 AM if needed
          </div>
        </div>

        <div class="ai-decision-section">
          {#if aiDecisionRaw && aiDecisionRaw !== 'unknown'}
            <div class="decision-badge" class:water={shouldWater} class:skip={!shouldWater}>
              {shouldWater ? '💧 Water Today' : '⏭️ Skip Today'}
            </div>
          {/if}
          <p class="ai-reasoning">{aiDecision}</p>
          <div class="ai-details-grid">
            <div class="detail-item">
              <span class="detail-label">Duration/Zone</span>
              <span class="detail-value">{duration} min</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Next Run</span>
              <span class="detail-value">{nextRun}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Run</span>
              <span class="detail-value">{lastRun}</span>
            </div>
          </div>
        </div>

        <!-- Sprinkler Job History -->
        {#if sprinklerJobHistory.length > 0}
          <div class="job-report">
            <h4 class="job-report-title">Sprinkler Job History</h4>
            <div class="job-table">
              {#each sprinklerJobHistory.slice(0, 5) as job}
                <div class="job-row">
                  <div class="job-time">
                    <span class="job-date">{formatJobTime(job.startTime)}</span>
                    <span class="job-duration">{formatDuration(job.duration)} per zone</span>
                  </div>
                  {#if job.conditions.aiDecision}
                    <div class="job-ai-reason">
                      <span class="job-reason-text">{job.conditions.aiDecision}</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Manual Control Buttons -->
        <div class="manual-controls">
          <button class="control-btn primary" on:click={() => {
            startJobTracking('Sprinkler');
            haStore.callService('script', 'turn_on', 'script.run_sprinkler_full_cycle');
            const duration = entities?.['input_number.sprinkler_duration']?.state || 10;
            setTimeout(() => endJobTracking('Sprinkler'), duration * 4 * 60 * 1000 + 6 * 60 * 1000);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Run All Zones
          </button>
          <button class="control-btn secondary" on:click={() => {
            startJobTracking('Sprinkler');
            haStore.callService('script', 'turn_on', 'script.run_sprinkler_single_zone');
            const duration = entities?.['input_number.sprinkler_duration']?.state || 10;
            setTimeout(() => endJobTracking('Sprinkler'), duration * 60 * 1000);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/></svg>
            Single Zone
          </button>
          {#if shouldWater}
            <button
              class="control-btn tertiary"
              on:click={() => haStore.callService('input_boolean', 'turn_off', 'input_boolean.sprinkler_should_water_today')}
            >
              Cancel Today's Watering
            </button>
          {/if}
        </div>
      {/if}
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

  /* Job Report */
  .job-report {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .job-report-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .job-table {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .job-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .job-session {
    display: flex;
    align-items: center;
  }

  .job-label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: #00d4ff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.625rem;
    background: rgba(0, 212, 255, 0.1);
    border-radius: 6px;
  }

  .job-time {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .job-date {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .job-duration {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .job-conditions {
    text-align: right;
  }

  .job-temp {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .job-ai-reason {
    grid-column: 2 / -1;
    margin-top: 0.5rem;
    padding-top: 0.625rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .job-reason-text {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
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
