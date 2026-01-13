import WebSocket from 'ws';

const WS_URL = 'ws://192.168.1.222:8123/api/websocket';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkMTY4YjhmZDU1YTY0YzhkYmJhNDY3ODZkNTM1MWU5MyIsImlhdCI6MTc2MzU5MTMwMCwiZXhwIjoyMDc4OTUxMzAwfQ.Vyz4iRVr93i-LXo_6sg-nENo-TgTmrxPa1vhXDjWVLs';

const ws = new WebSocket(WS_URL);
let msgId = 1;
let deviceRegistry = [];
let entityRegistry = [];
let areaRegistry = [];

ws.on('open', () => {
  console.error('WebSocket connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'auth_required') {
    ws.send(JSON.stringify({ type: 'auth', access_token: TOKEN }));
  } else if (msg.type === 'auth_ok') {
    // Get area registry first
    ws.send(JSON.stringify({ id: msgId++, type: 'config/area_registry/list' }));
  } else if (msg.type === 'result' && msg.success) {
    if (msg.id === 1) {
      // Areas received
      areaRegistry = msg.result;
      ws.send(JSON.stringify({ id: msgId++, type: 'config/device_registry/list' }));
    } else if (msg.id === 2) {
      // Devices received
      deviceRegistry = msg.result;
      ws.send(JSON.stringify({ id: msgId++, type: 'config/entity_registry/list' }));
    } else if (msg.id === 3) {
      // Entities received
      entityRegistry = msg.result;
      processData();
      ws.close();
    }
  }
});

function processData() {
  // Create area lookup
  const areas = {};
  areaRegistry.forEach(area => {
    areas[area.area_id] = area.name;
  });

  // Create device to area lookup
  const deviceAreas = {};
  deviceRegistry.forEach(dev => {
    if (dev.area_id) {
      deviceAreas[dev.id] = dev.area_id;
    }
  });

  // Map entities to areas
  const byArea = {};
  entityRegistry.forEach(ent => {
    const eid = ent.entity_id;

    // Filter to devices we care about
    if (!eid.startsWith('light.') && !eid.startsWith('fan.') &&
        !eid.startsWith('media_player.') && !eid.startsWith('climate.') &&
        eid !== 'switch.pool_pump' && eid !== 'switch.sprinkler' &&
        !eid.startsWith('sensor.front_door') && !eid.startsWith('sensor.house_') &&
        !eid.startsWith('sensor.walkway_')) {
      return;
    }

    // Get area - either from entity or from device
    let areaId = ent.area_id;
    if (!areaId && ent.device_id) {
      areaId = deviceAreas[ent.device_id];
    }

    const areaName = areaId ? areas[areaId] : 'No Area';

    if (!byArea[areaName]) {
      byArea[areaName] = [];
    }

    byArea[areaName].push({
      entity_id: eid,
      name: ent.name || ent.original_name || ''
    });
  });

  // Print results
  Object.keys(byArea).sort().forEach(area => {
    console.log(`\n${area.toUpperCase()}:`);
    byArea[area].sort((a, b) => a.entity_id.localeCompare(b.entity_id)).forEach(ent => {
      console.log(`  ${ent.entity_id} (${ent.name})`);
    });
  });
}

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});
