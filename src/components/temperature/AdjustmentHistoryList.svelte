<script>
  export let adjustmentHistory = [];

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="history-container">
  <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">
    Adjustment History
  </h3>

  {#if adjustmentHistory.length > 0}
    <div class="history-list">
      {#each adjustmentHistory as adjustment}
        {@const conditions = typeof adjustment.conditions === 'string'
          ? JSON.parse(adjustment.conditions)
          : adjustment.conditions}
        <div class="history-item">
          <div class="history-time">
            <div class="history-date">{formatDate(adjustment.start_time)}</div>
            <div class="history-clock">{formatTime(adjustment.start_time)}</div>
          </div>

          <div class="history-details">
            {#if conditions.action === 'ac_on'}
              <div class="history-action hvac-event ac-on">
                AC Turned ON
              </div>
              <div class="history-temps">
                Office: {conditions.officeTemp}°F | Setpoint: {conditions.setpoint}°F
              </div>
            {:else if conditions.action === 'heat_on'}
              <div class="history-action hvac-event heat-on">
                Heat Turned ON
              </div>
              <div class="history-temps">
                Office: {conditions.officeTemp}°F | Setpoint: {conditions.setpoint}°F
              </div>
            {:else if conditions.action === 'hvac_idle' || conditions.action === 'hvac_off'}
              <div class="history-action hvac-event hvac-off">
                HVAC Turned OFF
              </div>
              <div class="history-temps">
                Office: {conditions.officeTemp}°F | Setpoint: {conditions.setpoint}°F
              </div>
            {:else}
              <div class="history-action {conditions.action === 'increase' ? 'increase' : 'decrease'}">
                {conditions.action === 'increase' ? '↑' : '↓'}
                {conditions.action === 'increase' ? 'Increased' : 'Decreased'}
              </div>
              <div class="history-temps">
                Office: {conditions.officeTemp}°F →
                {#if conditions.oldSetpoint !== undefined && conditions.newSetpoint !== undefined}
                  Setpoint: {conditions.oldSetpoint}°F → {conditions.newSetpoint}°F
                {:else if conditions.setpoint !== undefined}
                  Setpoint: {conditions.setpoint}°F
                {:else}
                  Setpoint: N/A
                {/if}
              </div>
              {#if conditions.delta !== undefined}
              <div class="history-delta">
                Delta: {conditions.delta}°F from target
              </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-history">
      <p class="text-gray-500">No adjustments recorded yet</p>
      <p class="text-gray-600 text-sm mt-2">
        Adjustments will appear here when the automation makes changes
      </p>
    </div>
  {/if}
</div>

<style>
  .history-container {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .history-item {
    display: flex;
    gap: 1.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 300ms ease;
  }

  .history-item:hover {
    border-color: rgba(0, 212, 255, 0.2);
  }

  .history-time {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 80px;
  }

  .history-date {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
  }

  .history-clock {
    font-size: 1rem;
    color: rgba(0, 212, 255, 0.8);
    font-weight: 500;
  }

  .history-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-action {
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .history-action.increase {
    color: #ff6b6b;
  }

  .history-action.decrease {
    color: #4fc3f7;
  }

  .history-action.hvac-event {
    font-weight: 600;
  }

  .history-action.ac-on {
    color: #4fc3f7;
  }

  .history-action.heat-on {
    color: #ff6b6b;
  }

  .history-action.hvac-off {
    color: #9e9e9e;
  }

  .history-temps {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .history-delta {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .no-history {
    text-align: center;
    padding: 3rem 1rem;
  }

  @media (max-width: 640px) {
    .history-item {
      flex-direction: column;
      gap: 1rem;
    }

    .history-time {
      flex-direction: row;
      justify-content: space-between;
      width: 100%;
    }
  }
</style>
