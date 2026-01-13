import fetch from 'node-fetch';

class WeatherService {
  constructor() {
    this.haUrl = process.env.HA_URL || 'http://192.168.1.222:8123';
    this.haToken = process.env.HA_TOKEN;

    if (!this.haToken) {
      console.error('HA_TOKEN not found in environment variables');
    }
  }

  /**
   * Fetches current weather data from Home Assistant sensors
   * @returns {Promise<{temperature: number, humidity: number, forecast: string}>}
   */
  async getCurrentWeather() {
    if (!this.haToken) {
      console.error('Cannot fetch weather: HA_TOKEN not configured');
      return {
        temperature: 75,
        humidity: 50,
        forecast: 'Unknown (HA not configured)'
      };
    }

    try {
      // Fetch all states from Home Assistant
      const response = await fetch(`${this.haUrl}/api/states`, {
        headers: {
          'Authorization': `Bearer ${this.haToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HA API error: ${response.statusText}`);
      }

      const states = await response.json();

      // Find weather-related sensors
      // Common sensor entity IDs to look for
      const weatherData = {
        temperature: this.findSensorValue(states, [
          'sensor.outdoor_temperature',
          'sensor.outside_temperature',
          'sensor.temperature',
          'sensor.temperature_outdoor',
          'weather.home' // weather entities have temperature attribute
        ], 'temperature', 75),

        humidity: this.findSensorValue(states, [
          'sensor.outdoor_humidity',
          'sensor.outside_humidity',
          'sensor.humidity',
          'sensor.humidity_outdoor',
          'weather.home'
        ], 'humidity', 50),

        forecast: this.findWeatherForecast(states)
      };

      console.log('Weather data fetched:', weatherData);
      return weatherData;

    } catch (error) {
      console.error('Error fetching weather from HA:', error);
      // Return reasonable defaults if fetch fails
      return {
        temperature: 75,
        humidity: 50,
        forecast: 'Unavailable (API error)'
      };
    }
  }

  /**
   * Finds a sensor value from HA states
   */
  findSensorValue(states, entityIds, attribute = null, defaultValue = 0) {
    for (const entityId of entityIds) {
      const entity = states.find(s => s.entity_id === entityId);
      if (entity) {
        if (attribute && entity.attributes && entity.attributes[attribute] !== undefined) {
          return parseFloat(entity.attributes[attribute]);
        }
        if (entity.state && entity.state !== 'unavailable' && entity.state !== 'unknown') {
          return parseFloat(entity.state);
        }
      }
    }
    return defaultValue;
  }

  /**
   * Extracts weather forecast description
   */
  findWeatherForecast(states) {
    // Look for weather entity
    const weatherEntity = states.find(s =>
      s.entity_id.startsWith('weather.') &&
      s.state !== 'unavailable'
    );

    if (weatherEntity) {
      // Return the current condition as forecast
      return weatherEntity.state || 'Unknown';
    }

    // Look for forecast sensor
    const forecastSensor = states.find(s =>
      s.entity_id.includes('forecast') &&
      s.state !== 'unavailable'
    );

    if (forecastSensor) {
      return forecastSensor.state;
    }

    return 'Clear';
  }

  /**
   * Fetches specific sensor state
   */
  async getSensorState(entityId) {
    if (!this.haToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.haUrl}/api/states/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${this.haToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HA API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching sensor ${entityId}:`, error);
      return null;
    }
  }
}

export const weatherService = new WeatherService();
