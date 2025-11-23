<script>
  import { haStore } from '../stores/haStore';
  
  export let entities;
  
  // Sonos devices with their control entities
  const sonosDevices = [
    {
      id: 'living_room',
      name: 'Living Room',
      player: 'media_player.living_room_sonos',
      controls: {
        bass: 'number.living_room_sonos_bass',
        treble: 'number.living_room_sonos_treble',
        nightSound: 'switch.living_room_sonos_night_sound',
        loudness: 'switch.living_room_sonos_loudness',
        subwoofer: 'switch.living_room_subwoofer_enabled',
        subGain: 'number.living_room_sub_gain',
        surroundLevel: 'number.living_room_surround_level',
        surroundEnabled: 'switch.living_room_surround_enabled',
        speechEnhancement: 'switch.living_room_speech_enhancement'
      }
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      player: 'media_player.kitchen',
      controls: {
        bass: 'number.kitchen_bass',
        treble: 'number.kitchen_treble',
        nightSound: 'switch.kitchen_night_sound',
        loudness: 'switch.kitchen_loudness',
        subwoofer: 'switch.kitchen_subwoofer_enabled'
      }
    },
    {
      id: 'master_bedroom',
      name: 'Master Bedroom',
      player: 'media_player.master_bedroom_sonos',
      controls: {
        bass: 'number.master_bedroom_sonos_bass',
        treble: 'number.master_bedroom_sonos_treble',
        nightSound: 'switch.master_bedroom_sonos_night_sound',
        loudness: 'switch.master_bedroom_sonos_loudness'
      }
    },
    {
      id: 'terrace',
      name: 'Patio',
      player: 'media_player.terrace',
      controls: {
        bass: 'number.terrace_bass',
        treble: 'number.terrace_treble',
        nightSound: 'switch.terrace_night_sound',
        loudness: 'switch.terrace_loudness'
      }
    }
  ];
  
  function setNumberValue(entityId, value) {
    haStore.callService('number', 'set_value', entityId, { value: parseFloat(value) });
  }
  
  function toggleSwitch(entityId) {
    if (!entities[entityId]) return;
    const isOn = entities[entityId].state === 'on';
    haStore.callService('switch', isOn ? 'turn_off' : 'turn_on', entityId);
  }
  
  function setVolume(playerId, volume) {
    haStore.callService('media_player', 'volume_set', playerId, { 
      volume_level: volume / 100 
    });
  }
  
  function toggleMediaPlayer(playerId) {
    if (!entities[playerId]) return;
    const isPlaying = entities[playerId].state === 'playing';
    haStore.callService('media_player', isPlaying ? 'media_pause' : 'media_play', playerId);
  }

  // Sonos grouping functionality
  let selectedSpeakers = [];

  function getAllAvailableSpeakers() {
    return sonosDevices.filter(device => {
      const entity = entities[device.player];
      if (!entity) return false;

      // Show all speakers that aren't already in a group
      // OR speakers that are the master of their own group
      const grouped = isInGroup(device.player);
      if (!grouped) return true;

      const groupMembers = getGroupedSpeakers(device.player);
      return groupMembers[0] === device.player; // Only show if this is the master
    });
  }

  function getGroupedSpeakers(playerId) {
    const entity = entities[playerId];
    return entity?.attributes?.group_members || [];
  }

  function isInGroup(playerId) {
    const groupMembers = getGroupedSpeakers(playerId);
    return groupMembers.length > 1;
  }

  function joinSpeakers() {
    if (selectedSpeakers.length < 2) return;

    // First speaker becomes the master
    const master = selectedSpeakers[0];
    const members = selectedSpeakers.slice(1);

    haStore.callService('media_player', 'join', master, {
      group_members: members
    });

    // Clear selection
    selectedSpeakers = [];
  }

  function unjoinSpeaker(playerId) {
    haStore.callService('media_player', 'unjoin', playerId);
  }

  function ungroupAll(masterPlayerId) {
    // Get all group members
    const groupMembers = getGroupedSpeakers(masterPlayerId);

    // Unjoin each member except the master
    groupMembers.forEach(memberId => {
      if (memberId !== masterPlayerId) {
        haStore.callService('media_player', 'unjoin', memberId);
      }
    });
  }

  function toggleSpeakerSelection(playerId) {
    if (selectedSpeakers.includes(playerId)) {
      selectedSpeakers = selectedSpeakers.filter(id => id !== playerId);
    } else {
      selectedSpeakers = [...selectedSpeakers, playerId];
    }
  }
</script>

<div class="audio-control">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Whole Home Audio Control
  </h2>

  <!-- Sonos Grouping Section -->
  {#if getAllAvailableSpeakers().length > 1}
    {@const availableSpeakers = getAllAvailableSpeakers()}
    <div class="grouping-section glass mb-8">
      <h3 class="text-lg font-light text-gray-300 mb-4">Group Speakers</h3>
      <p class="text-xs text-gray-500 mb-4">Select 2 or more speakers to group them together. First selected becomes master.</p>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {#each availableSpeakers as device}
          {@const playerState = entities[device.player]?.state || 'unknown'}
          <button
            class="speaker-select {selectedSpeakers.includes(device.player) ? 'selected' : ''} {playerState === 'playing' ? 'playing' : ''}"
            on:click={() => toggleSpeakerSelection(device.player)}
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
        <button class="join-button" on:click={joinSpeakers}>
          Join {selectedSpeakers.length} Speakers
        </button>
      {:else}
        <button class="join-button disabled" disabled>
          Select at least 2 speakers to join
        </button>
      {/if}
    </div>
  {/if}

  <!-- Active Groups Section -->
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
            <button class="unjoin-button" on:click={() => ungroupAll(device.player)}>
              Ungroup All
            </button>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            {#each groupMembers as memberId}
              {@const memberDevice = sonosDevices.find(d => d.player === memberId)}
              {@const isMaster = memberId === device.player}
              {#if memberDevice}
                <div class="group-member {isMaster ? 'master' : ''}">
                  <span class="member-name">{memberDevice.name}</span>
                  {#if isMaster}
                    <span class="master-badge">MASTER</span>
                  {:else}
                    <button class="remove-member" on:click={() => unjoinSpeaker(memberId)}>×</button>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  {/each}

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {#each sonosDevices as device}
      <div class="device-card">
        <h3 class="device-title">{device.name}</h3>
        
        <!-- Player Status and Volume -->
        {#if entities[device.player]}
          <div class="control-row">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-400">Player Status</span>
              <button 
                class="status-button {entities[device.player].state === 'playing' ? 'active' : ''}"
                on:click={() => toggleMediaPlayer(device.player)}
              >
                {entities[device.player].state === 'playing' ? 'PLAYING' : entities[device.player].state.toUpperCase()}
              </button>
            </div>
            
            {#if entities[device.player].attributes?.media_title}
              <p class="text-xs text-gray-500 mb-3">
                {entities[device.player].attributes.media_title}
              </p>
            {/if}
            
            <!-- Volume Control -->
            <div class="control-item">
              <label class="control-label">Volume</label>
              <div class="flex items-center gap-2">
                <button 
                  class="control-btn"
                  on:click={() => {
                    const current = entities[device.player].attributes?.volume_level ? 
                      Math.round(entities[device.player].attributes.volume_level * 100) : 0;
                    setVolume(device.player, Math.max(0, current - 5));
                  }}
                >
                  −
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={entities[device.player].attributes?.volume_level ? 
                    Math.round(entities[device.player].attributes.volume_level * 100) : 0}
                  on:input={(e) => setVolume(device.player, e.target.value)}
                  class="audio-slider flex-1"
                />
                <button 
                  class="control-btn"
                  on:click={() => {
                    const current = entities[device.player].attributes?.volume_level ? 
                      Math.round(entities[device.player].attributes.volume_level * 100) : 0;
                    setVolume(device.player, Math.min(100, current + 5));
                  }}
                >
                  +
                </button>
                <span class="value-display">
                  {entities[device.player].attributes?.volume_level ? 
                    Math.round(entities[device.player].attributes.volume_level * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Bass Control -->
        {#if device.controls.bass && entities[device.controls.bass]}
          <div class="control-item">
            <label class="control-label">Bass</label>
            <div class="flex items-center gap-2">
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.bass].state) || 0;
                  const min = entities[device.controls.bass].attributes?.min || -10;
                  setNumberValue(device.controls.bass, Math.max(min, current - 1));
                }}
              >
                −
              </button>
              <input 
                type="range" 
                min={entities[device.controls.bass].attributes?.min || -10}
                max={entities[device.controls.bass].attributes?.max || 10}
                value={entities[device.controls.bass].state || 0}
                on:input={(e) => setNumberValue(device.controls.bass, e.target.value)}
                class="audio-slider flex-1"
              />
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.bass].state) || 0;
                  const max = entities[device.controls.bass].attributes?.max || 10;
                  setNumberValue(device.controls.bass, Math.min(max, current + 1));
                }}
              >
                +
              </button>
              <span class="value-display">{entities[device.controls.bass].state || 0}</span>
            </div>
          </div>
        {/if}
        
        <!-- Treble Control -->
        {#if device.controls.treble && entities[device.controls.treble]}
          <div class="control-item">
            <label class="control-label">Treble</label>
            <div class="flex items-center gap-2">
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.treble].state) || 0;
                  const min = entities[device.controls.treble].attributes?.min || -10;
                  setNumberValue(device.controls.treble, Math.max(min, current - 1));
                }}
              >
                −
              </button>
              <input 
                type="range" 
                min={entities[device.controls.treble].attributes?.min || -10}
                max={entities[device.controls.treble].attributes?.max || 10}
                value={entities[device.controls.treble].state || 0}
                on:input={(e) => setNumberValue(device.controls.treble, e.target.value)}
                class="audio-slider flex-1"
              />
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.treble].state) || 0;
                  const max = entities[device.controls.treble].attributes?.max || 10;
                  setNumberValue(device.controls.treble, Math.min(max, current + 1));
                }}
              >
                +
              </button>
              <span class="value-display">{entities[device.controls.treble].state || 0}</span>
            </div>
          </div>
        {/if}
        
        <!-- Surround Level (if available) -->
        {#if device.controls.surroundLevel && entities[device.controls.surroundLevel]}
          <div class="control-item">
            <label class="control-label">Surround Level</label>
            <div class="flex items-center gap-2">
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.surroundLevel].state) || 0;
                  const min = entities[device.controls.surroundLevel].attributes?.min || -15;
                  setNumberValue(device.controls.surroundLevel, Math.max(min, current - 1));
                }}
              >
                −
              </button>
              <input 
                type="range" 
                min={entities[device.controls.surroundLevel].attributes?.min || -15}
                max={entities[device.controls.surroundLevel].attributes?.max || 15}
                value={entities[device.controls.surroundLevel].state || 0}
                on:input={(e) => setNumberValue(device.controls.surroundLevel, e.target.value)}
                class="audio-slider flex-1"
              />
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.surroundLevel].state) || 0;
                  const max = entities[device.controls.surroundLevel].attributes?.max || 15;
                  setNumberValue(device.controls.surroundLevel, Math.min(max, current + 1));
                }}
              >
                +
              </button>
              <span class="value-display">{entities[device.controls.surroundLevel].state || 0}</span>
            </div>
          </div>
        {/if}
        
        <!-- Subwoofer Gain (if available) -->
        {#if device.controls.subGain && entities[device.controls.subGain]}
          <div class="control-item">
            <label class="control-label">Subwoofer Gain</label>
            <div class="flex items-center gap-2">
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.subGain].state) || 0;
                  const min = entities[device.controls.subGain].attributes?.min || -15;
                  setNumberValue(device.controls.subGain, Math.max(min, current - 1));
                }}
              >
                −
              </button>
              <input 
                type="range" 
                min={entities[device.controls.subGain].attributes?.min || -15}
                max={entities[device.controls.subGain].attributes?.max || 15}
                value={entities[device.controls.subGain].state || 0}
                on:input={(e) => setNumberValue(device.controls.subGain, e.target.value)}
                class="audio-slider flex-1"
              />
              <button 
                class="control-btn"
                on:click={() => {
                  const current = parseFloat(entities[device.controls.subGain].state) || 0;
                  const max = entities[device.controls.subGain].attributes?.max || 15;
                  setNumberValue(device.controls.subGain, Math.min(max, current + 1));
                }}
              >
                +
              </button>
              <span class="value-display">{entities[device.controls.subGain].state || 0}</span>
            </div>
          </div>
        {/if}
        
        <!-- Toggle Controls -->
        <div class="toggle-controls">
          {#if device.controls.nightSound && entities[device.controls.nightSound]}
            <button 
              class="toggle-chip {entities[device.controls.nightSound].state === 'on' ? 'active' : ''}"
              on:click={() => toggleSwitch(device.controls.nightSound)}
            >
              Night Sound
            </button>
          {/if}
          
          {#if device.controls.loudness && entities[device.controls.loudness]}
            <button 
              class="toggle-chip {entities[device.controls.loudness].state === 'on' ? 'active' : ''}"
              on:click={() => toggleSwitch(device.controls.loudness)}
            >
              Loudness
            </button>
          {/if}
          
          {#if device.controls.subwoofer && entities[device.controls.subwoofer]}
            <button 
              class="toggle-chip {entities[device.controls.subwoofer].state === 'on' ? 'active' : ''}"
              on:click={() => toggleSwitch(device.controls.subwoofer)}
            >
              Subwoofer
            </button>
          {/if}
          
          {#if device.controls.surroundEnabled && entities[device.controls.surroundEnabled]}
            <button 
              class="toggle-chip {entities[device.controls.surroundEnabled].state === 'on' ? 'active' : ''}"
              on:click={() => toggleSwitch(device.controls.surroundEnabled)}
            >
              Surround
            </button>
          {/if}
          
          {#if device.controls.speechEnhancement && entities[device.controls.speechEnhancement]}
            <button 
              class="toggle-chip {entities[device.controls.speechEnhancement].state === 'on' ? 'active' : ''}"
              on:click={() => toggleSwitch(device.controls.speechEnhancement)}
            >
              Speech Enhancement
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Group Actions -->
  <div class="group-actions">
    <h3 class="text-sm text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
    <div class="flex flex-wrap gap-3 justify-center">
      <button 
        class="action-button"
        on:click={() => {
          sonosDevices.forEach(device => {
            if (device.controls.nightSound && entities[device.controls.nightSound]) {
              haStore.callService('switch', 'turn_on', device.controls.nightSound);
            }
          });
        }}
      >
        Enable All Night Sound
      </button>
      <button 
        class="action-button"
        on:click={() => {
          sonosDevices.forEach(device => {
            if (device.controls.nightSound && entities[device.controls.nightSound]) {
              haStore.callService('switch', 'turn_off', device.controls.nightSound);
            }
          });
        }}
      >
        Disable All Night Sound
      </button>
      <button 
        class="action-button"
        on:click={() => {
          sonosDevices.forEach(device => {
            if (device.controls.bass && entities[device.controls.bass]) {
              setNumberValue(device.controls.bass, 0);
            }
            if (device.controls.treble && entities[device.controls.treble]) {
              setNumberValue(device.controls.treble, 0);
            }
          });
        }}
      >
        Reset All EQ
      </button>
    </div>
  </div>
</div>

<style>
  .audio-control {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
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
  
  .control-row {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
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
  
  .value-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.3);
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

  /* Sonos Grouping Styles */
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

  .group-member {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 8px;
    color: rgba(0, 212, 255, 0.9);
    font-size: 0.875rem;
  }

  .group-member.master {
    background: rgba(0, 255, 136, 0.1);
    border-color: rgba(0, 255, 136, 0.3);
    color: rgba(0, 255, 136, 0.9);
  }

  .member-name {
    flex: 1;
  }

  .master-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.5rem;
    background: rgba(0, 255, 136, 0.2);
    border: 1px solid rgba(0, 255, 136, 0.3);
    border-radius: 4px;
    color: rgba(0, 255, 136, 1);
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .remove-member {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid rgba(255, 100, 100, 0.3);
    border-radius: 4px;
    color: rgba(255, 100, 100, 0.9);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .remove-member:hover {
    background: rgba(255, 100, 100, 0.3);
    border-color: rgba(255, 100, 100, 0.5);
    transform: scale(1.1);
  }
</style>