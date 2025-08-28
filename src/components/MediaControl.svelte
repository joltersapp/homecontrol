<script>
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { haStore } from '../stores/haStore.js';
  import { onMount, onDestroy } from 'svelte';
  
  export let entityId = '';
  export let roomName = '';
  
  let isPlaying = false;
  let currentTrack = 'Not Playing';
  let artist = '';
  let albumArt = null;
  let volume = 50;
  let entities = {};
  
  const unsubscribe = haStore.subscribe(state => {
    entities = state.entities;
    if (entities[entityId]) {
      const entity = entities[entityId];
      isPlaying = entity.state === 'playing';
      volume = Math.round((entity.attributes?.volume_level || 0) * 100);
      
      if (entity.attributes?.media_title) {
        currentTrack = entity.attributes.media_title;
      } else {
        currentTrack = isPlaying ? 'Playing' : 'Not Playing';
      }
      
      artist = entity.attributes?.media_artist || '';
      albumArt = entity.attributes?.entity_picture ? 
        `http://192.168.1.222:8123${entity.attributes.entity_picture}` : null;
    }
  });
  
  onDestroy(() => {
    unsubscribe();
  });
  
  function handlePlayPause() {
    haStore.callService('media_player', isPlaying ? 'media_pause' : 'media_play', entityId);
  }
  
  function handlePrevious() {
    haStore.callService('media_player', 'media_previous_track', entityId);
  }
  
  function handleNext() {
    haStore.callService('media_player', 'media_next_track', entityId);
  }
  
  function handleVolumeChange() {
    haStore.callService('media_player', 'volume_set', entityId, { 
      volume_level: volume / 100 
    });
  }
</script>

<div class="media-card" in:fly={{ y: 20, duration: 500, easing: cubicOut }}>
  <div class="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl"></div>
  
  <div class="relative p-6">
    <div class="flex items-start gap-6">
      <!-- Album Art -->
      <div class="album-art">
        {#if albumArt}
          <img src={albumArt} alt="Album" class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg class="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        {/if}
      </div>
      
      <!-- Track Info -->
      <div class="flex-1">
        <div class="text-xs text-gray-400 mb-1">{roomName}</div>
        <div class="text-xl font-light text-white mb-1">{currentTrack}</div>
        <div class="text-sm text-gray-400">{artist}</div>
        
        <!-- Progress Bar -->
        <div class="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500" style="width: 35%"></div>
        </div>
      </div>
    </div>
    
    <!-- Controls -->
    <div class="flex items-center justify-between mt-6">
      <div class="flex items-center gap-2">
        <button class="control-btn" on:click={handlePrevious}>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        <button class="control-btn control-btn-primary" on:click={handlePlayPause}>
          {#if isPlaying}
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          {:else}
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          {/if}
        </button>
        <button class="control-btn" on:click={handleNext}>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
      
      <!-- Volume -->
      <div class="flex items-center gap-3">
        <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input 
          type="range" 
          min="0" 
          max="100" 
          bind:value={volume}
          on:input={handleVolumeChange}
          class="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
        />
      </div>
    </div>
  </div>
</div>

<style>
  .media-card {
    position: relative;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    border-radius: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }
  
  .album-art {
    width: 6rem;
    height: 6rem;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
  
  .control-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    transition: all 300ms;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border: none;
    cursor: pointer;
  }
  
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .control-btn-primary {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(to right, #a855f7, #ec4899);
  }
  
  .control-btn-primary:hover {
    transform: scale(1.1);
  }
  
  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    background: white;
    border-radius: 50%;
    cursor: pointer;
  }
</style>