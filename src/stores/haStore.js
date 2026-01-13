import { writable, derived } from 'svelte/store';

function createHAStore() {
  const { subscribe, set, update } = writable({
    connected: false,
    entities: {},
    ws: null
  });

  let ws = null;
  let messageId = 1;
  let messageHandlers = {};

  const connect = () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkMTY4YjhmZDU1YTY0YzhkYmJhNDY3ODZkNTM1MWU5MyIsImlhdCI6MTc2MzU5MTMwMCwiZXhwIjoyMDc4OTUxMzAwfQ.Vyz4iRVr93i-LXo_6sg-nENo-TgTmrxPa1vhXDjWVLs';

      // Store token in localStorage for camera access (iOS Private Browsing safe)
      try {
        localStorage.setItem('ha_token', token);
        console.log('[HAStore Debug] Token stored in localStorage:', token.substring(0, 20) + '...');
      } catch (e) {
        console.warn('[HAStore Debug] localStorage not available (Private Browsing?), token stored in memory only');
      }

      // WebSocket URL for Home Assistant
      // Always connect to Home Assistant server, not the dev server
      // For local network addresses (192.168.x.x), always use ws:// (not wss://)
      // because Home Assistant on local network doesn't support secure WebSocket
      const host = '192.168.1.222'; // Home Assistant server IP
      const port = '8123';
      const protocol = 'ws:'; // Always use non-secure WebSocket for local network
      const wsUrl = `${protocol}//${host}:${port}/api/websocket`;

      console.log('[HAStore Debug] Connecting to WebSocket:', wsUrl);
      const startTime = Date.now();
      ws = new WebSocket(wsUrl);

      // Connection timeout - fail fast on iOS
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('[HAStore Debug] Connection timeout after 5s, closing and retrying');
          ws.close();
        }
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        const elapsed = Date.now() - startTime;
        console.log(`[HAStore Debug] WebSocket connected in ${elapsed}ms`);
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'auth_required') {
          ws.send(JSON.stringify({
            type: 'auth',
            access_token: token
          }));
        } else if (message.type === 'auth_ok') {
          update(state => ({ ...state, connected: true, ws }));
          
          // Subscribe to state changes
          ws.send(JSON.stringify({
            id: messageId++,
            type: 'subscribe_events',
            event_type: 'state_changed'
          }));
          
          // Get initial states
          ws.send(JSON.stringify({
            id: messageId++,
            type: 'get_states'
          }));
        } else if (message.type === 'result' && message.result && Array.isArray(message.result)) {
          // Initial states
          const entities = {};
          message.result.forEach(state => {
            entities[state.entity_id] = state;
          });
          update(state => ({ ...state, entities }));
        } else if (message.type === 'result' && message.result) {
          // Service call result - just log it
          console.log('Service call result:', message);
          // Check if there's a handler for this message ID
          if (messageHandlers[message.id]) {
            messageHandlers[message.id](message.result);
            delete messageHandlers[message.id];
          }
        } else if (message.type === 'event' && message.event.event_type === 'state_changed') {
          // State update
          const data = message.event.data;
          update(state => ({
            ...state,
            entities: {
              ...state.entities,
              [data.entity_id]: data.new_state
            }
          }));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        update(state => ({ ...state, connected: false }));
      };
      
      ws.onclose = () => {
        update(state => ({ ...state, connected: false }));
        // Reconnect after 5 seconds
        setTimeout(() => connect(), 5000);
      };
    };
    
    const callService = (domain, service, entityId, serviceData = {}) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: messageId++,
          type: 'call_service',
          domain,
          service,
          target: { entity_id: entityId },
          service_data: serviceData
        }));
      }
    };
    
    return {
      subscribe,
      connect,
      callService,
      disconnect: () => {
        if (ws) {
          ws.close();
        }
      }
    };
}

export const haStore = createHAStore();