<script>
  export let jobs = [];
  export let title = "Job History";
  export let jobType = "pool"; // "pool", "sprinkler", "ai-analysis"
  export let maxHeight = "400px";

  function formatJobTime(job) {
    // Handle AI decisions with just a date field (YYYY-MM-DD)
    const timestamp = job.date || job.start_time;
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    // For AI decisions (date only), don't show time
    if (job.date && jobType === 'sprinkler-ai') {
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }

    // For jobs with timestamps, show time
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  }

  function formatDuration(minutes) {
    if (!minutes) return '-';
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function getBadgeInfo(job) {
    // Handle AI decision data (from ai_decisions table)
    if (jobType === 'sprinkler-ai') {
      const shouldWater = job.should_water === 1;
      return {
        text: shouldWater ? 'AUTO-WATER' : 'SKIPPED',
        color: shouldWater ? 'green' : 'gray'
      };
    }

    if (job.device === 'Sprinkler AI Analysis') {
      return {
        text: 'AI ANALYSIS',
        color: 'purple'
      };
    } else if (job.device === 'Sprinkler' && job.session) {
      return {
        text: job.session.toUpperCase(),
        color: 'green'
      };
    } else if (job.device === 'Pool Pump') {
      return {
        text: job.session?.toUpperCase() || 'MANUAL',
        color: 'cyan'
      };
    }
    return {
      text: 'MANUAL',
      color: 'cyan'
    };
  }

  function getConditionsDisplay(job) {
    // Handle AI decision data (from ai_decisions table)
    if (jobType === 'sprinkler-ai') {
      return {
        type: 'ai-decision',
        text: job.reasoning || 'No reasoning provided'
      };
    }

    if (job.device === 'Sprinkler AI Analysis') {
      return {
        type: 'ai-decision',
        text: job.conditions?.aiDecision || 'No analysis available'
      };
    } else if (job.device === 'Sprinkler') {
      return {
        type: 'ai-decision',
        text: job.conditions?.aiDecision || ''
      };
    } else if (job.device === 'Pool Pump' && job.conditions?.temperature) {
      return {
        type: 'temperature',
        text: `${job.conditions.temperature}°F`
      };
    }
    return null;
  }
</script>

<div class="job-report">
  <h4 class="job-report-title">{title}</h4>
  <div class="job-table-container" style="max-height: {maxHeight}">
    <div class="job-table">
      {#each jobs as job}
        {@const badge = getBadgeInfo(job)}
        {@const conditions = getConditionsDisplay(job)}
        <div class="job-row">
          <div class="job-session">
            <span class="job-label" class:cyan={badge.color === 'cyan'} class:green={badge.color === 'green'} class:purple={badge.color === 'purple'} class:gray={badge.color === 'gray'}>
              {badge.text}
            </span>
          </div>
          <div class="job-time">
            <span class="job-date">{formatJobTime(job)}</span>
            {#if job.device !== 'Sprinkler AI Analysis' && jobType !== 'sprinkler-ai'}
              <span class="job-duration">{formatDuration(job.duration)}</span>
            {:else if jobType === 'sprinkler-ai' && job.should_water === 1}
              <span class="job-duration">{job.duration}min/zone</span>
            {/if}
          </div>
          {#if conditions && conditions.type === 'temperature'}
            <div class="job-conditions">
              <span class="job-temp">{conditions.text}</span>
            </div>
          {/if}
          {#if conditions && conditions.type === 'ai-decision' && conditions.text}
            <div class="job-ai-reason">
              <span class="job-reason-text">{conditions.text}</span>
            </div>
          {/if}
        </div>
      {/each}
      {#if jobs.length === 0}
        <div class="job-row no-jobs">
          <span class="no-jobs-text">No job history available</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .job-report {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .job-report-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .job-table-container {
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }

  /* Custom scrollbar styling */
  .job-table-container::-webkit-scrollbar {
    width: 6px;
  }

  .job-table-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
  }

  .job-table-container::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.3);
    border-radius: 10px;
  }

  .job-table-container::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 212, 255, 0.5);
  }

  .job-table {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .job-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .job-row.no-jobs {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .no-jobs-text {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .job-session {
    display: flex;
    align-items: center;
  }

  .job-label {
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
  }

  .job-label.cyan {
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .job-label.green {
    color: #00ff88;
    background: rgba(0, 255, 136, 0.1);
  }

  .job-label.purple {
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
  }

  .job-label.gray {
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.05);
  }

  .job-time {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .job-date {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .job-duration {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .job-conditions {
    text-align: right;
  }

  .job-temp {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .job-ai-reason {
    grid-column: 2 / -1;
    margin-top: 0.5rem;
    padding-top: 0.625rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .job-reason-text {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    line-height: 1.4;
  }
</style>
