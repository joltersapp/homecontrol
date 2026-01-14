<script>
  import { createEventDispatcher } from 'svelte';
  import AudioGroupMember from './AudioGroupMember.svelte';

  const dispatch = createEventDispatcher();

  export let sonosDevices;
  export let entities;
  export let selectedSpeakers = [];
  export let getGroupedSpeakers;
  export let isInGroup;

  function getAllAvailableSpeakers() {
    return sonosDevices.filter(device => {
      const entity = entities[device.player];
      if (!entity) return false;

      const grouped = isInGroup(device.player);
      if (!grouped) return true;

      const groupMembers = getGroupedSpeakers(device.player);
      return groupMembers[0] === device.player;
    });
  }

  function handleToggleSpeaker(playerId) {
    dispatch('toggleSpeaker', { playerId });
  }

  function handleJoinSpeakers() {
    dispatch('joinSpeakers');
  }

  function handleUngroupAll(masterPlayerId) {
    dispatch('ungroupAll', { masterPlayerId });
  }

  function handleUnjoinSpeaker(playerId) {
    dispatch('unjoinSpeaker', { playerId });
  }

  $: availableSpeakers = getAllAvailableSpeakers();
</script>

{#if availableSpeakers.length > 1}
  <div class="grouping-section glass mb-8">
    <h3 class="text-lg font-light text-gray-300 mb-4">Group Speakers</h3>
    <p class="text-xs text-gray-500 mb-4">
      Select 2 or more speakers to group them together. First selected becomes master.
    </p>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {#each availableSpeakers as device}
        {@const playerState = entities[device.player]?.state || 'unknown'}
        <button
          class="speaker-select {selectedSpeakers.includes(device.player) ? 'selected' : ''} {playerState === 'playing' ? 'playing' : ''}"
          on:click={() => handleToggleSpeaker(device.player)}
        >
          <span class="speaker-check {selectedSpeakers.includes(device.player) ? 'checked' : ''}">
            {#if selectedSpeakers.includes(device.player)}✓{/if}
          </span>
          <span class="speaker-name">{device.name}</span>
          <span class="speaker-state">{playerState.toUpperCase()}</span>
        </button>
      {/each}
    </div>

    {#if selectedSpeakers.length >= 2}
      <button class="join-button" on:click={handleJoinSpeakers}>
        Join {selectedSpeakers.length} Speakers
      </button>
    {:else}
      <button class="join-button disabled" disabled>
        Select at least 2 speakers to join
      </button>
    {/if}
  </div>
{/if}

{#each sonosDevices as device}
  {#if entities[device.player] && isInGroup(device.player)}
    {@const groupMembers = getGroupedSpeakers(device.player)}
    {#if groupMembers[0] === device.player}
      <div class="group-section glass mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-light text-gray-300">{device.name} Group</h3>
            <p class="text-xs text-gray-500 mt-1">
              {groupMembers.length} speaker{groupMembers.length > 1 ? 's' : ''} grouped
            </p>
          </div>
          <button class="unjoin-button" on:click={() => handleUngroupAll(device.player)}>
            Ungroup All
          </button>
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          {#each groupMembers as memberId}
            {@const memberDevice = sonosDevices.find(d => d.player === memberId)}
            {@const isMaster = memberId === device.player}
            {#if memberDevice}
              <AudioGroupMember
                memberName={memberDevice.name}
                {isMaster}
                on:remove={() => handleUnjoinSpeaker(memberId)}
              />
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
{/each}

<style>
  .glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 1.5rem;
  }

  .grouping-section {
    text-align: center;
  }

  .speaker-select {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 300ms ease;
  }

  .speaker-select:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.3);
  }

  .speaker-select.selected {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.5);
  }

  .speaker-select.playing {
    border-color: rgba(0, 255, 136, 0.3);
  }

  .speaker-select.playing.selected {
    border-color: rgba(0, 212, 255, 0.5);
  }

  .speaker-check {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #00d4ff;
    font-weight: bold;
    transition: all 200ms ease;
  }

  .speaker-check.checked {
    background: rgba(0, 212, 255, 0.3);
    border-color: #00d4ff;
  }

  .speaker-name {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 300;
  }

  .speaker-state {
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .speaker-select.playing .speaker-state {
    color: rgba(0, 255, 136, 0.8);
  }

  .join-button {
    padding: 1rem 2rem;
    background: rgba(0, 212, 255, 0.15);
    border: 2px solid rgba(0, 212, 255, 0.3);
    border-radius: 12px;
    color: #00d4ff;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
    width: 100%;
    max-width: 400px;
  }

  .join-button:hover:not(.disabled) {
    background: rgba(0, 212, 255, 0.25);
    border-color: rgba(0, 212, 255, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
  }

  .join-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .group-section {
    padding: 1.5rem;
  }

  .unjoin-button {
    padding: 0.5rem 1.25rem;
    background: rgba(255, 100, 100, 0.1);
    border: 1px solid rgba(255, 100, 100, 0.3);
    border-radius: 8px;
    color: rgba(255, 100, 100, 0.9);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
  }

  .unjoin-button:hover {
    background: rgba(255, 100, 100, 0.2);
    border-color: rgba(255, 100, 100, 0.5);
  }
</style>
