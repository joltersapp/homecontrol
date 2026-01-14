<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let automationEnabled;
  export let targetTemp;
  export let feedbackMessage = '';

  let newTargetTemp = targetTemp;

  $: newTargetTemp = targetTemp; // Sync with prop changes

  function handleToggleAutomation() {
    dispatch('toggleAutomation');
  }

  function handleSetTarget() {
    dispatch('setTarget', { temp: newTargetTemp });
  }

  function handleFeedback(type) {
    dispatch('submitFeedback', { type });
  }

  function handleToggleAnalytics() {
    dispatch('toggleAnalytics');
  }
</script>

<div class="control-panel mb-8">
  <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">Controls</h3>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Toggle Automation -->
    <div class="control-group">
      <label class="control-label">Automation</label>
      <button
        class="toggle-button {automationEnabled ? 'active' : ''}"
        on:click={handleToggleAutomation}
      >
        <div class="toggle-slider"></div>
        <span class="toggle-label">
          {automationEnabled ? 'Enabled' : 'Disabled'}
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
          on:click={handleSetTarget}
          disabled={newTargetTemp === targetTemp}
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
        on:click={() => handleFeedback('too_cold')}
      >
        Too Cold
      </button>
      <button
        class="feedback-button feedback-hot"
        on:click={() => handleFeedback('too_hot')}
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
      on:click={handleToggleAnalytics}
    >
      View System Insights
    </button>
  </div>
</div>

<style>
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
</style>
