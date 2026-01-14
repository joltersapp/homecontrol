<script>
  export let temperatureHistory = [];

  $: graphPath = generateGraphPath(temperatureHistory);

  function generateGraphPath(history) {
    if (history.length < 2) return { office: '', target: '', setpoint: '', timestamps: [] };

    const width = 600;
    const height = 200;
    const padding = 40;

    // Find min/max temps for scaling
    const allTemps = history.flatMap(h => [h.officeTemp, h.targetTemp, h.newSetpoint]);
    const minTemp = Math.min(...allTemps) - 2;
    const maxTemp = Math.max(...allTemps) + 2;

    const xScale = (width - 2 * padding) / (history.length - 1);
    const yScale = (height - 2 * padding) / (maxTemp - minTemp);

    // Generate paths
    const officePath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.officeTemp - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    const targetPath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.targetTemp - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    const setpointPath = history.map((h, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (h.newSetpoint - minTemp) * yScale;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    }).join(' ');

    // Generate timestamp labels (show every 3rd point or start/end)
    const timestamps = history.map((h, i) => {
      const x = padding + i * xScale;
      const showLabel = i === 0 || i === history.length - 1 || i % 3 === 0;
      if (!showLabel) return null;

      const date = new Date(h.timestamp);
      const label = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return { x, label };
    }).filter(t => t !== null);

    return { office: officePath, target: targetPath, setpoint: setpointPath, minTemp, maxTemp, timestamps };
  }
</script>

{#if temperatureHistory.length > 1}
<div class="graph-container mb-8">
  <h3 class="text-lg font-light text-gray-300 uppercase tracking-wider mb-4">
    Temperature History
  </h3>
  <div class="graph-wrapper">
    <svg viewBox="0 0 600 220" class="temp-graph">
      <!-- Grid lines -->
      <line x1="40" y1="40" x2="560" y2="40" stroke="rgba(0, 212, 255, 0.15)" stroke-width="1" />
      <line x1="40" y1="100" x2="560" y2="100" stroke="rgba(0, 212, 255, 0.1)" stroke-width="1" />
      <line x1="40" y1="160" x2="560" y2="160" stroke="rgba(0, 212, 255, 0.15)" stroke-width="1" />

      <!-- Target line (dashed) -->
      {#if graphPath.target}
        <path d={graphPath.target} fill="none" stroke="#00d4ff" stroke-width="2.5" stroke-dasharray="6,4" opacity="0.6" />
      {/if}

      <!-- Setpoint line -->
      {#if graphPath.setpoint}
        <path d={graphPath.setpoint} fill="none" stroke="#fbbf24" stroke-width="2.5" opacity="0.9" />
      {/if}

      <!-- Office temp line -->
      {#if graphPath.office}
        <path d={graphPath.office} fill="none" stroke="#00ff88" stroke-width="3" style="filter: drop-shadow(0 0 4px rgba(0, 255, 136, 0.5));" />
      {/if}

      <!-- Y-axis labels -->
      <text x="10" y="45" fill="rgba(0, 212, 255, 0.7)" font-size="11" font-family="sans-serif">{graphPath.maxTemp?.toFixed(0)}°</text>
      <text x="10" y="165" fill="rgba(0, 212, 255, 0.7)" font-size="11" font-family="sans-serif">{graphPath.minTemp?.toFixed(0)}°</text>

      <!-- X-axis timestamps -->
      {#if graphPath.timestamps}
        {#each graphPath.timestamps as timestamp}
          <text
            x={timestamp.x}
            y="190"
            fill="rgba(0, 212, 255, 0.6)"
            font-size="9"
            font-family="sans-serif"
            text-anchor="middle"
          >
            {timestamp.label}
          </text>
        {/each}
      {/if}
    </svg>

    <!-- Legend -->
    <div class="graph-legend">
      <div class="legend-item">
        <div class="legend-color" style="background: #00ff88;"></div>
        <span>Office Temp</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #fbbf24;"></div>
        <span>Thermostat Setpoint</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #00d4ff; opacity: 0.5;"></div>
        <span>Target (73°F)</span>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .graph-container {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .graph-wrapper {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 1rem;
  }

  .temp-graph {
    width: 100%;
    height: auto;
  }

  .graph-legend {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .legend-color {
    width: 20px;
    height: 3px;
    border-radius: 2px;
  }
</style>
