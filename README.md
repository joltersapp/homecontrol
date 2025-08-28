# HomeControl

A modern, glassmorphic dashboard for Home Assistant with real-time WebSocket connections and intuitive data pill controls.

## Features

- **Real-time Updates**: WebSocket connection for instant state changes
- **Glassmorphic Design**: Beautiful frosted glass aesthetic with blur effects
- **Data Pills**: Draggable, animated controls for all your devices
- **Climate Orb**: Interactive 3D-style temperature and humidity display
- **Media Controls**: Full Sonos integration with album art and playback controls
- **Room-based Navigation**: Quick access to controls organized by room
- **Docker Deployment**: Easy containerized deployment

## Tech Stack

- **Frontend**: Svelte with spring animations
- **Styling**: Tailwind CSS with glassmorphism effects
- **Backend**: Home Assistant WebSocket API
- **Deployment**: Docker with Nginx

## Quick Start

### Prerequisites

- Home Assistant instance running and accessible
- Docker and Docker Compose installed
- Node.js 20+ (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/joltersapp/homecontrol.git
cd homecontrol
```

2. Configure your Home Assistant connection:
```javascript
// Edit src/stores/haStore.js
const token = 'YOUR_LONG_LIVED_ACCESS_TOKEN';
const wsUrl = 'ws://YOUR_HA_IP:8123/api/websocket';
```

3. Build and run with Docker:
```bash
docker-compose up -d
```

The dashboard will be available at `http://localhost:8080`

### Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` for the development server with hot reload.

## Configuration

### Home Assistant Entities

The dashboard expects these entity patterns:
- **Climate**: `climate.walkway` (Nest thermostat)
- **Media Players**: `media_player.living_room_sonos`
- **Audio Controls**: `number.living_room_sonos_bass`, `number.living_room_sonos_treble`
- **Switches**: `switch.living_room_sonos_night_sound`, `switch.living_room_subwoofer_enabled`

Update entity IDs in `src/App.svelte` to match your Home Assistant setup.

## Features in Detail

### Data Pills
Interactive controls with drag-to-adjust functionality:
- Bass/Treble controls (-10 to +10)
- Volume control (0-100%)
- Toggle switches for night mode, subwoofer
- Real-time visual feedback with spring animations

### Climate Orb
3D-styled orb displaying:
- Current temperature and humidity
- Target temperature with +/- controls
- Animated gradient background
- Visual temperature ring indicator

### Media Control
Full media player integration:
- Play/pause/skip controls
- Volume slider
- Album artwork display
- Track and artist information
- Real-time playback status

## Docker Deployment

The application includes:
- Multi-stage Docker build for optimized image size
- Nginx for static file serving
- Health checks and auto-restart
- Port 8080 exposure (configurable in docker-compose.yml)

## Contributing

Feel free to open issues or submit pull requests. This is an active project focused on creating the best possible Home Assistant dashboard experience.

## License

MIT

## Acknowledgments

Built with Svelte, Tailwind CSS, and powered by Home Assistant's WebSocket API.