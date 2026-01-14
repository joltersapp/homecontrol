<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let memberName;
  export let isMaster = false;

  function handleRemove() {
    dispatch('remove');
  }
</script>

<div class="group-member {isMaster ? 'master' : ''}">
  <span class="member-name">{memberName}</span>
  {#if isMaster}
    <span class="master-badge">MASTER</span>
  {:else}
    <button class="remove-member" on:click={handleRemove}>×</button>
  {/if}
</div>

<style>
  .group-member {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 8px;
    color: rgba(0, 212, 255, 0.9);
    font-size: 0.875rem;
  }

  .group-member.master {
    background: rgba(0, 255, 136, 0.1);
    border-color: rgba(0, 255, 136, 0.3);
    color: rgba(0, 255, 136, 0.9);
  }

  .member-name {
    flex: 1;
  }

  .master-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.5rem;
    background: rgba(0, 255, 136, 0.2);
    border: 1px solid rgba(0, 255, 136, 0.3);
    border-radius: 4px;
    color: rgba(0, 255, 136, 1);
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .remove-member {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid rgba(255, 100, 100, 0.3);
    border-radius: 4px;
    color: rgba(255, 100, 100, 0.9);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .remove-member:hover {
    background: rgba(255, 100, 100, 0.3);
    border-color: rgba(255, 100, 100, 0.5);
    transform: scale(1.1);
  }
</style>
