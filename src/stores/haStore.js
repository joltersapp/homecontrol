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
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI4ZGI0OGY3NGZhMzQ0ZTAyODZkMTNmZjEwYWFmZTFlOSIsImlhdCI6MTc1NTQ4MjI5MiwiZXhwIjoyMDcwODQyMjkyfQ.nDPugy3mk6SUHa0EnkQXQCFXv3sNFdPmPqrx9NA5t1c';
      const wsUrl = 'ws://192.168.1.222:8123/api/websocket';
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
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
        } else if (message.type === 'result' && message.result) {
          // Initial states
          const entities = {};
          message.result.forEach(state => {
            entities[state.entity_id] = state;
          });
          update(state => ({ ...state, entities }));
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