<script>
  import { spring } from 'svelte/motion';
  import { createEventDispatcher } from 'svelte';
  
  export let label = '';
  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let unit = '';
  export let toggle = false;
  export let gradient = 'from-blue-500 to-purple-600';
  
  const dispatch = createEventDispatcher();
  
  let isPressed = false;
  let isDragging = false;
  let startY = 0;
  let startValue = 0;
  
  const progress = spring(0, {
    stiffness: 0.1,
    damping: 0.9
  });
  
  $: normalizedValue = toggle ? (value === 'ON' ? 1 : 0) : (value - min) / (max - min);
  $: progress.set(normalizedValue);
  
  function handleMouseDown(e) {
    if (toggle) {
      dispatch('toggle');
      return;
    }
    isPressed = true;
    isDragging = true;
    startY = e.clientY;
    startValue = value;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    const delta = (startY - e.clientY) / 100;
    const newValue = Math.max(min, Math.min(max, startValue + delta * (max - min)));
    dispatch('change', newValue);
  }
  
  function handleMouseUp() {
    isPressed = false;
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
</script>

<div 
  class="pill-container {isPressed ? 'scale-95' : ''}"
  on:mousedown={handleMouseDown}
  role="button"
  tabindex="0"
>
  <div class="pill-glass">
    <!-- Background gradient -->
    <div class="absolute inset-0 rounded-full bg-gradient-to-br {gradient} opacity-20"></div>
    
    <!-- Progress fill -->
    <div class="absolute inset-0 rounded-full overflow-hidden">
      <div 
        class="absolute bottom-0 left-0 right-0 bg-gradient-to-t {gradient} opacity-40 transition-all duration-300"
        style="height: {$progress * 100}%"
      ></div>
    </div>
    
    <!-- Content -->
    <div class="relative z-10 px-6 py-4">
      <div class="text-xs text-gray-400 mb-1">{label}</div>
      <div class="text-2xl font-light">
        {#if toggle}
          <span class="text-lg">{value}</span>
        {:else}
          {typeof value === 'number' ? Math.round(value) : value}<span class="text-sm ml-1 text-gray-400">{unit}</span>
        {/if}
      </div>
    </div>
    
    <!-- Glow effect -->
    {#if isPressed}
      <div class="absolute inset-0 rounded-full bg-white opacity-10 animate-pulse"></div>
    {/if}
  </div>
</div>

<style>
  .pill-container {
    position: relative;
    cursor: pointer;
    user-select: none;
    transition: transform 150ms;
  }
  
  .pill-glass {
    position: relative;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 300ms;
  }
  
  .pill-glass:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .pill-container:hover .pill-glass {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
  }
</style>