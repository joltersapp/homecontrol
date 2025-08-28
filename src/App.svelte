<script>
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import DataPill from './components/DataPill.svelte';
  import MediaControl from './components/MediaControl.svelte';
  import ClimateOrb from './components/ClimateOrb.svelte';
  import { get } from 'svelte/store';
  import { haStore } from './stores/haStore.js';
  
  let connected = false;
  let entities = {};
  let activeRoom = null;
  
  const unsubscribe = haStore.subscribe(state => {
    connected = state.connected;
    entities = state.entities;
  });
  
  onMount(() => {
    haStore.connect();
    
    return () => {
      unsubscribe();
      haStore.disconnect();
    };
  });
  
  // Service handlers
  function handleBassChange(e) {
    haStore.callService('number', 'set_value', 'number.living_room_sonos_bass', { value: e.detail });
  }
  
  function handleTrebleChange(e) {
    haStore.callService('number', 'set_value', 'number.living_room_sonos_treble', { value: e.detail });
  }
  
  function handleVolumeChange(e) {
    haStore.callService('media_player', 'volume_set', 'media_player.living_room_sonos', { 
      volume_level: e.detail / 100 
    });
  }
  
  function toggleSubwoofer() {
    const isOn = entities['switch.living_room_subwoofer_enabled']?.state === 'on';
    haStore.callService('switch', isOn ? 'turn_off' : 'turn_on', 'switch.living_room_subwoofer_enabled');
  }
  
  function toggleNightMode() {
    const isOn = entities['switch.living_room_sonos_night_sound']?.state === 'on';
    haStore.callService('switch', isOn ? 'turn_off' : 'turn_on', 'switch.living_room_sonos_night_sound');
  }
  
  const rooms = [
    { id: 'living', name: 'Living Room', icon: '🛋️', color: 'from-blue-500 to-purple-600' },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', color: 'from-orange-500 to-red-600' },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', color: 'from-purple-500 to-pink-600' },
    { id: 'office', name: 'Office', icon: '💻', color: 'from-green-500 to-teal-600' },
    { id: 'patio', name: 'Patio', icon: '🌿', color: 'from-teal-500 to-green-600' }
  ];
</script>

<main class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4 overflow-hidden">
  <!-- Animated Background -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
    <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    <div class="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
  </div>
  
  <div class="relative z-10 max-w-7xl mx-auto">
    <!-- Header -->
    <header class="mb-8" in:fly={{ y: -50, duration: 800, easing: cubicOut }}>
      <div class="flex items-center justify-between">
        <h1 class="text-5xl font-thin tracking-wider">
          Home<span class="font-light text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Control</span>
        </h1>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full {connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse"></div>
          <span class="text-sm text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>

    <!-- Room Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      {#each rooms as room, i}
        <button
          on:click={() => activeRoom = activeRoom === room.id ? null : room.id}
          in:scale={{ delay: i * 50, duration: 400, easing: cubicOut }}
          class="group relative overflow-hidden rounded-3xl p-6 backdrop-blur-lg transition-all duration-300 
                 {activeRoom === room.id ? 'bg-white/20 scale-105 shadow-2xl' : 'bg-white/10 hover:bg-white/15'}"
        >
          <div class="absolute inset-0 bg-gradient-to-br {room.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          <div class="relative">
            <div class="text-4xl mb-2">{room.icon}</div>
            <div class="text-sm font-medium">{room.name}</div>
          </div>
          {#if activeRoom === room.id}
            <div class="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Climate Orb -->
    <div class="mb-8" in:fade={{ delay: 300, duration: 600 }}>
      <ClimateOrb 
        temperature={entities['climate.walkway']?.attributes?.current_temperature || 72} 
        humidity={entities['climate.walkway']?.attributes?.current_humidity || 45} 
        targetTemp={entities['climate.walkway']?.attributes?.temperature || 70} 
        on:setTemp={(e) => {
          haStore.callService('climate', 'set_temperature', 'climate.walkway', { temperature: e.detail });
        }}
      />
    </div>

    <!-- Active Room Controls -->
    {#if activeRoom === 'living'}
      <div class="space-y-6" in:fly={{ x: -100, duration: 500, easing: cubicOut }}>
        <!-- Media Control -->
        <MediaControl 
          entityId="media_player.living_room_sonos"
          roomName="Living Room"
        />
        
        <!-- Audio Settings Pills -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DataPill 
            label="Bass"
            value={parseFloat(entities['number.living_room_sonos_bass']?.state) || 0}
            min={-10}
            max={10}
            unit=""
            gradient="from-purple-500 to-pink-500"
            on:change={handleBassChange}
          />
          <DataPill 
            label="Treble"
            value={parseFloat(entities['number.living_room_sonos_treble']?.state) || 0}
            min={-10}
            max={10}
            unit=""
            gradient="from-blue-500 to-cyan-500"
            on:change={handleTrebleChange}
          />
          <DataPill 
            label="Volume"
            value={Math.round((entities['media_player.living_room_sonos']?.attributes?.volume_level || 0) * 100)}
            min={0}
            max={100}
            unit="%"
            gradient="from-green-500 to-teal-500"
            on:change={handleVolumeChange}
          />
          <DataPill 
            label="Sub"
            value={entities['switch.living_room_subwoofer_enabled']?.state === 'on' ? 'ON' : 'OFF'}
            toggle={true}
            gradient="from-orange-500 to-red-500"
            on:toggle={toggleSubwoofer}
          />
        </div>
        
        <!-- Device Pills -->
        <div class="grid grid-cols-3 gap-4">
          <DataPill 
            label="Night Mode"
            value={entities['switch.living_room_sonos_night_sound']?.state === 'on' ? 'ON' : 'OFF'}
            toggle={true}
            gradient="from-indigo-500 to-purple-500"
            on:toggle={toggleNightMode}
          />
          <DataPill 
            label="TV"
            value={entities['media_player.77_oled']?.state || 'OFF'}
            toggle={true}
            gradient="from-gray-600 to-gray-800"
          />
          <DataPill 
            label="Lights"
            value="60%"
            min={0}
            max={100}
            unit="%"
            gradient="from-yellow-500 to-orange-500"
          />
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="fixed bottom-6 right-6 flex flex-col gap-3">
      <button class="glass-pill">
        <span>🌙</span> Sleep Mode
      </button>
      <button class="glass-pill">
        <span>🎬</span> Movie Time
      </button>
      <button class="glass-pill">
        <span>💡</span> All Off
      </button>
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: black;
  }

  .glass-pill {
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    transition: all 300ms;
    cursor: pointer;
  }
  
  .glass-pill:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  .animate-blob {
    animation: blob 7s infinite;
  }

  .animation-delay-2000 {
    animation-delay: 2s;
  }

  .animation-delay-4000 {
    animation-delay: 4s;
  }
</style>