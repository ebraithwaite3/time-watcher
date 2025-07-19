// src/services/RedisDataManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import timeWatcherRedis from './RedisService';
import TimeDataCore, { STORAGE_KEYS, FALLBACK_DEFAULTS } from './TimeDataCore';
import { DateTime } from 'luxon';

class RedisDataManager {
  
  // === REDIS-FIRST DATA FETCHING ===
  
  // Get system settings from Redis (with local cache)
  static async getSystemSettings() {
    try {
      // Try local cache first
      const cachedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SYSTEM_SETTINGS);
      if (cachedSettings) {
        return JSON.parse(cachedSettings);
      }
      
      // Fetch from Redis
      const allData = await timeWatcherRedis.getAllData();
      const systemSettings = allData?.systemSettings;
      
      if (systemSettings) {
        // Cache it locally
        await AsyncStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(systemSettings));
        return systemSettings;
      }
      
      // Emergency fallback
      return {
        defaultWeekdayTotal: FALLBACK_DEFAULTS.DAILY_BASE,
        defaultWeekendTotal: FALLBACK_DEFAULTS.DAILY_BASE,
        defaultMaxDailyTotal: FALLBACK_DEFAULTS.MAX_DAILY_TOTAL,
        enableNotifications: true,
        dailyActivityResetTime: "00:00",
        appVersion: "1.0.0"
      };
    } catch (error) {
      console.error('Error getting system settings:', error);
      return {
        defaultWeekdayTotal: FALLBACK_DEFAULTS.DAILY_BASE,
        defaultWeekendTotal: FALLBACK_DEFAULTS.DAILY_BASE,
        defaultMaxDailyTotal: FALLBACK_DEFAULTS.MAX_DAILY_TOTAL,
        enableNotifications: true,
        dailyActivityResetTime: "00:00",
        appVersion: "1.0.0"
      };
    }
  }
  
  // Get parent settings from Redis (with local cache)
  static async getParentSettings() {
    try {
      // Try local cache first
      const cachedSettings = await AsyncStorage.getItem(STORAGE_KEYS.PARENT_SETTINGS);
      if (cachedSettings) {
        return JSON.parse(cachedSettings);
      }
      
      // Fetch from Redis
      const allData = await timeWatcherRedis.getAllData();
      const parentSettings = allData?.parentSettings;
      
      if (parentSettings) {
        // Cache it locally
        await AsyncStorage.setItem(STORAGE_KEYS.PARENT_SETTINGS, JSON.stringify(parentSettings));
        return parentSettings;
      }
      
      // Emergency fallback
      return {
        electronicCategories: FALLBACK_DEFAULTS.ELECTRONIC_CATEGORIES,
        bonusActivityTypes: FALLBACK_DEFAULTS.BONUS_ACTIVITY_TYPES
      };
    } catch (error) {
      console.error('Error getting parent settings:', error);
      return {
        electronicCategories: FALLBACK_DEFAULTS.ELECTRONIC_CATEGORIES,
        bonusActivityTypes: FALLBACK_DEFAULTS.BONUS_ACTIVITY_TYPES
      };
    }
  }
  
  // Get electronic categories from Redis
  static async getElectronicCategories() {
    const parentSettings = await RedisDataManager.getParentSettings();
    return parentSettings.electronicCategories || {};
  }
  
  // Get bonus activity types from Redis
  static async getBonusActivityTypes() {
    const parentSettings = await RedisDataManager.getParentSettings();
    return parentSettings.bonusActivityTypes || {};
  }
  
  // === REDIS-FIRST LIMITS AND SETTINGS ===
  
  // Get current user's limits from Redis (with local cache fallback)
  static async getCurrentLimits() {
    try {
      const userName = await TimeDataCore.getUserName();
      
      // Try Redis first
      const childData = await timeWatcherRedis.getChildData(userName);
      
      if (childData?.limits && childData?.bonusSettings) {
        // Cache the data locally for offline access
        await AsyncStorage.setItem(STORAGE_KEYS.LIMITS, JSON.stringify(childData.limits));
        await AsyncStorage.setItem(STORAGE_KEYS.BONUS_SETTINGS, JSON.stringify(childData.bonusSettings));
        
        return {
          limits: childData.limits,
          bonusSettings: childData.bonusSettings,
          source: 'redis'
        };
      }
      
      // Fall back to local cache
      const limitsData = await AsyncStorage.getItem(STORAGE_KEYS.LIMITS);
      const bonusData = await AsyncStorage.getItem(STORAGE_KEYS.BONUS_SETTINGS);
      
      if (limitsData && bonusData) {
        return {
          limits: JSON.parse(limitsData),
          bonusSettings: JSON.parse(bonusData),
          source: 'cache'
        };
      }
      
      // Emergency fallback using system defaults
      const systemSettings = await RedisDataManager.getSystemSettings();
      return {
        limits: {
          weekday: systemSettings.defaultWeekdayTotal,
          weekend: systemSettings.defaultWeekendTotal,
          maxDailyTotal: systemSettings.defaultMaxDailyTotal
        },
        bonusSettings: {
          soccer: { maxBonusMinutes: 30, ratio: 0.5 },
          fitness: { maxBonusMinutes: 30, ratio: 1.0 },
          reading: { maxBonusMinutes: 60, ratio: 0.25 }
        },
        source: 'fallback'
      };
    } catch (error) {
      console.error('Error getting current limits:', error);
      const systemSettings = await RedisDataManager.getSystemSettings();
      return {
        limits: {
          weekday: systemSettings.defaultWeekdayTotal,
          weekend: systemSettings.defaultWeekendTotal,
          maxDailyTotal: systemSettings.defaultMaxDailyTotal
        },
        bonusSettings: {
          soccer: { maxBonusMinutes: 30, ratio: 0.5 },
          fitness: { maxBonusMinutes: 30, ratio: 1.0 },
          reading: { maxBonusMinutes: 60, ratio: 0.25 }
        },
        source: 'fallback'
      };
    }
  }
  
  // Get today's applicable limits (weekday vs weekend)
  static async getTodayLimits() {
    try {
      const currentLimits = await RedisDataManager.getCurrentLimits();
      const today = DateTime.local();
      const isWeekend = today.weekday === 6 || today.weekday === 7;
      
      return {
        dailyBase: isWeekend ? currentLimits.limits.weekend : currentLimits.limits.weekday,
        maxDailyTotal: currentLimits.limits.maxDailyTotal,
        bonusSettings: currentLimits.bonusSettings,
        isWeekend,
        source: currentLimits.source
      };
    } catch (error) {
      console.error('Error getting today limits:', error);
      const systemSettings = await RedisDataManager.getSystemSettings();
      return {
        dailyBase: systemSettings.defaultWeekdayTotal,
        maxDailyTotal: systemSettings.defaultMaxDailyTotal,
        bonusSettings: {
          soccer: { maxBonusMinutes: 30, ratio: 0.5 },
          fitness: { maxBonusMinutes: 30, ratio: 1.0 },
          reading: { maxBonusMinutes: 60, ratio: 0.25 }
        },
        isWeekend: false,
        source: 'fallback'
      };
    }
  }
  
  // === REDIS SYNC METHODS ===
  
  // Force refresh from Redis (clears local cache)
  static async forceRefreshFromRedis() {
    try {
      // Clear local cache
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.LIMITS,
        STORAGE_KEYS.BONUS_SETTINGS,
        STORAGE_KEYS.SYSTEM_SETTINGS,
        STORAGE_KEYS.PARENT_SETTINGS
      ]);
      
      console.log('🔄 Cleared local cache, will fetch fresh from Redis');
      return { success: true, message: 'Cache cleared, fresh data will be fetched' };
    } catch (error) {
      console.error('Error forcing refresh from Redis:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Sync local data to Redis
  static async syncToRedis() {
    try {
      const userName = await TimeDataCore.getUserName();
      const localData = await TimeDataCore.getAllData();
      const result = await timeWatcherRedis.syncChildDataToRedis(userName, localData);
      console.log(`📤 Synced ${userName} data to Redis`);
      return result;
    } catch (error) {
      console.error('Error syncing to Redis:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Sync from Redis (for parent updates)
  static async syncFromRedis(password) {
    try {
      const userName = await TimeDataCore.getUserName();
      const redisData = await timeWatcherRedis.syncChildDataFromRedis(userName, password);
      
      if (!redisData) {
        return { success: false, error: 'Invalid password' };
      }
      
      // Update local data with Redis data
      if (redisData.todayData) {
        await TimeDataCore.saveTodayData(redisData.todayData);
      }
      
      if (redisData.historicalData) {
        await AsyncStorage.setItem(STORAGE_KEYS.HISTORICAL_DATA, JSON.stringify(redisData.historicalData));
      }

      if (redisData.limits) {
        await AsyncStorage.setItem(STORAGE_KEYS.LIMITS, JSON.stringify(redisData.limits));
      }

      if (redisData.bonusSettings) {
        await AsyncStorage.setItem(STORAGE_KEYS.BONUS_SETTINGS, JSON.stringify(redisData.bonusSettings));
      }
      
      // Force refresh system and parent settings
      await RedisDataManager.forceRefreshFromRedis();
      
      console.log(`📥 Synced ${userName} data from Redis`);
      return { 
        success: true, 
        message: 'Data synced from Redis',
        updatedLimits: redisData.limits,
        updatedBonusSettings: redisData.bonusSettings
      };
    } catch (error) {
      console.error('Error syncing from Redis:', error);
      return { success: false, error: error.message };
    }
  }
}

export default RedisDataManager;