<script>
  export let currentTemp;
  export let hallwayTemp;
  export let targetTemp;
  export let currentSetpoint;
  export let automationEnabled;
  export let lastAdjustment;

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
</script>

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
    <div class="status-value">{targetTemp}°F</div>
    <div class="status-subtitle">
      Setpoint: {currentSetpoint}°F
    </div>
  </div>

  <!-- Automation Status -->
  <div class="status-card">
    <div class="status-label">Automation</div>
    <div class="status-value {automationEnabled ? 'text-green-400' : 'text-gray-500'}">
      {automationEnabled ? 'Active' : 'Inactive'}
    </div>
    <div class="status-subtitle">
      {#if lastAdjustment}
        Last: {formatTime(lastAdjustment)}
      {:else}
        No adjustments yet
      {/if}
    </div>
  </div>
</div>

<style>
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
</style>
