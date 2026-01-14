<script>
  import { createEventDispatcher } from 'svelte';
  import AudioSliderControl from './AudioSliderControl.svelte';

  const dispatch = createEventDispatcher();

  export let playerEntity;

  $: state = playerEntity?.state || 'unknown';
  $: mediaTitle = playerEntity?.attributes?.media_title;
  $: volumeLevel = playerEntity?.attributes?.volume_level
    ? Math.round(playerEntity.attributes.volume_level * 100)
    : 0;

  function handleTogglePlayer() {
    dispatch('togglePlayer');
  }

  function handleVolumeChange(event) {
    dispatch('volumeChange', event.detail);
  }
</script>

<div class="control-row">
  <div class="flex items-center justify-between mb-3">
    <span class="text-sm text-gray-400">Player Status</span>
    <button
      class="status-button {state === 'playing' ? 'active' : ''}"
      on:click={handleTogglePlayer}
    >
      {state === 'playing' ? 'PLAYING' : state.toUpperCase()}
    </button>
  </div>

  {#if mediaTitle}
    <p class="text-xs text-gray-500 mb-3">
      {mediaTitle}
    </p>
  {/if}

  <AudioSliderControl
    label="Volume"
    value={volumeLevel}
    min={0}
    max={100}
    unit="%"
    on:change={handleVolumeChange}
  />
</div>

<style>
  .control-row {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .status-button {
    padding: 0.375rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    transition: all 300ms ease;
    cursor: pointer;
  }

  .status-button:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .status-button.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }
</style>
