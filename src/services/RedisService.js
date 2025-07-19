import { DateTime } from 'luxon';
// Clean Redis service - prevents double encoding
class TimeWatcherRedisService {
  constructor() {
    this.restUrl = 'https://sweeping-pipefish-10800.upstash.io';
    this.token = 'ASowAAIjcDE3MDhjOGFiZTk5ZGM0ZWNhYmQ4NDY1ZDZiMmQ3OTQ4ZHAxMA';
    this.cacheKey = 'TIME_WATCHER';
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 500;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Clean GET - handles Upstash response format properly
   */
  async get(key) {
    try {
      const response = await fetch(`${this.restUrl}/get/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Upstash returns { result: "value" } or { result: null }
      if (data.result === null) return null;
      
      // The result should now be a simple JSON string
      const result = data.result;
      
      // If it's a string, parse it as JSON
      if (typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch (parseError) {
          console.log('Failed to parse JSON:', parseError);
          return result;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Redis GET error:', error);
      throw error;
    }
  }

  /**
   * Clean SET - avoids double encoding
   */
  async set(key, value) {
    try {
      // Always stringify objects, keep strings as-is
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Don't wrap in array - send directly as string
      const response = await fetch(`${this.restUrl}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: stringValue, // Send as plain string, not JSON array
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Redis SET error:', error);
      throw error;
    }
  }

  /**
   * DELETE key
   */
  async delete(key) {
    try {
      const response = await fetch(`${this.restUrl}/del/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Redis DEL error:', error);
      throw error;
    }
  }

  /**
   * EXISTS check
   */
  async exists(key) {
    try {
      const response = await fetch(`${this.restUrl}/exists/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * PING test
   */
  async ping() {
    try {
      const response = await fetch(`${this.restUrl}/ping`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Redis PING error:', error);
      throw error;
    }
  }

  // === SIMPLIFIED CORE FUNCTIONS ===

  /**
   * Get all data
   */
  async getAllData() {
    try {
      return await this.get(this.cacheKey);
    } catch (error) {
      console.error('Error getting all data:', error);
      return null;
    }
  }

  /**
   * Get child's data by username
   */
  async getChildData(userName) {
    try {
      const allData = await this.getAllData();
      return allData?.[userName] || null;
    } catch (error) {
      console.error(`Error getting ${userName} data:`, error);
      return null;
    }
  }

  /**
   * Get kid's data (legacy alias for backward compatibility)
   */
  async getKidData(userName) {
    return await this.getChildData(userName);
  }

  /**
   * Set all data
   */
  async setAllData(data) {
    try {
      const result = await this.set(this.cacheKey, data);
      return {
        success: true,
        message: "Data successfully saved to Redis"
      };
    } catch (error) {
      console.error('Error setting all data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync child data TO Redis (upload local data to server)
   */
  async syncChildDataToRedis(userName, localData) {
    try {
      console.log(`📤 Syncing ${userName} data to Redis:`, localData);
      
      // Get current Redis data
      const allData = await this.getAllData() || {};
      
      // Ensure child object exists
      if (!allData[userName]) {
        allData[userName] = {
          profile: { name: userName, deviceId: `${userName.toLowerCase()}_device_001` },
          limits: { weekday: 120, weekend: 120, maxDailyTotal: 150 },
          bonusSettings: {
            soccer: { maxBonusMinutes: 30, ratio: 0.5 },
            fitness: { maxBonusMinutes: 30, ratio: 1.0 },
            reading: { maxBonusMinutes: 60, ratio: 0.25 }
          },
          historicalData: {},
          createdAt: DateTime.local().toISO()
        };
      }
      
      // Update with local data
      if (localData.currentDay) {
        allData[userName].todayData = localData.currentDay;
      }
      
      if (localData.historical) {
        allData[userName].historicalData = { ...allData[userName].historicalData, ...localData.historical };
      }
      
      // Update timestamp
      allData[userName].updatedAt = DateTime.local().toISO();
      
      // Save back to Redis
      const result = await this.setAllData(allData);
      
      if (result.success) {
        console.log(`✅ Successfully synced ${userName} data to Redis`);
        return {
          success: true,
          message: `${userName} data synced to Redis`,
          timestamp: DateTime.local().toISO()
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`❌ Error syncing ${userName} data to Redis:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  async syncKidDataToRedis(userName, localData) {
    return await this.syncChildDataToRedis(userName, localData);
  }

  /**
   * Sync child data FROM Redis (download server data to local) - with password protection
   */
  async syncChildDataFromRedis(userName, password) {
    try {
      const allData = await this.getAllData();
      
      if (!allData?.parentSettings?.syncPassword) {
        throw new Error('No sync password set');
      }
      
      if (allData.parentSettings.syncPassword !== password) {
        console.log('Incorrect sync password');
        return null;
      }
      
      const childData = allData[userName];
      if (!childData) {
        console.log(`No data found for ${userName}`);
        return null;
      }
      
      console.log(`✅ Sync successful for ${userName}`);
      return {
        todayData: childData.todayData,
        historicalData: childData.historicalData || {},
        limits: childData.limits,
        bonusSettings: childData.bonusSettings
      };
    } catch (error) {
      console.error(`Error syncing ${userName} data from Redis:`, error);
      throw error;
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  async syncKidDataFromRedis(userName, password) {
    return await this.syncChildDataFromRedis(userName, password);
  }

  /**
   * Initialize with clean test data
   */
  async initializeCleanData() {
    try {
      // Clear existing data first
      await this.delete(this.cacheKey);
      
      // Create clean test data matching your current structure
      const cleanData = {
        Jack: {
          profile: { name: "Jack", deviceId: "jack_device_001" },
          limits: { weekday: 120, weekend: 120, maxDailyTotal: 150 },
          bonusSettings: {
            soccer: { maxBonusMinutes: 30, ratio: 0.5 },
            fitness: { maxBonusMinutes: 30, ratio: 1.0 },
            reading: { maxBonusMinutes: 60, ratio: 0.25 }
          },
          todayData: null,
          historicalData: {},
          createdAt: DateTime.local().toISO()
        },
        Ellie: {
          profile: { name: "Ellie", deviceId: "ellie_device_001" },
          limits: { weekday: 120, weekend: 120, maxDailyTotal: 150 },
          bonusSettings: {
            soccer: { maxBonusMinutes: 30, ratio: 0.5 },
            fitness: { maxBonusMinutes: 30, ratio: 1.0 },
            reading: { maxBonusMinutes: 60, ratio: 0.25 }
          },
          todayData: null,
          historicalData: {},
          createdAt: DateTime.local().toISO()
        },
        parentSettings: {
          syncPassword: "P@rent",
          lastParentUpdate: DateTime.local().toISO(),
          familyName: "TimeWatcher Family",
          timezone: "America/New_York",
          electronicCategories: {
            tablet: "Tablet",
            phone: "Phone",
            playstation: "PlayStation",
            switch: "Switch",
            tv_movie: "TV/Movies",
            computer: "Computer"
          },
          bonusActivityTypes: {
            soccer: "Soccer Practice",
            fitness: "Physical Activity",
            reading: "Reading Time"
          },
          appLockoutMessage: "Time's up! Please ask a parent for more time."
        },
        systemSettings: {
          appVersion: "1.0.0",
          dailyActivityResetTime: "00:00",
          defaultWeekdayTotal: 120,
          defaultWeekendTotal: 120,
          defaultMaxDailyTotal: 150,
          enableNotifications: true
        }
      };

      return await this.setAllData(cleanData);
    } catch (error) {
      console.error('Error initializing clean data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const result = await this.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Update child settings (limits and bonus configurations)
   */
  async updateChildSettings(userName, limits, bonusSettings) {
    try {
      const allData = await this.getAllData() || {};
      
      if (!allData[userName]) {
        allData[userName] = {
          profile: { name: userName, deviceId: `${userName.toLowerCase()}_device_001` },
          historicalData: {},
          createdAt: DateTime.local().toISO()
        };
      }
      
      if (limits) allData[userName].limits = limits;
      if (bonusSettings) allData[userName].bonusSettings = bonusSettings;
      
      // Update parent timestamp
      if (!allData.parentSettings) {
        allData.parentSettings = {};
      }
      allData.parentSettings.lastParentUpdate = DateTime.local().toISO();
      
      return await this.setAllData(allData);
    } catch (error) {
      console.error(`Error updating ${userName} settings:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  async updateKidSettings(userName, limits, bonusSettings) {
    return await this.updateChildSettings(userName, limits, bonusSettings);
  }

  /**
   * Update child's today data
   */
  async updateChildTodayData(userName, todayData) {
    try {
      const allData = await this.getAllData() || {};
      
      if (!allData[userName]) {
        console.warn(`Child ${userName} not found in Redis`);
        return { success: false, error: 'Child not found' };
      }
      
      allData[userName].todayData = todayData;
      allData[userName].updatedAt = DateTime.local().toISO();
      
      return await this.setAllData(allData);
    } catch (error) {
      console.error(`Error updating ${userName} today data:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  async updateKidTodayData(userName, todayData) {
    return await this.updateChildTodayData(userName, todayData);
  }

  /**
   * Archive child's historical data
   */
  async archiveChildHistoricalData(userName, dateString, dayData) {
    try {
      const allData = await this.getAllData() || {};
      
      if (!allData[userName]) {
        console.warn(`Child ${userName} not found in Redis`);
        return { success: false, error: 'Child not found' };
      }
      
      if (!allData[userName].historicalData) {
        allData[userName].historicalData = {};
      }
      
      allData[userName].historicalData[dateString] = dayData;
      allData[userName].updatedAt = DateTime.local().toISO();
      
      return await this.setAllData(allData);
    } catch (error) {
      console.error(`Error archiving ${userName} historical data:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  async archiveKidHistoricalData(userName, dateString, dayData) {
    return await this.archiveChildHistoricalData(userName, dateString, dayData);
  }

  async disconnect() {
    console.log('HTTP Redis service - no connection to close');
  }
}

// Export singleton
const timeWatcherRedis = new TimeWatcherRedisService();
export default timeWatcherRedis;