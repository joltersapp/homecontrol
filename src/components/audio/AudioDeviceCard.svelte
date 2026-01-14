<script>
  import { createEventDispatcher } from 'svelte';
  import AudioPlayerStatus from './AudioPlayerStatus.svelte';
  import AudioSliderControl from './AudioSliderControl.svelte';

  const dispatch = createEventDispatcher();

  export let device;
  export let entities;

  $: playerEntity = entities[device.player];
  $: controlEntities = {
    bass: entities[device.controls.bass],
    treble: entities[device.controls.treble],
    surroundLevel: entities[device.controls.surroundLevel],
    subGain: entities[device.controls.subGain],
    nightSound: entities[device.controls.nightSound],
    loudness: entities[device.controls.loudness],
    subwoofer: entities[device.controls.subwoofer],
    surroundEnabled: entities[device.controls.surroundEnabled],
    speechEnhancement: entities[device.controls.speechEnhancement]
  };

  function handleTogglePlayer() {
    dispatch('togglePlayer', { playerId: device.player });
  }

  function handleVolumeChange(event) {
    dispatch('volumeChange', { playerId: device.player, volume: event.detail });
  }

  function handleControlChange(controlId, value) {
    dispatch('controlChange', { entityId: controlId, value });
  }

  function handleToggleSwitch(entityId) {
    dispatch('toggleSwitch', { entityId });
  }
</script>

<div class="device-card">
  <h3 class="device-title">{device.name}</h3>

  {#if playerEntity}
    <AudioPlayerStatus
      {playerEntity}
      on:togglePlayer={handleTogglePlayer}
      on:volumeChange={handleVolumeChange}
    />
  {/if}

  {#if device.controls.bass && controlEntities.bass}
    <AudioSliderControl
      label="Bass"
      value={controlEntities.bass.state || 0}
      min={controlEntities.bass.attributes?.min || -10}
      max={controlEntities.bass.attributes?.max || 10}
      on:change={(e) => handleControlChange(device.controls.bass, e.detail)}
    />
  {/if}

  {#if device.controls.treble && controlEntities.treble}
    <AudioSliderControl
      label="Treble"
      value={controlEntities.treble.state || 0}
      min={controlEntities.treble.attributes?.min || -10}
      max={controlEntities.treble.attributes?.max || 10}
      on:change={(e) => handleControlChange(device.controls.treble, e.detail)}
    />
  {/if}

  {#if device.controls.surroundLevel && controlEntities.surroundLevel}
    <AudioSliderControl
      label="Surround Level"
      value={controlEntities.surroundLevel.state || 0}
      min={controlEntities.surroundLevel.attributes?.min || -15}
      max={controlEntities.surroundLevel.attributes?.max || 15}
      on:change={(e) => handleControlChange(device.controls.surroundLevel, e.detail)}
    />
  {/if}

  {#if device.controls.subGain && controlEntities.subGain}
    <AudioSliderControl
      label="Subwoofer Gain"
      value={controlEntities.subGain.state || 0}
      min={controlEntities.subGain.attributes?.min || -15}
      max={controlEntities.subGain.attributes?.max || 15}
      on:change={(e) => handleControlChange(device.controls.subGain, e.detail)}
    />
  {/if}

  <div class="toggle-controls">
    {#if device.controls.nightSound && controlEntities.nightSound}
      <button
        class="toggle-chip {controlEntities.nightSound.state === 'on' ? 'active' : ''}"
        on:click={() => handleToggleSwitch(device.controls.nightSound)}
      >
        Night Sound
      </button>
    {/if}

    {#if device.controls.loudness && controlEntities.loudness}
      <button
        class="toggle-chip {controlEntities.loudness.state === 'on' ? 'active' : ''}"
        on:click={() => handleToggleSwitch(device.controls.loudness)}
      >
        Loudness
      </button>
    {/if}

    {#if device.controls.subwoofer && controlEntities.subwoofer}
      <button
        class="toggle-chip {controlEntities.subwoofer.state === 'on' ? 'active' : ''}"
        on:click={() => handleToggleSwitch(device.controls.subwoofer)}
      >
        Subwoofer
      </button>
    {/if}

    {#if device.controls.surroundEnabled && controlEntities.surroundEnabled}
      <button
        class="toggle-chip {controlEntities.surroundEnabled.state === 'on' ? 'active' : ''}"
        on:click={() => handleToggleSwitch(device.controls.surroundEnabled)}
      >
        Surround
      </button>
    {/if}

    {#if device.controls.speechEnhancement && controlEntities.speechEnhancement}
      <button
        class="toggle-chip {controlEntities.speechEnhancement.state === 'on' ? 'active' : ''}"
        on:click={() => handleToggleSwitch(device.controls.speechEnhancement)}
      >
        Speech Enhancement
      </button>
    {/if}
  </div>
</div>

<style>
  .device-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 1.5rem;
  }

  .device-title {
    font-size: 1.125rem;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  }

  .toggle-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .toggle-chip {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    letter-spacing: 0.025em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
  }

  .toggle-chip:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .toggle-chip.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
  }
</style>
