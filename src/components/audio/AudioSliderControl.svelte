<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let label;
  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let unit = '';

  function handleDecrement() {
    const newValue = Math.max(min, parseFloat(value) - 1);
    dispatch('change', newValue);
  }

  function handleIncrement() {
    const newValue = Math.min(max, parseFloat(value) + 1);
    dispatch('change', newValue);
  }

  function handleSliderInput(e) {
    dispatch('change', parseFloat(e.target.value));
  }
</script>

<div class="control-item">
  <label class="control-label">{label}</label>
  <div class="flex items-center gap-2">
    <button class="control-btn" on:click={handleDecrement}>
      −
    </button>
    <input
      type="range"
      {min}
      {max}
      {value}
      on:input={handleSliderInput}
      class="audio-slider flex-1"
    />
    <button class="control-btn" on:click={handleIncrement}>
      +
    </button>
    <span class="value-display">{value}{unit}</span>
  </div>
</div>

<style>
  .control-item {
    margin-bottom: 1.25rem;
  }

  .control-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 0.5rem;
  }

  .audio-slider {
    height: 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .audio-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    transition: all 200ms ease;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
  }

  .audio-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 0 10px rgba(0, 212, 255, 0.15);
    transform: scale(1.2);
  }

  .audio-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: all 200ms ease;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
  }

  .audio-slider::-moz-range-thumb:hover {
    box-shadow: 0 0 0 10px rgba(0, 212, 255, 0.15);
    transform: scale(1.2);
  }

  .value-display {
    min-width: 3rem;
    text-align: right;
    font-size: 0.875rem;
    color: rgba(0, 212, 255, 0.8);
    font-weight: 300;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 10px;
    color: rgba(0, 212, 255, 0.9);
    font-size: 1.5rem;
    font-weight: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 200ms ease;
    user-select: none;
  }

  .control-btn:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.4);
    transform: scale(1.05);
  }

  .control-btn:active {
    background: rgba(0, 212, 255, 0.2);
    transform: scale(0.95);
  }
</style>
