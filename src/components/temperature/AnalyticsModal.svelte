<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let analytics = {
    feedbackSummary: { tooHot: 0, tooCold: 0, total: 0 },
    recentFeedback: [],
    recentAdjustments: []
  };

  function handleClose() {
    dispatch('close');
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2 class="text-2xl font-light">System Insights</h2>
      <button class="modal-close" on:click={handleClose}>×</button>
    </div>

    <div class="modal-body">
      <!-- Feedback Summary -->
      <div class="analytics-section">
        <h3 class="section-title">User Feedback Summary (Last 7 Days)</h3>
        <div class="grid grid-cols-3 gap-4">
          <div class="stat-card">
            <div class="stat-value">{analytics.feedbackSummary.tooHot}</div>
            <div class="stat-label">Too Hot</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{analytics.feedbackSummary.tooCold}</div>
            <div class="stat-label">Too Cold</div>
          </div>
          <div class="stat-card">
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
              {feedback.feedback_type === 'too_hot' ? 'Too Hot' : 'Too Cold'}
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

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: rgba(20, 20, 20, 0.98);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 20px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 212, 255, 0.2);
  }

  .modal-header {
    padding: 2rem;
    border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 2rem;
    cursor: pointer;
    transition: color 300ms ease;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #00d4ff;
  }

  .modal-body {
    padding: 2rem;
  }

  .analytics-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.125rem;
    color: #00d4ff;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-card {
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 200;
    color: #00d4ff;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
  }

  .feedback-list, .adjustments-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feedback-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .feedback-type {
    font-weight: 500;
  }

  .feedback-type.too_hot {
    color: #ff6b6b;
  }

  .feedback-type.too_cold {
    color: #4fc3f7;
  }

  .feedback-temp {
    color: rgba(255, 255, 255, 0.7);
  }

  .feedback-time {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.875rem;
  }

  .adjustment-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
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
    color: #ff6b6b;
  }

  .adj-action.decrease {
    color: #4fc3f7;
  }

  .adj-temp {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
  }

  .adj-rate {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .rate-confidence {
    color: rgba(255, 255, 255, 0.4);
  }
</style>
