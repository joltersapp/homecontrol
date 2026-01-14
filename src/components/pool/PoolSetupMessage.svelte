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

<style>
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
</style>
