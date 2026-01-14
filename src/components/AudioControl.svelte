<script>
  import { haStore } from '../stores/haStore';
  import AudioGroupingPanel from './audio/AudioGroupingPanel.svelte';
  import AudioDeviceCard from './audio/AudioDeviceCard.svelte';
  import AudioQuickActions from './audio/AudioQuickActions.svelte';

  export let entities;

  const sonosDevices = [
    {
      id: 'living_room',
      name: 'Living Room',
      player: 'media_player.living_room_sonos',
      controls: {
        bass: 'number.living_room_sonos_bass',
        treble: 'number.living_room_sonos_treble',
        nightSound: 'switch.living_room_sonos_night_sound',
        loudness: 'switch.living_room_sonos_loudness',
        subwoofer: 'switch.living_room_subwoofer_enabled',
        subGain: 'number.living_room_sub_gain',
        surroundLevel: 'number.living_room_surround_level',
        surroundEnabled: 'switch.living_room_surround_enabled',
        speechEnhancement: 'switch.living_room_speech_enhancement'
      }
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      player: 'media_player.kitchen',
      controls: {
        bass: 'number.kitchen_bass',
        treble: 'number.kitchen_treble',
        nightSound: 'switch.kitchen_night_sound',
        loudness: 'switch.kitchen_loudness',
        subwoofer: 'switch.kitchen_subwoofer_enabled'
      }
    },
    {
      id: 'master_bedroom',
      name: 'Master Bedroom',
      player: 'media_player.master_bedroom_sonos',
      controls: {
        bass: 'number.master_bedroom_sonos_bass',
        treble: 'number.master_bedroom_sonos_treble',
        nightSound: 'switch.master_bedroom_sonos_night_sound',
        loudness: 'switch.master_bedroom_sonos_loudness'
      }
    },
    {
      id: 'terrace',
      name: 'Patio',
      player: 'media_player.terrace',
      controls: {
        bass: 'number.terrace_bass',
        treble: 'number.terrace_treble',
        nightSound: 'switch.terrace_night_sound',
        loudness: 'switch.terrace_loudness'
      }
    }
  ];

  function setNumberValue(entityId, value) {
    haStore.callService('number', 'set_value', entityId, { value: parseFloat(value) });
  }

  function toggleSwitch(entityId) {
    if (!entities[entityId]) return;
    const isOn = entities[entityId].state === 'on';
    haStore.callService('switch', isOn ? 'turn_off' : 'turn_on', entityId);
  }

  function setVolume(playerId, volume) {
    haStore.callService('media_player', 'volume_set', playerId, {
      volume_level: volume / 100
    });
  }

  function toggleMediaPlayer(playerId) {
    if (!entities[playerId]) return;
    const isPlaying = entities[playerId].state === 'playing';
    haStore.callService('media_player', isPlaying ? 'media_pause' : 'media_play', playerId);
  }

  let selectedSpeakers = [];

  function getGroupedSpeakers(playerId) {
    const entity = entities[playerId];
    return entity?.attributes?.group_members || [];
  }

  function isInGroup(playerId) {
    const groupMembers = getGroupedSpeakers(playerId);
    return groupMembers.length > 1;
  }

  function joinSpeakers() {
    if (selectedSpeakers.length < 2) return;
    const master = selectedSpeakers[0];
    const members = selectedSpeakers.slice(1);
    haStore.callService('media_player', 'join', master, {
      group_members: members
    });
    selectedSpeakers = [];
  }

  function unjoinSpeaker(playerId) {
    haStore.callService('media_player', 'unjoin', playerId);
  }

  function ungroupAll(masterPlayerId) {
    const groupMembers = getGroupedSpeakers(masterPlayerId);
    groupMembers.forEach(memberId => {
      if (memberId !== masterPlayerId) {
        haStore.callService('media_player', 'unjoin', memberId);
      }
    });
  }

  function toggleSpeakerSelection(playerId) {
    if (selectedSpeakers.includes(playerId)) {
      selectedSpeakers = selectedSpeakers.filter(id => id !== playerId);
    } else {
      selectedSpeakers = [...selectedSpeakers, playerId];
    }
  }

  function handleToggleSpeaker(event) {
    toggleSpeakerSelection(event.detail.playerId);
  }

  function handleJoinSpeakers() {
    joinSpeakers();
  }

  function handleUngroupAll(event) {
    ungroupAll(event.detail.masterPlayerId);
  }

  function handleUnjoinSpeaker(event) {
    unjoinSpeaker(event.detail.playerId);
  }

  function handleTogglePlayer(event) {
    toggleMediaPlayer(event.detail.playerId);
  }

  function handleVolumeChange(event) {
    setVolume(event.detail.playerId, event.detail.volume);
  }

  function handleControlChange(event) {
    setNumberValue(event.detail.entityId, event.detail.value);
  }

  function handleToggleSwitch(event) {
    toggleSwitch(event.detail.entityId);
  }

  function handleEnableAllNightSound() {
    sonosDevices.forEach(device => {
      if (device.controls.nightSound && entities[device.controls.nightSound]) {
        haStore.callService('switch', 'turn_on', device.controls.nightSound);
      }
    });
  }

  function handleDisableAllNightSound() {
    sonosDevices.forEach(device => {
      if (device.controls.nightSound && entities[device.controls.nightSound]) {
        haStore.callService('switch', 'turn_off', device.controls.nightSound);
      }
    });
  }

  function handleResetAllEQ() {
    sonosDevices.forEach(device => {
      if (device.controls.bass && entities[device.controls.bass]) {
        setNumberValue(device.controls.bass, 0);
      }
      if (device.controls.treble && entities[device.controls.treble]) {
        setNumberValue(device.controls.treble, 0);
      }
    });
  }
</script>

<div class="audio-control">
  <h2 class="text-2xl font-light mb-8 text-gray-300 uppercase tracking-wider text-center">
    Whole Home Audio Control
  </h2>

  <AudioGroupingPanel
    {sonosDevices}
    {entities}
    {selectedSpeakers}
    {getGroupedSpeakers}
    {isInGroup}
    on:toggleSpeaker={handleToggleSpeaker}
    on:joinSpeakers={handleJoinSpeakers}
    on:ungroupAll={handleUngroupAll}
    on:unjoinSpeaker={handleUnjoinSpeaker}
  />

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {#each sonosDevices as device}
      <AudioDeviceCard
        {device}
        {entities}
        on:togglePlayer={handleTogglePlayer}
        on:volumeChange={handleVolumeChange}
        on:controlChange={handleControlChange}
        on:toggleSwitch={handleToggleSwitch}
      />
    {/each}
  </div>

  <AudioQuickActions
    on:enableAllNightSound={handleEnableAllNightSound}
    on:disableAllNightSound={handleDisableAllNightSound}
    on:resetAllEQ={handleResetAllEQ}
  />
</div>

<style>
  .audio-control {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
</style>
