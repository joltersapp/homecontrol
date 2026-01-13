<script>
  import { haStore } from '../stores/haStore';

  export let room;
  export let entities;

  // Debounce helper to prevent WebSocket flooding on slider changes
  function debounce(fn, delay = 300) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  function toggleLight(entityId) {
    if (!entities[entityId]) return;
    
    const isOn = entities[entityId].state === 'on';
    const domain = entityId.split('.')[0];
    haStore.callService(domain, isOn ? 'turn_off' : 'turn_on', entityId);
  }
  
  function setBrightness(entityId, brightness) {
    haStore.callService('light', 'turn_on', entityId, {
      brightness_pct: brightness
    });
  }

  // Debounced version to prevent WebSocket flooding
  const debouncedSetBrightness = debounce(setBrightness, 300);

  function setVolume(entityId, volume) {
    haStore.callService('media_player', 'volume_set', entityId, {
      volume_level: volume / 100
    });
  }

  // Debounced version for volume
  const debouncedSetVolume = debounce(setVolume, 300);
  
  function toggleMedia(entityId) {
    if (!entities[entityId]) return;
    
    const isPlaying = entities[entityId].state === 'playing';
    haStore.callService('media_player', isPlaying ? 'media_pause' : 'media_play', entityId);
  }
  
  function toggleFan(entityId) {
    if (!entities[entityId]) return;

    const isOn = entities[entityId].state === 'on';
    haStore.callService('fan', isOn ? 'turn_off' : 'turn_on', entityId);
  }

  function toggleLightGroup(lightGroup) {
    const isAnyOn = lightGroup.entities.some(entityId => entities[entityId]?.state === 'on');
    const action = isAnyOn ? 'turn_off' : 'turn_on';

    lightGroup.entities.forEach(entityId => {
      const domain = entityId.split('.')[0];
      haStore.callService(domain, action, entityId);
    });
  }

  function setLightGroupBrightness(lightGroup, brightness) {
    lightGroup.entities.forEach(entityId => {
      // Only apply brightness to light entities, not switches
      if (entityId.startsWith('light.')) {
        haStore.callService('light', 'turn_on', entityId, {
          brightness_pct: brightness
        });
      }
    });
  }

  // Debounced version for light groups
  const debouncedSetLightGroupBrightness = debounce(setLightGroupBrightness, 300);

  function setLightGroupColor(lightGroup, rgb) {
    lightGroup.entities.forEach(entityId => {
      // Only apply color to light entities, not switches
      if (entityId.startsWith('light.')) {
        haStore.callService('light', 'turn_on', entityId, {
          rgb_color: rgb
        });
      }
    });
  }

  function getLightGroupState(lightGroup) {
    const anyOn = lightGroup.entities.some(entityId => entities[entityId]?.state === 'on');
    if (!anyOn) return { isOn: false, brightness: 0, hasLights: false };

    // Get only actual light entities (not switches)
    const lightEntities = lightGroup.entities.filter(entityId => entityId.startsWith('light.'));
    const hasLights = lightEntities.length > 0;

    if (!hasLights) {
      return { isOn: true, brightness: 0, hasLights: false };
    }

    // Get average brightness of lights that are on
    const onLights = lightEntities.filter(entityId => entities[entityId]?.state === 'on');
    if (onLights.length === 0) {
      return { isOn: true, brightness: 0, hasLights: true };
    }

    const avgBrightness = onLights.reduce((sum, entityId) => {
      const brightness = entities[entityId]?.attributes?.brightness || 255;
      return sum + Math.round(brightness / 255 * 100);
    }, 0) / onLights.length;

    return { isOn: true, brightness: Math.round(avgBrightness), hasLights: true };
  }

  // Room-level dimmer control
  function getAllRoomLights() {
    const allLights = [];
    if (room.lights) {
      allLights.push(...room.lights.filter(id => id.startsWith('light.')));
    }
    if (room.lightGroups) {
      room.lightGroups.forEach(group => {
        allLights.push(...group.entities.filter(id => id.startsWith('light.')));
      });
    }
    return [...new Set(allLights)]; // Remove duplicates
  }

  function getRoomBrightness() {
    const allLights = getAllRoomLights();
    const onLights = allLights.filter(id => entities[id]?.state === 'on');
    if (onLights.length === 0) return 0;

    const avgBrightness = onLights.reduce((sum, entityId) => {
      const brightness = entities[entityId]?.attributes?.brightness || 255;
      return sum + Math.round(brightness / 255 * 100);
    }, 0) / onLights.length;

    return Math.round(avgBrightness);
  }

  function setRoomBrightness(brightness) {
    const allLights = getAllRoomLights();
    allLights.forEach(entityId => {
      if (entities[entityId]) {
        haStore.callService('light', 'turn_on', entityId, {
          brightness_pct: brightness
        });
      }
    });
  }

  function isAnyRoomLightOn() {
    const allLights = getAllRoomLights();
    return allLights.some(id => entities[id]?.state === 'on');
  }
</script>

<div class="room-control">
  <h2 class="text-lg font-light mb-6 text-gray-300 uppercase tracking-wider">
    {room.name} Controls
  </h2>

  <!-- Room Master Dimmer -->
  {#if getAllRoomLights().length > 0}
    {@const roomBrightness = getRoomBrightness()}
    {@const roomLightsOn = isAnyRoomLightOn()}
    <section class="control-section master-dimmer-section">
      <h3 class="section-title">Room Master Dimmer</h3>
      <div class="control-item master-control-item">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-300">
            All {room.name} Lights
          </span>
          <span class="text-xs text-gray-400">
            {roomBrightness}%
          </span>
        </div>
        {#if roomLightsOn}
          <div class="flex items-center gap-2">
            <button
              class="control-btn"
              on:click={() => {
                setRoomBrightness(Math.max(0, roomBrightness - 10));
              }}
            >
              −
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={roomBrightness}
              on:input={(e) => setRoomBrightness(e.target.value)}
              class="brightness-slider flex-1"
            />
            <button
              class="control-btn"
              on:click={() => {
                setRoomBrightness(Math.min(100, roomBrightness + 10));
              }}
            >
              +
            </button>
          </div>
        {:else}
          <p class="text-xs text-gray-500 text-center">Turn on lights to adjust brightness</p>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Lighting Controls -->
  {#if room.lights && room.lights.length > 0}
    <section class="control-section">
      <h3 class="section-title">Lighting</h3>
      <div class="space-y-3">
        {#each room.lights as lightId}
          {#if entities[lightId]}
            <div class="control-item">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-300">
                  {lightId === 'switch.family_room_lamp'
                    ? 'Living Room Lamp'
                    : lightId === 'switch.front_door_light'
                    ? 'Front Door'
                    : lightId === 'switch.outside_lights'
                    ? 'House Lights'
                    : entities[lightId].attributes?.friendly_name || lightId.split('.')[1]}
                </span>
                <button 
                  class="toggle-button {entities[lightId].state === 'on' ? 'active' : ''}"
                  on:click={() => toggleLight(lightId)}
                >
                  {entities[lightId].state === 'on' ? 'ON' : 'OFF'}
                </button>
              </div>
              {#if entities[lightId].state === 'on' && lightId.startsWith('light.')}
                <div class="flex items-center gap-2 mt-2">
                  <button 
                    class="control-btn"
                    on:click={() => {
                      const current = entities[lightId].attributes?.brightness ? 
                        Math.round(entities[lightId].attributes.brightness / 255 * 100) : 100;
                      setBrightness(lightId, Math.max(0, current - 10));
                    }}
                  >
                    −
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={entities[lightId].attributes?.brightness ? 
                      Math.round(entities[lightId].attributes.brightness / 255 * 100) : 100}
                    on:input={(e) => debouncedSetBrightness(lightId, e.target.value)}
                    class="brightness-slider flex-1"
                  />
                  <button 
                    class="control-btn"
                    on:click={() => {
                      const current = entities[lightId].attributes?.brightness ? 
                        Math.round(entities[lightId].attributes.brightness / 255 * 100) : 100;
                      setBrightness(lightId, Math.min(100, current + 10));
                    }}
                  >
                    +
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Debug: Entity not found -->
            <div class="control-item bg-red-500/10 border-red-500/30">
              <p class="text-xs text-red-400">Entity not found: {lightId}</p>
              <p class="text-xs text-gray-500 mt-1">Check entity ID in Home Assistant</p>
            </div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  <!-- Light Groups -->
  {#if room.lightGroups && room.lightGroups.length > 0}
    <section class="control-section">
      <h3 class="section-title">Light Groups</h3>
      <div class="space-y-3">
        {#each room.lightGroups as lightGroup}
          {@const groupState = getLightGroupState(lightGroup)}
          <div class="control-item">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-300">
                {lightGroup.name}
              </span>
              <button
                class="toggle-button {groupState.isOn ? 'active' : ''}"
                on:click={() => toggleLightGroup(lightGroup)}
              >
                {groupState.isOn ? 'ON' : 'OFF'}
              </button>
            </div>

            {#if groupState.isOn && groupState.hasLights}
              <!-- Brightness Control -->
              <div class="flex items-center gap-2 mt-3">
                <span class="text-xs text-gray-400 min-w-[60px]">Brightness</span>
                <button
                  class="control-btn"
                  on:click={() => {
                    setLightGroupBrightness(lightGroup, Math.max(0, groupState.brightness - 10));
                  }}
                >
                  −
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={groupState.brightness}
                  on:input={(e) => debouncedSetLightGroupBrightness(lightGroup, e.target.value)}
                  class="brightness-slider flex-1"
                />
                <button
                  class="control-btn"
                  on:click={() => {
                    setLightGroupBrightness(lightGroup, Math.min(100, groupState.brightness + 10));
                  }}
                >
                  +
                </button>
                <span class="text-xs text-gray-400 min-w-[40px]">{groupState.brightness}%</span>
              </div>

              <!-- Color Control -->
              <div class="mt-3">
                <span class="text-xs text-gray-400 block mb-2">Color</span>
                <div class="color-presets">
                  <button
                    class="color-preset"
                    style="background: rgb(255, 255, 255);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 255, 255])}
                    title="White"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(255, 200, 150);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 200, 150])}
                    title="Warm White"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(255, 0, 0);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 0, 0])}
                    title="Red"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(255, 165, 0);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 165, 0])}
                    title="Orange"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(255, 255, 0);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 255, 0])}
                    title="Yellow"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(0, 255, 0);"
                    on:click={() => setLightGroupColor(lightGroup, [0, 255, 0])}
                    title="Green"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(0, 255, 255);"
                    on:click={() => setLightGroupColor(lightGroup, [0, 255, 255])}
                    title="Cyan"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(0, 0, 255);"
                    on:click={() => setLightGroupColor(lightGroup, [0, 0, 255])}
                    title="Blue"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(128, 0, 255);"
                    on:click={() => setLightGroupColor(lightGroup, [128, 0, 255])}
                    title="Purple"
                  ></button>
                  <button
                    class="color-preset"
                    style="background: rgb(255, 0, 255);"
                    on:click={() => setLightGroupColor(lightGroup, [255, 0, 255])}
                    title="Magenta"
                  ></button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Media Controls -->
  {#if room.media && entities[room.media]}
    <section class="control-section">
      <h3 class="section-title">Media</h3>
      <div class="control-item">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-gray-300">
            {entities[room.media].attributes?.friendly_name || 'Media Player'}
          </span>
          <button 
            class="toggle-button {entities[room.media].state === 'playing' ? 'active' : ''}"
            on:click={() => toggleMedia(room.media)}
          >
            {entities[room.media].state === 'playing' ? 'PAUSE' : 'PLAY'}
          </button>
        </div>
        {#if entities[room.media].attributes?.media_title}
          <p class="text-xs text-gray-500 mb-2">
            {entities[room.media].attributes.media_title}
          </p>
        {/if}
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">Volume</span>
          <button 
            class="control-btn control-btn-sm"
            on:click={() => {
              const current = entities[room.media].attributes?.volume_level ? 
                Math.round(entities[room.media].attributes.volume_level * 100) : 0;
              setVolume(room.media, Math.max(0, current - 5));
            }}
          >
            −
          </button>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={entities[room.media].attributes?.volume_level ? 
              Math.round(entities[room.media].attributes.volume_level * 100) : 0}
            on:input={(e) => debouncedSetVolume(room.media, e.target.value)}
            class="volume-slider flex-1"
          />
          <button 
            class="control-btn control-btn-sm"
            on:click={() => {
              const current = entities[room.media].attributes?.volume_level ? 
                Math.round(entities[room.media].attributes.volume_level * 100) : 0;
              setVolume(room.media, Math.min(100, current + 5));
            }}
          >
            +
          </button>
          <span class="text-xs text-gray-400">
            {entities[room.media].attributes?.volume_level ? 
              Math.round(entities[room.media].attributes.volume_level * 100) : 0}%
          </span>
        </div>
      </div>
    </section>
  {/if}
  
  <!-- Fan Controls -->
  {#if (room.fan && entities[room.fan]) || (room.fans && room.fans.length > 0)}
    <section class="control-section">
      <h3 class="section-title">Climate</h3>
      <div class="space-y-3">
        <!-- Single fan (backward compatibility) -->
        {#if room.fan && entities[room.fan]}
          <div class="control-item">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-300">
                {entities[room.fan].attributes?.friendly_name || 'Fan'}
              </span>
              <button
                class="toggle-button {entities[room.fan].state === 'on' ? 'active' : ''}"
                on:click={() => toggleFan(room.fan)}
              >
                {entities[room.fan].state === 'on' ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        {/if}

        <!-- Multiple fans -->
        {#if room.fans}
          {#each room.fans as fanId}
            {#if entities[fanId]}
              <div class="control-item">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-300">
                    {entities[fanId].attributes?.friendly_name || fanId.split('.')[1]}
                  </span>
                  <button
                    class="toggle-button {entities[fanId].state === 'on' ? 'active' : ''}"
                    on:click={() => toggleFan(fanId)}
                  >
                    {entities[fanId].state === 'on' ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .room-control {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .control-section {
    margin-bottom: 2rem;
  }
  
  .control-section:last-child {
    margin-bottom: 0;
  }
  
  .section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 1rem;
    font-weight: 300;
  }
  
  .control-item {
    background: rgba(255, 255, 255, 0.02);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
  
  .toggle-button {
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
  
  .toggle-button:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .toggle-button.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }
  
  .brightness-slider,
  .volume-slider {
    width: 100%;
    height: 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }
  
  .brightness-slider::-webkit-slider-thumb,
  .volume-slider::-webkit-slider-thumb {
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
  
  .brightness-slider::-webkit-slider-thumb:hover,
  .volume-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 0 10px rgba(0, 212, 255, 0.15);
    transform: scale(1.2);
  }
  
  .brightness-slider::-moz-range-thumb,
  .volume-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: all 200ms ease;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
  }
  
  .brightness-slider::-moz-range-thumb:hover,
  .volume-slider::-moz-range-thumb:hover {
    box-shadow: 0 0 0 10px rgba(0, 212, 255, 0.15);
    transform: scale(1.2);
  }
  
  .control-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 8px;
    color: rgba(0, 212, 255, 0.9);
    font-size: 1.25rem;
    font-weight: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 200ms ease;
    user-select: none;
  }
  
  .control-btn-sm {
    width: 32px;
    height: 32px;
    min-width: 32px;
    font-size: 1.125rem;
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

  .color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .color-preset {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 200ms ease;
    position: relative;
  }

  .color-preset:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
  }

  .color-preset:active {
    transform: scale(0.95);
  }

  /* Room Master Dimmer Styles */
  .master-dimmer-section {
    background: rgba(0, 212, 255, 0.05);
    border: 1px solid rgba(0, 212, 255, 0.15);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .master-dimmer-section .section-title {
    color: rgba(0, 212, 255, 0.8);
    margin-bottom: 1rem;
  }

  .master-control-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 212, 255, 0.1);
  }
</style>