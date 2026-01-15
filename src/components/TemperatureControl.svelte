<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TemperatureStatusCards from './temperature/TemperatureStatusCards.svelte';
  import TemperatureControls from './temperature/TemperatureControls.svelte';
  import TemperatureGraph from './temperature/TemperatureGraph.svelte';
  import AdjustmentHistoryList from './temperature/AdjustmentHistoryList.svelte';
  import AnalyticsModal from './temperature/AnalyticsModal.svelte';

  export let entities;

  // Current temperature data from Home Assistant
  $: officeSensor = entities?.['sensor.walkway_temperature'];
  $: thermostat = entities?.['climate.walkway'];
  $: currentTemp = parseFloat(officeSensor?.state) || 0;
  $: hallwayTemp = parseFloat(thermostat?.attributes?.current_temperature) || 0;
  $: currentSetpoint = thermostat?.attributes?.temperature || 0;

  // Automation status
  let automationStatus = {
    enabled: false,
    targetTemp: 73,
    threshold: 1.5,
    adjustmentStep: 1,
    minSetpoint: 68,
    maxSetpoint: 78,
    lastAdjustment: null,
    officeSensor: '',
    thermostat: ''
  };

  // Temperature history for graph
  let temperatureHistory = [];
  let adjustmentHistory = [];
  let refreshInterval = null;

  // Feedback state
  let feedbackMessage = '';
  let feedbackTimeout = null;

  // Analytics modal state
  let showAnalytics = false;
  let analytics = {
    feedbackSummary: { tooHot: 0, tooCold: 0, total: 0 },
    recentFeedback: [],
    recentAdjustments: [],
    detailedFeedback: []
  };

  // Load status and history on mount
  onMount(async () => {
    await loadStatus();
    await loadAdjustmentHistory();

    // Refresh status every 30 seconds
    refreshInterval = setInterval(async () => {
      await loadStatus();
      await loadAdjustmentHistory();
    }, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadStatus() {
    try {
      const result = await api.getTemperatureStatus();
      automationStatus = result;
    } catch (error) {
      console.error('Failed to load temperature status:', error);
    }
  }

  async function loadAdjustmentHistory() {
    try {
      const result = await api.getTemperatureHistory(30);
      adjustmentHistory = result.jobs || [];

      // Build temperature history from adjustments and monitoring logs
      temperatureHistory = adjustmentHistory
        .filter(job => job.conditions)
        .map(job => {
          try {
            const conditions = typeof job.conditions === 'string'
              ? JSON.parse(job.conditions)
              : job.conditions;

            // Handle both adjustment logs and monitoring logs
            const oldSetpoint = conditions.oldSetpoint !== undefined
              ? parseFloat(conditions.oldSetpoint)
              : parseFloat(conditions.setpoint);
            const newSetpoint = conditions.newSetpoint !== undefined
              ? parseFloat(conditions.newSetpoint)
              : parseFloat(conditions.setpoint);

            // Parse timestamp as local time (database stores local time)
            // Format: "2026-01-13 11:32:31"
            console.log('Raw start_time:', job.start_time);

            // Parse manually to ensure it's interpreted as local time, not UTC
            const [datePart, timePart] = job.start_time.split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute, second] = timePart.split(':').map(Number);
            const timestamp = new Date(year, month - 1, day, hour, minute, second);

            console.log('Parsed timestamp:', timestamp.toString(), 'ISO:', timestamp.toISOString());

            return {
              timestamp,
              officeTemp: parseFloat(conditions.officeTemp),
              targetTemp: parseFloat(conditions.targetTemp),
              oldSetpoint,
              newSetpoint,
              action: conditions.action || 'monitoring'
            };
          } catch (e) {
            return null;
          }
        })
        .filter(item => item !== null && !isNaN(item.officeTemp))
        .reverse(); // Most recent first

    } catch (error) {
      console.error('Failed to load temperature history:', error);
    }
  }

  async function toggleAutomation() {
    try {
      const result = await api.toggleTemperatureAutomation();
      automationStatus = result;
      console.log('Temperature automation toggled:', result.enabled);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  }

  async function handleSetTarget(event) {
    const newTargetTemp = event.detail.temp;
    try {
      await api.setTargetTemperature(newTargetTemp);
      await loadStatus();
      console.log('Target temperature set to:', newTargetTemp);
    } catch (error) {
      console.error('Failed to set target temperature:', error);
    }
  }

  async function handleSubmitFeedback(event) {
    const feedbackType = event.detail.type;
    try {
      await api.submitTemperatureFeedback(feedbackType);

      // Show confirmation message
      feedbackMessage = feedbackType === 'too_hot' ? 'Feedback recorded: Too Hot' : 'Feedback recorded: Too Cold';

      // Clear previous timeout if exists
      if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
      }

      // Auto-hide message after 3 seconds
      feedbackTimeout = setTimeout(() => {
        feedbackMessage = '';
      }, 3000);

      console.log('Feedback submitted:', feedbackType);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      feedbackMessage = 'Error submitting feedback';

      if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
      }

      feedbackTimeout = setTimeout(() => {
        feedbackMessage = '';
      }, 3000);
    }
  }

  async function loadAnalytics() {
    try {
      const result = await api.getTemperatureAnalytics();
      analytics = result.analytics;
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  async function toggleAnalytics() {
    showAnalytics = !showAnalytics;
    if (showAnalytics) {
      await loadAnalytics();
    }
  }
</script>

<div class="temperature-control">
  <TemperatureStatusCards
    {currentTemp}
    {hallwayTemp}
    targetTemp={automationStatus.targetTemp}
    {currentSetpoint}
    automationEnabled={automationStatus.enabled}
    lastAdjustment={automationStatus.lastAdjustment}
  />

  <TemperatureControls
    automationEnabled={automationStatus.enabled}
    targetTemp={automationStatus.targetTemp}
    {feedbackMessage}
    on:toggleAutomation={toggleAutomation}
    on:setTarget={handleSetTarget}
    on:submitFeedback={handleSubmitFeedback}
    on:toggleAnalytics={toggleAnalytics}
  />

  <TemperatureGraph {temperatureHistory} />

  <AdjustmentHistoryList {adjustmentHistory} />

  <AnalyticsModal
    show={showAnalytics}
    {analytics}
    on:close={toggleAnalytics}
  />
</div>

<style>
  .temperature-control {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .temperature-control {
      padding: 1rem;
    }
  }
</style>
