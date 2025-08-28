<script>
  import { spring } from 'svelte/motion';
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let temperature = 72;
  export let humidity = 45;
  export let targetTemp = 70;
  
  const dispatch = createEventDispatcher();
  
  const temp = spring(temperature);
  const hum = spring(humidity);
  
  $: temp.set(temperature);
  $: hum.set(humidity);
  
  let rotation = 0;
  
  onMount(() => {
    const interval = setInterval(() => {
      rotation += 0.5;
    }, 50);
    return () => clearInterval(interval);
  });
</script>

<div class="orb-container">
  <div class="orb-glass">
    <!-- Animated gradient background -->
    <div 
      class="absolute inset-0 rounded-full"
      style="background: conic-gradient(from {rotation}deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6); opacity: 0.3; filter: blur(20px);"
    ></div>
    
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
          <stop offset="0%" style="stop-color:#3b82f6" />
          <stop offset="50%" style="stop-color:#8b5cf6" />
          <stop offset="100%" style="stop-color:#ec4899" />
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
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
</style>