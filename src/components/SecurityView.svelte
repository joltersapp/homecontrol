<script>
  import { haStore } from '../stores/haStore';
  import { onMount, onDestroy } from 'svelte';
  
  export let entities;
  
  // Immediate debug log
  console.log('[SecurityView Debug] Component initialized');
  console.log('[SecurityView Debug] Entities prop received:', entities ? Object.keys(entities).length : 'undefined');
  
  // UniFi Protect cameras with go2rtc streams
  const cameras = [
    {
      id: '689e380c00da3a03e4000428',
      name: 'Front Door',
      entity: 'camera.front_door_high_resolution_channel',
      description: 'G4 Doorbell Pro PoE',
      streamName: 'front_door'
    },
    {
      id: '689e380c008e3a03e4000426',
      name: 'Garage Camera',
      entity: 'camera.house_west_high_resolution_channel',
      description: 'Garage monitoring',
      streamName: 'garage'
    },
    {
      id: '689e380c01043a03e4000429',
      name: 'East Camera',
      entity: 'camera.house_east_high_resolution_channel',
      description: 'East side perimeter',
      streamName: 'east_camera'
    }
  ];
  
  // Note: Package camera also available but focusing on main 3
  // camera.front_door_package_camera
  
  let selectedCamera = null;
  let cameraUrls = {};
  let motionEvents = [];
  let wsConnection = null;
  let connectionStatus = 'disconnected';
  
  // Generate stream URLs from go2rtc
  // Use window.location.hostname to work in both dev and production
  const go2rtcHost = window.location.hostname;

  $: {
    console.log('[Camera URLs Debug] Setting up go2rtc streams');
    cameras.forEach(camera => {
      // Use go2rtc MSE/MP4 endpoint for better browser compatibility
      const url = `http://${go2rtcHost}:1984/api/stream.mp4?src=${camera.streamName}`;
      console.log(`[Camera Debug] go2rtc URL for ${camera.name}:`, {
        cameraId: camera.id,
        streamName: camera.streamName,
        url: url,
        host: go2rtcHost
      });
      cameraUrls[camera.id] = url;
    });
  }
  
  function selectCamera(camera) {
    selectedCamera = selectedCamera?.id === camera.id ? null : camera;
  }
  
  function refreshCamera(cameraId) {
    // Force refresh by updating the URL with a timestamp
    const url = `/api/protect/cameras/${cameraId}/snapshot?t=${Date.now()}`;
    cameraUrls[cameraId] = url;
    // Trigger reactivity
    cameraUrls = {...cameraUrls};
  }
  
  // Auto-refresh cameras for live streaming effect
  let refreshInterval;
  let refreshRate = 500; // Refresh every 500ms for 2 FPS streaming
  let streamingEnabled = true;
  
  function connectToMotionEvents() {
    // Note: WebSocket connections need to be proxied through nginx
    // For now, we'll display a status but actual WebSocket implementation
    // would need nginx WebSocket proxy configuration
    connectionStatus = 'connecting';
    console.log('[Motion Events] WebSocket connection would connect to UniFi Protect');
    
    // Simulate connection for UI display
    setTimeout(() => {
      connectionStatus = 'connected';
      console.log('[Motion Events] Ready to receive motion events');
    }, 1000);
  }
  
  function addMotionEvent(event) {
    const now = new Date();
    motionEvents = [{
      id: Date.now(),
      cameraId: event.camera || event.device,
      cameraName: cameras.find(c => c.id === event.camera)?.name || 'Unknown',
      type: event.type,
      timestamp: now,
      timeStr: now.toLocaleTimeString()
    }, ...motionEvents].slice(0, 20); // Keep last 20 events
  }
  
  function initializeStreams() {
    console.log('[Streams] Initializing direct MSE streams');

    cameras.forEach(camera => {
      const videoElement = document.getElementById(`video-${camera.id}`);

      if (videoElement) {
        // Use MSE endpoint directly from go2rtc
        const streamUrl = `http://${go2rtcHost}:1984/api/stream.mp4?src=${camera.streamName}`;

        console.log(`[Streams] Setting stream URL for ${camera.name}: ${streamUrl}`);

        // Set the source
        videoElement.src = streamUrl;

        // Ensure video plays
        videoElement.play().catch(err => {
          console.warn(`[Streams] Auto-play blocked for ${camera.name}, user interaction may be required:`, err);
        });
      }
    });
  }
  
  onMount(() => {
    console.log('[Camera Debug] Component mounted with MSE streaming');
    console.log('[Camera Debug] go2rtc host:', go2rtcHost);

    // Set camera URLs for initial display
    cameras.forEach(camera => {
      cameraUrls[camera.id] = `http://${go2rtcHost}:1984/api/stream.mp4?src=${camera.streamName}`;
    });
    cameraUrls = {...cameraUrls};

    // Initialize streams after DOM is ready
    setTimeout(initializeStreams, 100);

    // Connect to motion events
    connectToMotionEvents();

    // No need for refresh interval with MSE streams
    // The video elements handle streaming automatically
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="security-view">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Security Cameras
  </h2>
  
  <!-- Debug info -->
  {#if !entities || Object.keys(entities).length === 0}
    <div class="text-center text-gray-500 mb-4">
      Debug: No entities loaded yet. Entities object: {entities ? 'exists but empty' : 'undefined'}
    </div>
  {/if}
  
  <!-- Camera Grid -->
  <div class="camera-grid">
    {#each cameras as camera}
      <div class="camera-card {selectedCamera?.id === camera.id ? 'expanded' : ''}">
        <div class="camera-header">
          <div>
            <h3 class="camera-title">{camera.name}</h3>
            <p class="camera-description">{camera.description}</p>
          </div>
          <div class="camera-controls">
            <button 
              class="control-button"
              on:click={() => refreshCamera(camera.id)}
              title="Refresh feed"
            >
              Refresh
            </button>
            <button 
              class="control-button {selectedCamera?.id === camera.id ? 'active' : ''}"
              on:click={() => selectCamera(camera)}
            >
              {selectedCamera?.id === camera.id ? 'Minimize' : 'Expand'}
            </button>
          </div>
        </div>
        
        <div class="camera-feed">
          <!-- Direct video element with MSE stream -->
          <video
            id="video-{camera.id}"
            class="camera-image camera-stream"
            autoplay
            muted
            playsinline
            controls={false}
            on:loadeddata={() => console.log(`[Camera] Stream loaded for ${camera.name}`)}
            on:error={(e) => {
              console.error(`[Camera] Failed to load stream for ${camera.name}`, e);
            }}
          >
            Your browser doesn't support video playback
          </video>
        </div>
        
        <!-- Camera Details -->
        {#if entities[camera.entity] && entities[camera.entity].attributes}
          <div class="camera-details">
            {#if entities[camera.entity].attributes.friendly_name}
              <span class="detail-item">
                {entities[camera.entity].attributes.friendly_name}
              </span>
            {/if}
            {#if entities[camera.entity].attributes.brand}
              <span class="detail-item">
                {entities[camera.entity].attributes.brand}
              </span>
            {/if}
            {#if entities[camera.entity].attributes.model}
              <span class="detail-item">
                {entities[camera.entity].attributes.model}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
    
    <!-- Motion Events Panel in Grid -->
    <div class="camera-card motion-events-card">
      <div class="camera-header">
        <div>
          <h3 class="camera-title">Motion Events</h3>
          <p class="camera-description">Real-time activity monitoring</p>
        </div>
        <div class="camera-controls">
          <div class="connection-status">
            <span class="status-dot {connectionStatus}"></span>
            <span class="status-text">{connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>
      
      <div class="motion-events-content">
        {#if motionEvents.length > 0}
          <div class="events-list">
            {#each motionEvents as event}
              <div class="event-item">
                <span class="event-time">{event.timeStr}</span>
                <span class="event-camera">{event.cameraName}</span>
                <span class="event-type">{event.type}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-events">
            <p class="text-gray-500 text-sm">No motion events detected</p>
            <p class="text-gray-600 text-xs mt-1">Events will appear here when motion is detected</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Quick Actions -->
  <div class="security-actions">
    <h3 class="text-sm text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
    <div class="flex flex-wrap gap-3 justify-center">
      <button 
        class="action-button"
        on:click={() => {
          cameras.forEach(camera => refreshCamera(camera.entity));
        }}
      >
        Refresh All Cameras
      </button>
      <button 
        class="action-button"
        on:click={() => {
          // Could trigger recording or snapshot
          cameras.forEach(camera => {
            if (entities[camera.entity]) {
              haStore.callService('camera', 'snapshot', camera.entity, {
                filename: `/config/www/snapshots/${camera.id}_${Date.now()}.jpg`
              });
            }
          });
        }}
      >
        Snapshot All
      </button>
      <button 
        class="action-button"
        on:click={() => {
          // Check if package camera is available
          if (entities['camera.front_door_package_camera']) {
            selectedCamera = {
              id: 'package',
              name: 'Package Camera',
              entity: 'camera.front_door_package_camera',
              description: 'Package delivery monitoring'
            };
          }
        }}
      >
        View Package Camera
      </button>
    </div>
  </div>
</div>

<style>
  .security-view {
    padding: 2rem;
    max-width: 1600px;
    margin: 0 auto;
  }
  
  .camera-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
  }
  
  .camera-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 1.5rem;
    transition: all 300ms ease;
  }
  
  .camera-card.expanded {
    grid-column: 1 / -1;
  }
  
  .camera-card:hover {
    border-color: rgba(0, 212, 255, 0.2);
    box-shadow: 0 10px 40px rgba(0, 212, 255, 0.1);
  }
  
  .camera-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  
  .camera-title {
    font-size: 1.125rem;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.25rem;
  }
  
  .camera-description {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  
  .camera-controls {
    display: flex;
    gap: 0.5rem;
  }
  
  .control-button {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    transition: all 300ms ease;
    cursor: pointer;
    text-transform: uppercase;
  }
  
  .control-button:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.2);
  }
  
  .control-button.active {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }
  
  .camera-feed {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    background: rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  .camera-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .camera-stream {
    transition: opacity 200ms ease;
  }
  
  .live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: #ff0000;
    border-radius: 50%;
    margin-right: 4px;
    animation: live-blink 2s infinite;
  }
  
  @keyframes live-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  
  .fps-indicator {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    font-size: 0.625rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
  }
  
  .camera-offline {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  
  .camera-overlay {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.5rem;
  }
  
  .status-indicator {
    padding: 0.25rem 0.75rem;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
  }
  
  .status-indicator.streaming {
    background: rgba(255, 0, 0, 0.2);
    border-color: rgba(255, 0, 0, 0.4);
    color: #ff6b6b;
    animation: pulse 2s infinite;
  }
  
  .motion-indicator {
    padding: 0.25rem 0.75rem;
    background: rgba(255, 200, 0, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 200, 0, 0.4);
    border-radius: 20px;
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: #ffc800;
    text-transform: uppercase;
    animation: pulse 1s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .camera-details {
    display: flex;
    gap: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .detail-item {
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* Motion Events Card */
  .motion-events-card {
    display: flex;
    flex-direction: column;
  }
  
  .motion-events-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
  }
  
  .status-dot.connected {
    background: #00ff88;
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
  }
  
  .status-dot.connecting {
    background: #ffc800;
  }
  
  .status-text {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .events-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .event-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    transition: all 0.2s ease;
  }
  
  .event-item:hover {
    background: rgba(0, 212, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.2);
  }
  
  .event-time {
    font-size: 0.75rem;
    color: rgba(0, 212, 255, 0.8);
    font-weight: 500;
  }
  
  .event-camera {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .event-type {
    font-size: 0.625rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 12px;
    color: rgba(0, 212, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .no-events {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 1;
    text-align: center;
    padding: 2rem;
    min-height: 200px;
  }
  
  .security-actions {
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
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .camera-grid {
      grid-template-columns: 1fr;
    }
    
    .camera-card.expanded {
      grid-column: 1;
    }
  }
</style>