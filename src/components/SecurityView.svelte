<script>
  import { haStore } from '../stores/haStore';
  import { onMount, onDestroy } from 'svelte';
  
  export let entities;
  
  // Immediate debug log
  console.log('[SecurityView Debug] Component initialized');
  console.log('[SecurityView Debug] Entities prop received:', entities ? Object.keys(entities).length : 'undefined');
  
  // UniFi Protect cameras with direct API access
  const cameras = [
    {
      id: '689e380c00da3a03e4000428',
      name: 'Front Door',
      entity: 'camera.front_door_high_resolution_channel',
      description: 'G4 Doorbell Pro PoE'
    },
    {
      id: '689e380c01043a03e4000429',
      name: 'East Camera',
      entity: 'camera.house_east_high_resolution_channel',
      description: 'East side perimeter'
    },
    {
      id: '689e380c008e3a03e4000426',
      name: 'Garage Camera',
      entity: 'camera.house_west_high_resolution_channel',
      description: 'Garage monitoring'
    }
  ];
  
  // Note: Package camera also available but focusing on main 3
  // camera.front_door_package_camera
  
  let selectedCamera = null;
  let cameraUrls = {};
  
  // Generate camera stream URLs using UniFi Protect API
  $: {
    console.log('[Camera URLs Debug] Reactive block triggered');
    cameras.forEach(camera => {
      // Use UniFi Protect API through nginx proxy
      const url = `/api/protect/cameras/${camera.id}/snapshot?t=${Date.now()}`;
      console.log(`[Camera Debug] UniFi URL for ${camera.name}:`, {
        cameraId: camera.id,
        url: url
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
  
  // Auto-refresh cameras every 10 seconds
  let refreshInterval;
  
  onMount(() => {
    console.log('[Camera Debug] Component mounted with UniFi Protect integration');
    
    // Initial load of camera URLs using UniFi Protect API
    cameras.forEach(camera => {
      const url = `/api/protect/cameras/${camera.id}/snapshot?t=${Date.now()}`;
      cameraUrls[camera.id] = url;
      
      console.log(`[Camera Debug] Initial URL for ${camera.name}:`, {
        cameraId: camera.id,
        url: url
      });
      
      // Test fetch to see if we can access the camera
      fetch(url, {
        method: 'GET'
      }).then(response => {
        console.log(`[Camera Debug] Fetch test for ${camera.name}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          type: response.type,
          headers: response.headers.get('content-type')
        });
      }).catch(error => {
        console.error(`[Camera Debug] Fetch error for ${camera.name}:`, error);
      });
    });
    cameraUrls = {...cameraUrls};
    
    // Set up refresh interval
    refreshInterval = setInterval(() => {
      console.log('[Camera Debug] Refreshing camera URLs...');
      cameras.forEach(camera => {
        if (entities[camera.entity]) {
          const token = localStorage.getItem('ha_token') || '';
          cameraUrls[camera.entity] = `http://192.168.1.222:8123/api/camera_proxy/${camera.entity}?token=${token}&t=${Date.now()}`;
        }
      });
      cameraUrls = {...cameraUrls};
    }, 10000);
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
          <!-- Using UniFi Protect API directly -->
          <img 
            src={cameraUrls[camera.id] || `/api/protect/cameras/${camera.id}/snapshot`}
            alt="{camera.name} camera feed"
            class="camera-image"
            loading="lazy"
            on:load={(e) => {
              console.log(`[Camera Debug] Image loaded for ${camera.name}:`, {
                cameraId: camera.id,
                src: e.target.src,
                naturalWidth: e.target.naturalWidth,
                naturalHeight: e.target.naturalHeight
              });
            }}
            on:error={(e) => {
              console.error(`[Camera Debug] Failed to load camera ${camera.name}:`, {
                cameraId: camera.id,
                src: e.target.src,
                error: e,
                message: 'Image failed to load - check network tab for details'
              });
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"%3E%3Crect x="3" y="4" width="18" height="16" rx="2"/%3E%3Cpath d="M12 9v6M9 12h6"/%3E%3C/svg%3E';
            }}
          />
          <div class="camera-overlay">
            <span class="status-indicator streaming">LIVE</span>
          </div>
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