<script>
  import { createEventDispatcher } from 'svelte';
  import JobHistory from '../JobHistory.svelte';

  const dispatch = createEventDispatcher();

  export let aiDecisionData;
  export let sprinklerAIDecisions;

  $: duration = aiDecisionData.duration;
  $: aiDecisionText = aiDecisionData.reasoning;

  function handleRunAllZones() {
    dispatch('runSprinklerCycle');
  }

  function handleRunSingleZone() {
    dispatch('runSingleZone');
  }
</script>

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
    <button class="control-btn primary" on:click={handleRunAllZones}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
      Run All Zones (4 cycles)
    </button>
    <button class="control-btn secondary" on:click={handleRunSingleZone}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/></svg>
      Single Zone
    </button>
  </div>
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
