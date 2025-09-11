<script>
  import { haStore } from '../stores/haStore';
  
  export let room;
  export let entities;
  
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
  
  function setVolume(entityId, volume) {
    haStore.callService('media_player', 'volume_set', entityId, { 
      volume_level: volume / 100 
    });
  }
  
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
</script>

<div class="room-control">
  <h2 class="text-lg font-light mb-6 text-gray-300 uppercase tracking-wider">
    {room.name} Controls
  </h2>
  
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
                  {entities[lightId].attributes?.friendly_name || lightId.split('.')[1]}
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
                    on:input={(e) => setBrightness(lightId, e.target.value)}
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
          {/if}
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
            on:input={(e) => setVolume(room.media, e.target.value)}
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
  {#if room.fan && entities[room.fan]}
    <section class="control-section">
      <h3 class="section-title">Climate</h3>
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
</style>