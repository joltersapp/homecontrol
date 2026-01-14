<script>
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ClimateOrb from './components/ClimateOrb.svelte';
  import RoomControl from './components/RoomControl.svelte';
  import AudioControl from './components/AudioControl.svelte';
  import SecurityView from './components/SecurityView.svelte';
  import MasterLights from './components/MasterLights.svelte';
  import PoolControl from './components/PoolControl.svelte';
  import TemperatureControl from './components/TemperatureControl.svelte';
  import DebugConsole from './components/DebugConsole.svelte';
  import { haStore } from './stores/haStore.js';
  import { version, buildTime, buildNumber } from './version.js';
  
  let connected = false;
  let entities = {};
  let activeRoom = null;
  let currentView = 'home'; // 'home', 'audio', or 'security'

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

  const rooms = [
    { 
      id: 'living', 
      name: 'Living Room',
      lights: ['light.living_room_light', 'switch.family_room_lamp'], // Display as "Living Room Lamp"
      media: 'media_player.living_room_sonos',
      climate: 'climate.walkway'
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      lights: ['light.kitchen_light', 'light.left_kitchen_light', 'light.right_kitchen_lights', 'light.kitchen_cabinet_light', 'switch.kitchen_cabinet_light'],
      media: 'media_player.kitchen'
    },
    {
      id: 'bedroom',
      name: 'Master Bedroom',
      lights: [],
      media: 'media_player.master_bedroom_sonos'
    },
    {
      id: 'guest_bedroom',
      name: 'Guest Bedroom',
      lights: ['light.guest_bedroom_fan_light_2']
    },
    {
      id: 'hallway',
      name: 'Hallway',
      lights: ['light.hallway_light', 'switch.gold_light']
    },
    {
      id: 'office',
      name: 'Office',
      lights: ['light.office_light', 'switch.office_lamp'],
      fan: 'fan.office_fan'
    },
    {
      id: 'patio',
      name: 'Patio',
      lights: ['light.hover_flush', 'light.hover_patio_left'],
      lightGroups: [
        {
          name: 'Patio Ceiling Lights',
          entities: [
            'light.patio_light_left_1',
            'light.patio_light_left_2',
            'light.patio_light_left_3',
            'light.patio_light_right_1',
            'light.patio_light_right_2',
            'light.patio_light_right_3'
          ]
        }
      ],
      fans: ['fan.hover_flush', 'fan.hover_patio_left'],
      media: 'media_player.terrace'
    },
    {
      id: 'outside',
      name: 'Outside Lights',
      lights: ['switch.front_door_light', 'switch.outside_lights'],
      lightGroups: [
        {
          name: 'All Lights',
          entities: ['switch.front_door_light', 'switch.outside_lights']
        }
      ]
    }
  ];
</script>

<main class="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 text-gray-100 ios-safe-area">
  <!-- Subtle animated background -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
    <div class="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full filter blur-[100px] animate-drift"></div>
    <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full filter blur-[100px] animate-drift-delayed"></div>
  </div>

  <div class="relative z-10 max-w-7xl mx-auto px-4 py-6 ios-content">
    <!-- Header -->
    <header class="mb-6 md:mb-8" in:fly={{ y: -20, duration: 600, easing: cubicOut }}>
      <!-- Mobile Header -->
      <div class="md:hidden">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-extralight tracking-wider text-gray-100">
            HOME<span class="text-cyan-400 font-light">CONTROL</span>
          </h1>
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full {connected ? 'bg-cyan-400' : 'bg-red-400'} animate-pulse"></div>
            <span class="text-xs uppercase tracking-wider text-gray-400">
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        <!-- Mobile Navigation - Scrollable -->
        <nav class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          <button
            class="nav-button flex-shrink-0 {currentView === 'home' ? 'active' : ''}"
            on:click={() => currentView = 'home'}
          >
            Rooms
          </button>
          <button
            class="nav-button flex-shrink-0 {currentView === 'lights' ? 'active' : ''}"
            on:click={() => currentView = 'lights'}
          >
            Lights
          </button>
          <button
            class="nav-button flex-shrink-0 {currentView === 'audio' ? 'active' : ''}"
            on:click={() => currentView = 'audio'}
          >
            Audio
          </button>
          <button
            class="nav-button flex-shrink-0 {currentView === 'security' ? 'active' : ''}"
            on:click={() => {
              console.log('[App Debug] Switching to security view');
              console.log('[App Debug] Available entities:', Object.keys(entities).filter(k => k.includes('camera')));
              currentView = 'security';
            }}
          >
            Security
          </button>
          <button
            class="nav-button flex-shrink-0 {currentView === 'pool' ? 'active' : ''}"
            on:click={() => currentView = 'pool'}
          >
            Outside
          </button>
          <button
            class="nav-button flex-shrink-0 {currentView === 'climate' ? 'active' : ''}"
            on:click={() => currentView = 'climate'}
          >
            Climate
          </button>
        </nav>
      </div>

      <!-- Desktop Header -->
      <div class="hidden md:flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-extralight tracking-widest text-gray-100">
            HOME<span class="text-cyan-400 font-light">CONTROL</span>
          </h1>
          <span
            class="text-xs text-gray-500 font-mono mt-2 cursor-help"
            title="Build #{buildNumber} - {new Date(buildTime).toLocaleString()}"
          >
            v{version}
          </span>
        </div>
        <div class="flex items-center gap-6">
          <!-- Navigation -->
          <nav class="flex gap-2">
            <button
              class="nav-button {currentView === 'home' ? 'active' : ''}"
              on:click={() => currentView = 'home'}
            >
              Rooms
            </button>
            <button
              class="nav-button {currentView === 'lights' ? 'active' : ''}"
              on:click={() => currentView = 'lights'}
            >
              Lights
            </button>
            <button
              class="nav-button {currentView === 'audio' ? 'active' : ''}"
              on:click={() => currentView = 'audio'}
            >
              Audio
            </button>
            <button
              class="nav-button {currentView === 'security' ? 'active' : ''}"
              on:click={() => {
                console.log('[App Debug] Switching to security view');
                console.log('[App Debug] Available entities:', Object.keys(entities).filter(k => k.includes('camera')));
                currentView = 'security';
              }}
            >
              Security
            </button>
            <button
              class="nav-button {currentView === 'pool' ? 'active' : ''}"
              on:click={() => currentView = 'pool'}
            >
              Outside
            </button>
            <button
              class="nav-button {currentView === 'climate' ? 'active' : ''}"
              on:click={() => currentView = 'climate'}
            >
              Climate
            </button>
          </nav>
          <div class="flex items-center gap-3">
            <div class="w-1.5 h-1.5 rounded-full {connected ? 'bg-cyan-400' : 'bg-red-400'} animate-pulse"></div>
            <span class="text-xs uppercase tracking-wider text-gray-400">
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>

    {#if currentView === 'home'}
    <!-- Room Selector -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {#each rooms as room, i}
        <button
          on:click={() => activeRoom = activeRoom === room.id ? null : room.id}
          in:scale={{ delay: i * 30, duration: 400, easing: cubicOut }}
          class="relative group p-6 rounded-2xl transition-all duration-300
                 {activeRoom === room.id 
                   ? 'glass-active scale-[1.02]' 
                   : 'glass hover:scale-[0.98]'}"
        >
          <div class="text-sm font-light tracking-wide">{room.name}</div>
          {#if activeRoom === room.id}
            <div class="absolute top-3 right-3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Climate Control -->
    <div class="mb-8 flex justify-center" in:fade={{ delay: 200, duration: 600 }}>
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
    {#if activeRoom}
      <div in:fly={{ x: -50, duration: 400, easing: cubicOut }}>
        <RoomControl 
          room={rooms.find(r => r.id === activeRoom)}
          {entities}
        />
      </div>
    {/if}
    {:else if currentView === 'lights'}
      <!-- Master Lights Page -->
      <div in:fly={{ x: 50, duration: 400, easing: cubicOut }}>
        <MasterLights {entities} {rooms} />
      </div>
    {:else if currentView === 'audio'}
      <!-- Audio Controls Page -->
      <div in:fly={{ x: 50, duration: 400, easing: cubicOut }}>
        <AudioControl {entities} />
      </div>
    {:else if currentView === 'security'}
      <!-- Security View Page -->
      <div in:fly={{ x: 50, duration: 400, easing: cubicOut }}>
        <SecurityView {entities} />
      </div>
    {:else if currentView === 'pool'}
      <!-- Pool Control Page -->
      <div in:fly={{ x: 50, duration: 400, easing: cubicOut }}>
        <PoolControl {entities} />
      </div>
    {:else if currentView === 'climate'}
      <!-- Temperature Control Page -->
      <div in:fly={{ x: 50, duration: 400, easing: cubicOut }}>
        <TemperatureControl {entities} />
      </div>
    {/if}

  </div>

  <!-- Debug Console - Always available -->
  <DebugConsole />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: #0a0a0a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Prevent horizontal scroll on mobile */
    overflow-x: hidden;
  }

  /* iOS PWA Safe Area Insets - Prevents content from hiding behind notch/home indicator */
  :global(.ios-safe-area) {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  :global(.ios-content) {
    /* Additional padding on top for status bar when in PWA mode */
    padding-top: max(1.5rem, env(safe-area-inset-top));
    /* Extra padding at bottom for iPhone home indicator */
    padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  }

  /* Hide scrollbar for mobile navigation */
  :global(.no-scrollbar::-webkit-scrollbar) {
    display: none;
  }

  :global(.no-scrollbar) {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Better touch scrolling on iOS */
  :global(*) {
    -webkit-overflow-scrolling: touch;
  }

  /* Touch Feedback for Mobile Devices */
  @media (hover: none) and (pointer: coarse) {
    /* Global touch feedback for all buttons and interactive elements */
    :global(button:active),
    :global(.btn:active),
    :global([role="button"]:active),
    :global(a:active),
    :global(input[type="button"]:active),
    :global(input[type="submit"]:active) {
      transform: scale(0.96);
      opacity: 0.85;
      transition: transform 100ms ease-out, opacity 100ms ease-out;
    }

    /* Ensure minimum touch target size */
    :global(button),
    :global(.btn),
    :global([role="button"]),
    :global(input[type="button"]),
    :global(input[type="submit"]) {
      min-width: 44px;
      min-height: 44px;
    }

    /* Disable hover effects on touch devices */
    :global(.glass:hover),
    :global(.glass-button:hover),
    :global(.nav-button:hover) {
      transform: none;
    }
  }

  /* Preserve hover effects on desktop */
  @media (hover: hover) and (pointer: fine) {
    :global(button:hover),
    :global(.btn:hover) {
      cursor: pointer;
    }
  }

  .glass {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }

  .glass:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .glass-active {
    background: rgba(0, 212, 255, 0.08);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 212, 255, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 212, 255, 0.1);
  }

  .glass-button {
    padding: 0.875rem 1.75rem;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    font-size: 0.8125rem;
    font-weight: 300;
    letter-spacing: 0.025em;
    color: rgba(255, 255, 255, 0.9);
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    text-transform: uppercase;
  }
  
  .glass-button:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px -5px rgba(0, 212, 255, 0.2);
  }

  .glass-button:active {
    transform: scale(0.98);
  }

  .nav-button {
    padding: 0.75rem 1.25rem;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    font-size: 0.8125rem;
    font-weight: 300;
    letter-spacing: 0.025em;
    color: rgba(255, 255, 255, 0.7);
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    text-transform: uppercase;
    /* Minimum touch target size for mobile */
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .nav-button:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 212, 255, 0.2);
  }
  
  .nav-button.active {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  @keyframes drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -30px) scale(1.05); }
    66% { transform: translate(-20px, 10px) scale(0.95); }
  }

  .animate-drift {
    animation: drift 20s ease-in-out infinite;
  }

  .animate-drift-delayed {
    animation: drift 20s ease-in-out infinite;
    animation-delay: 10s;
  }
</style>