<script>
  import { createEventDispatcher } from 'svelte';
  import JobHistory from '../JobHistory.svelte';

  const dispatch = createEventDispatcher();

  export let pumpScheduleEnabled;
  export let pumpSchedule;
  export let isRunning;
  export let rainExtensionApplied;
  export let pumpJobHistory;
  export let formatTime;
  export let getNextAction;

  function handleToggleSchedule() {
    dispatch('toggleSchedule');
  }

  function handleRecalculate() {
    dispatch('recalculateSchedule');
  }
</script>

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
      on:click={handleToggleSchedule}
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
        <button class="control-btn tertiary" on:click={handleRecalculate}>
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

<style>
  .glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

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
