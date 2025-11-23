const API_BASE = import.meta.env.PROD
  ? '/api'  // Production: same origin
  : 'http://localhost:3001/api';  // Development: API server

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Job endpoints
  async createJob(device, session = null, conditions = {}) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify({ device, session, conditions }),
    });
  }

  async endJob(jobId) {
    return this.request(`/jobs/${jobId}`, {
      method: 'PUT',
    });
  }

  async getJobs(device, limit = 20) {
    return this.request(`/jobs/${device}?limit=${limit}`);
  }

  async getActiveJob(device) {
    return this.request(`/jobs/${device}/active`);
  }

  // Schedule endpoints
  async getSchedule(device) {
    return this.request(`/schedules/${device}`);
  }

  async saveSchedule(device, config) {
    return this.request(`/schedules/${device}`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  }
}

export const api = new APIClient();
