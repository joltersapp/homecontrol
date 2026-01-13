import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
    }
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  /**
   * Calculates optimal sprinkler duration based on weather conditions and watering history
   * @param {Object} weatherData - Current weather conditions
   * @param {number} weatherData.temperature - Current temperature in °F
   * @param {number} weatherData.humidity - Current humidity percentage
   * @param {string} weatherData.forecast - Weather forecast description
   * @param {Object} wateringHistory - Recent watering history
   * @returns {Promise<{duration: number, shouldWater: boolean, reasoning: string}>} Decision and reasoning
   */
  async calculateSprinklerDuration(weatherData, wateringHistory = {}) {
    if (!this.genAI) {
      console.error('Gemini AI not initialized - missing API key');
      return {
        duration: 15,
        reasoning: 'Default duration (API key not configured)'
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a smart irrigation system AI. Based on the following weather conditions and watering history, determine whether to water today and the optimal duration.

Weather Data:
- Temperature: ${weatherData.temperature}°F
- Humidity: ${weatherData.humidity}%
- Forecast: ${weatherData.forecast}

Watering History (Last 7 Days):
- Last Watered: ${wateringHistory.lastWatered || 'Never'}
- Days Since Last Watering: ${wateringHistory.daysSinceLastWatering ?? 'Unknown'}
- Total Minutes Last 7 Days: ${wateringHistory.totalMinutesLast7Days || 0}
- Daily History: ${JSON.stringify(wateringHistory.dailyHistory || [])}

Best Practices for Lawn Watering:
- Water 2-3 times per week maximum (not daily)
- Lawns need 1-1.5 inches total per week (roughly 60-90 minutes total across all zones)
- Deep, infrequent watering promotes stronger root development
- Wait at least 1-2 days between waterings unless extreme heat
- Skip if watered within last 24 hours unless temperature is above 95°F

Guidelines:
- Decide if watering is needed at all (shouldWater: true/false)
- Skip watering if: heavy rain forecasted, recent rain, very high humidity (>80%), temperature below 65°F, watered in last 24 hours
- Duration must be between 10-25 minutes per zone if watering
- Higher temperatures = longer watering time
- Lower humidity = longer watering time
- Light rain in forecast = reduce duration but may still water
- Consider evapotranspiration rates and watering frequency
- If total watering last 7 days > 90 minutes, be more conservative

Respond in JSON format:
{
  "shouldWater": <true or false>,
  "duration": <number between 10-25>,
  "reasoning": "<brief explanation including watering frequency and why watering or skipping>"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response');
      }

      const aiDecision = JSON.parse(jsonMatch[0]);

      // Validate duration is within range
      const duration = Math.max(10, Math.min(25, aiDecision.duration));
      const shouldWater = aiDecision.shouldWater !== undefined ? aiDecision.shouldWater : true;

      return {
        shouldWater,
        duration,
        reasoning: aiDecision.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      console.error('Gemini AI error:', error);
      // Fallback to simple logic if AI fails
      return this.fallbackCalculation(weatherData);
    }
  }

  /**
   * Calculates optimal watering time based on sunrise
   * @param {string} location - Location (e.g., "Miami, FL")
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<{hour: number, minute: number, sunrise: string, reasoning: string}>}
   */
  async getOptimalWateringTime(location = 'Miami, FL', date = null) {
    if (!this.genAI) {
      console.error('Gemini AI not initialized - using default 5:00 AM');
      return {
        hour: 5,
        minute: 0,
        sunrise: 'Unknown',
        reasoning: 'Default time (API key not configured)'
      };
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a lawn irrigation timing expert. Calculate the optimal watering time for tomorrow.

Location: ${location}
Date: ${targetDate}

Task:
1. Determine sunrise time for this location and date
2. Calculate optimal watering start time (30-60 minutes BEFORE sunrise is ideal)
3. Provide the time in 24-hour format

Best Practices:
- Water 30-60 minutes before sunrise for best absorption
- This ensures grass dries during the day (prevents fungal diseases)
- Minimizes evaporation loss
- Takes advantage of low wind conditions

Respond in JSON format:
{
  "sunrise_time": "HH:MM (e.g., 06:45)",
  "optimal_watering_hour": <0-23>,
  "optimal_watering_minute": <0-59>,
  "reasoning": "<brief explanation>"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response');
      }

      const aiResponse = JSON.parse(jsonMatch[0]);

      return {
        hour: aiResponse.optimal_watering_hour,
        minute: aiResponse.optimal_watering_minute,
        sunrise: aiResponse.sunrise_time,
        reasoning: aiResponse.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      console.error('Gemini AI error calculating watering time:', error);
      // Fallback to 5:00 AM
      return {
        hour: 5,
        minute: 0,
        sunrise: 'Unknown',
        reasoning: 'Fallback to 5:00 AM due to error'
      };
    }
  }

  /**
   * Fallback calculation if Gemini AI is unavailable
   */
  fallbackCalculation(weatherData) {
    let duration = 15; // Base duration
    let shouldWater = true;

    // Skip watering conditions
    if (weatherData.temperature < 65) {
      shouldWater = false;
      return {
        shouldWater: false,
        duration: 0,
        reasoning: `Skipping: Temperature too low (${weatherData.temperature}°F)`
      };
    }

    if (weatherData.humidity > 80) {
      shouldWater = false;
      return {
        shouldWater: false,
        duration: 0,
        reasoning: `Skipping: Humidity too high (${weatherData.humidity}%)`
      };
    }

    if (weatherData.forecast && weatherData.forecast.toLowerCase().includes('rain')) {
      shouldWater = false;
      return {
        shouldWater: false,
        duration: 0,
        reasoning: `Skipping: Rain in forecast (${weatherData.forecast})`
      };
    }

    // Adjust based on temperature
    if (weatherData.temperature > 85) {
      duration += 5;
    } else if (weatherData.temperature < 70) {
      duration -= 3;
    }

    // Adjust based on humidity
    if (weatherData.humidity < 30) {
      duration += 3;
    } else if (weatherData.humidity > 70) {
      duration -= 3;
    }

    // Clamp to valid range
    duration = Math.max(10, Math.min(25, duration));

    return {
      shouldWater: true,
      duration,
      reasoning: `Fallback calculation: Temp ${weatherData.temperature}°F, Humidity ${weatherData.humidity}%`
    };
  }
}

export const geminiService = new GeminiService();
