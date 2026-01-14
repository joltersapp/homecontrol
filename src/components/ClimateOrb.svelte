<script>
  import { spring } from 'svelte/motion';
  import { createEventDispatcher } from 'svelte';

  export let temperature = 72;
  export let humidity = 45;
  export let targetTemp = 70;

  const dispatch = createEventDispatcher();

  const temp = spring(temperature);
  const hum = spring(humidity);

  $: temp.set(temperature);
  $: hum.set(humidity);
</script>

<div class="orb-container">
  <div class="orb-glass">
    <!-- Animated gradient background -->
    <div class="animated-gradient"></div>
    
    <!-- Inner orb -->
    <div class="absolute inset-4 rounded-full bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
      <!-- Temperature -->
      <div class="text-6xl font-thin text-white mb-2">
        {Math.round($temp)}°
      </div>
      
      <!-- Target indicator -->
      <div class="text-sm text-gray-400 mb-4">
        Target: {targetTemp}°
      </div>
      
      <!-- Humidity -->
      <div class="flex items-center gap-2 text-gray-300">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 00-.894.553l-4 8a1 1 0 00.183 1.154l4 4a1 1 0 001.414 0l4-4a1 1 0 00.183-1.154l-4-8A1 1 0 0010 2z"/>
        </svg>
        <span class="text-sm">{Math.round($hum)}%</span>
      </div>
    </div>
    
    <!-- Control ring -->
    <svg class="absolute inset-0 w-full h-full -rotate-90">
      <circle
        cx="50%"
        cy="50%"
        r="48%"
        fill="none"
        stroke="url(#tempGradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray={`${(temperature / 100) * 301.6} 301.6`}
      />
      <defs>
        <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#00d4ff" />
          <stop offset="50%" style="stop-color:#0891b2" />
          <stop offset="100%" style="stop-color:#0284c7" />
        </linearGradient>
      </defs>
    </svg>
    
    <!-- Plus/Minus buttons -->
    <button 
      class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm 
             hover:bg-white/20 transition-all duration-300 flex items-center justify-center text-white"
      on:click={() => {
        targetTemp--;
        dispatch('setTemp', targetTemp);
      }}
    >
      -
    </button>
    <button 
      class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm 
             hover:bg-white/20 transition-all duration-300 flex items-center justify-center text-white"
      on:click={() => {
        targetTemp++;
        dispatch('setTemp', targetTemp);
      }}
    >
      +
    </button>
  </div>
</div>

<style>
  .orb-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .orb-glass {
    position: relative;
    width: 16rem;
    height: 16rem;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    border-radius: 50%;
    border: 1px solid rgba(0, 212, 255, 0.1);
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.4),
      inset 0 0 30px rgba(0, 212, 255, 0.05);
  }

  .animated-gradient {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #00d4ff, #0891b2, #0284c7, #00d4ff);
    opacity: 0.25;
    filter: blur(25px);
    animation: rotate 40s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>