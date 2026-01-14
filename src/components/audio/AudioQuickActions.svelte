<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function handleEnableAllNightSound() {
    dispatch('enableAllNightSound');
  }

  function handleDisableAllNightSound() {
    dispatch('disableAllNightSound');
  }

  function handleResetAllEQ() {
    dispatch('resetAllEQ');
  }
</script>

<div class="group-actions">
  <h3 class="text-sm text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
  <div class="flex flex-wrap gap-3 justify-center">
    <button class="action-button" on:click={handleEnableAllNightSound}>
      Enable All Night Sound
    </button>
    <button class="action-button" on:click={handleDisableAllNightSound}>
      Disable All Night Sound
    </button>
    <button class="action-button" on:click={handleResetAllEQ}>
      Reset All EQ
    </button>
  </div>
</div>

<style>
  .group-actions {
    margin-top: 3rem;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    text-align: center;
  }

  .action-button {
    padding: 0.75rem 1.5rem;
    background: rgba(0, 212, 255, 0.05);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 12px;
    color: rgba(0, 212, 255, 0.9);
    font-size: 0.8125rem;
    font-weight: 300;
    letter-spacing: 0.025em;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    text-transform: uppercase;
  }

  .action-button:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px -5px rgba(0, 212, 255, 0.3);
  }

  .action-button:active {
    transform: scale(0.98);
  }
</style>
