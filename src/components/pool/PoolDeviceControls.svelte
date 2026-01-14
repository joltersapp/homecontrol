<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let sprinklerState;
  export let poolPumpState;
  export let poolLightState;

  function handleToggleSprinkler() {
    dispatch('toggleSprinkler');
  }

  function handleTogglePoolPump() {
    dispatch('togglePoolPump');
  }

  function handleTogglePoolLight() {
    dispatch('togglePoolLight');
  }
</script>

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
      <button class="toggle-switch" class:active={sprinklerState} on:click={handleToggleSprinkler}>
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
      <button class="toggle-switch" class:active={poolPumpState} on:click={handleTogglePoolPump}>
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
      <button class="toggle-switch" class:active={poolLightState} on:click={handleTogglePoolLight}>
        <div class="toggle-track">
          <div class="toggle-thumb"></div>
        </div>
      </button>
    </div>
  </div>
</div>

<style>
  .glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
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
</style>
