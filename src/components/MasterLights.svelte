<script>
  import { haStore } from '../stores/haStore';

  export let entities;
  export let rooms;

  function toggleAllLights() {
    const allLights = getAllLightEntities();
    const anyOn = allLights.some(entityId => entities[entityId]?.state === 'on');
    const action = anyOn ? 'turn_off' : 'turn_on';

    allLights.forEach(entityId => {
      const domain = entityId.split('.')[0];
      haStore.callService(domain, action, entityId);
    });
  }

  function toggleRoomLights(room) {
    const roomLights = getRoomLightEntities(room);
    const anyOn = roomLights.some(entityId => entities[entityId]?.state === 'on');
    const action = anyOn ? 'turn_off' : 'turn_on';

    roomLights.forEach(entityId => {
      const domain = entityId.split('.')[0];
      haStore.callService(domain, action, entityId);
    });
  }

  function getAllLightEntities() {
    const allLights = [];
    rooms.forEach(room => {
      if (room.lights) {
        allLights.push(...room.lights);
      }
      if (room.lightGroups) {
        room.lightGroups.forEach(group => {
          allLights.push(...group.entities);
        });
      }
    });
    return [...new Set(allLights)]; // Remove duplicates
  }

  function getRoomLightEntities(room) {
    const roomLights = [];
    if (room.lights) {
      roomLights.push(...room.lights);
    }
    if (room.lightGroups) {
      room.lightGroups.forEach(group => {
        roomLights.push(...group.entities);
      });
    }
    return [...new Set(roomLights)];
  }

  function isRoomLightsOn(room) {
    const roomLights = getRoomLightEntities(room);
    return roomLights.some(entityId => entities[entityId]?.state === 'on');
  }

  function isAllLightsOn() {
    const allLights = getAllLightEntities();
    return allLights.some(entityId => entities[entityId]?.state === 'on');
  }

  // Room brightness functions
  function getRoomDimmableLights(room) {
    const roomLights = getRoomLightEntities(room);
    return roomLights.filter(entityId => entityId.startsWith('light.'));
  }

  function getRoomBrightness(room) {
    const dimmableLights = getRoomDimmableLights(room);
    const onLights = dimmableLights.filter(id => entities[id]?.state === 'on');
    if (onLights.length === 0) return 0;

    const avgBrightness = onLights.reduce((sum, entityId) => {
      const brightness = entities[entityId]?.attributes?.brightness || 255;
      return sum + Math.round(brightness / 255 * 100);
    }, 0) / onLights.length;

    return Math.round(avgBrightness);
  }

  function setRoomBrightness(room, brightness) {
    const dimmableLights = getRoomDimmableLights(room);
    dimmableLights.forEach(entityId => {
      if (entities[entityId]) {
        haStore.callService('light', 'turn_on', entityId, {
          brightness_pct: brightness
        });
      }
    });
  }

  // Local state for real-time slider updates
  let localRoomBrightness = {}; // Track each room's brightness
  let roomBrightnessTimeouts = {};

  function handleRoomBrightnessInput(room, value) {
    const brightness = parseInt(value);
    localRoomBrightness[room.name] = brightness;
    localRoomBrightness = localRoomBrightness; // Trigger reactivity

    // Clear existing timeout for this room
    if (roomBrightnessTimeouts[room.name]) {
      clearTimeout(roomBrightnessTimeouts[room.name]);
    }

    // Debounce the actual HA command
    roomBrightnessTimeouts[room.name] = setTimeout(() => {
      setRoomBrightness(room, brightness);
      // Reset local state after command sent
      setTimeout(() => {
        delete localRoomBrightness[room.name];
        localRoomBrightness = localRoomBrightness;
      }, 500);
    }, 300);
  }
</script>

<div class="master-lights">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Light Controls
  </h2>

  <!-- Master Control -->
  <div class="master-control glass mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-light text-gray-300">All Lights</h3>
        <p class="text-xs text-gray-500 mt-1">Control all lights in the house</p>
      </div>
      <button
        class="master-toggle {isAllLightsOn() ? 'active' : ''}"
        on:click={toggleAllLights}
      >
        {isAllLightsOn() ? 'ALL ON' : 'ALL OFF'}
      </button>
    </div>
  </div>

  <!-- Room Controls -->
  <div class="room-grid">
    {#each rooms as room}
      {@const roomLights = getRoomLightEntities(room)}
      {@const dimmableLights = getRoomDimmableLights(room)}
      {#if roomLights.length > 0}
        <div class="room-card glass">
          <div class="flex items-center justify-between mb-3">
            <h3 class="room-name">{room.name}</h3>
            <button
              class="room-toggle {isRoomLightsOn(room) ? 'active' : ''}"
              on:click={() => toggleRoomLights(room)}
            >
              {isRoomLightsOn(room) ? 'ON' : 'OFF'}
            </button>
          </div>

          <!-- Room Dimmer Control -->
          {#if dimmableLights.length > 0}
            <div class="room-dimmer mb-3">
              <div class="flex items-center justify-between mb-2">
                <span class="dimmer-label">Room Brightness</span>
                <span class="brightness-value">
                  {localRoomBrightness[room.name] !== undefined ? localRoomBrightness[room.name] : getRoomBrightness(room)}%
                </span>
              </div>
              <div class="dimmer-controls">
                <button
                  class="dimmer-button"
                  on:click={() => {
                    const current = localRoomBrightness[room.name] !== undefined ? localRoomBrightness[room.name] : getRoomBrightness(room);
                    handleRoomBrightnessInput(room, Math.max(0, current - 10));
                  }}
                >
                  −
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localRoomBrightness[room.name] !== undefined ? localRoomBrightness[room.name] : getRoomBrightness(room)}
                  on:input={(e) => handleRoomBrightnessInput(room, e.target.value)}
                  class="dimmer-slider"
                />
                <button
                  class="dimmer-button"
                  on:click={() => {
                    const current = localRoomBrightness[room.name] !== undefined ? localRoomBrightness[room.name] : getRoomBrightness(room);
                    handleRoomBrightnessInput(room, Math.min(100, current + 10));
                  }}
                >
                  +
                </button>
              </div>
            </div>
          {/if}

          <div class="light-list">
            {#each roomLights as lightId}
              {#if entities[lightId]}
                <div class="light-status">
                  <span class="light-dot {entities[lightId].state === 'on' ? 'on' : 'off'}"></span>
                  <span class="light-name">
                    {entities[lightId].attributes?.friendly_name || lightId.split('.')[1]}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .master-lights {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .master-control {
    padding: 2rem;
    border-radius: 20px;
  }

  .glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .master-toggle {
    padding: 1rem 2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
  }

  .master-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: scale(1.05);
  }

  .master-toggle.active {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.5);
    color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }

  .room-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .room-card {
    padding: 1.5rem;
    border-radius: 16px;
    transition: all 300ms ease;
  }

  .room-card:hover {
    border-color: rgba(0, 212, 255, 0.2);
    box-shadow: 0 10px 40px rgba(0, 212, 255, 0.1);
  }

  .room-name {
    font-size: 1rem;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.9);
  }

  .room-toggle {
    padding: 0.5rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
  }

  .room-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .room-toggle.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  .light-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .light-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .light-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 200ms ease;
  }

  .light-dot.on {
    background: #00d4ff;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  }

  .light-dot.off {
    background: rgba(255, 255, 255, 0.2);
  }

  .light-name {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  /* Room Dimmer Styles */
  .room-dimmer {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .dimmer-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.6);
  }

  .brightness-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #00d4ff;
  }

  .dimmer-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .dimmer-button {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dimmer-button:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  .dimmer-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .dimmer-slider {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }

  .dimmer-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    transition: all 200ms ease;
  }

  .dimmer-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.8);
  }

  .dimmer-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #00d4ff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    transition: all 200ms ease;
  }

  .dimmer-slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.8);
  }
</style>
