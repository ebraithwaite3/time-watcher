// src/services/TimeDataService.js
import TimeDataCore, { FALLBACK_DEFAULTS } from './TimeDataCore';
import RedisDataManager from './RedisDataManager';
import SessionManager from './SessionManager';
import { DateTime } from 'luxon';

class TimeDataService {
  
  // === COMPATIBILITY LAYER FOR LEGACY CODE ===
  static get ELECTRONIC_CATEGORIES() {
    return {
      TABLET: 'tablet',
      PHONE: 'phone',
      PLAYSTATION: 'playstation',
      SWITCH: 'switch',
      TV_MOVIE: 'tv_movie',
      COMPUTER: 'computer',
    };
  }

  static get ELECTRONIC_LABELS() {
    return {
      tablet: 'Tablet',
      phone: 'Phone',
      playstation: 'PlayStation',
      switch: 'Switch',
      tv_movie: 'TV/Movies',
      computer: 'Computer',
    };
  }

  static get TIME_LIMITS() {
    return {
      DAILY_BASE: FALLBACK_DEFAULTS.DAILY_BASE,
      MAX_DAILY_TOTAL: FALLBACK_DEFAULTS.MAX_DAILY_TOTAL,
      BONUS_RATIO: FALLBACK_DEFAULTS.BONUS_RATIO,
      BONUS_SOCCER: 30,
      BONUS_FITNESS: 30,
      BONUS_READING: 60,
    };
  }
  
  // === USERNAME MANAGEMENT ===
  static async setUserName(userName) {
    return await TimeDataCore.setUserName(userName);
  }
  
  static async getUserName() {
    return await TimeDataCore.getUserName();
  }
  
  // === REDIS DATA METHODS ===
  static async getSystemSettings() {
    return await RedisDataManager.getSystemSettings();
  }
  
  static async getParentSettings() {
    return await RedisDataManager.getParentSettings();
  }
  
  static async getElectronicCategories() {
    return await RedisDataManager.getElectronicCategories();
  }
  
  static async getBonusActivityTypes() {
    return await RedisDataManager.getBonusActivityTypes();
  }
  
  static async getCurrentLimits() {
    return await RedisDataManager.getCurrentLimits();
  }
  
  static async getTodayLimits() {
    return await RedisDataManager.getTodayLimits();
  }
  
  static async forceRefreshFromRedis() {
    return await RedisDataManager.forceRefreshFromRedis();
  }
  
  static async syncToRedis() {
    return await RedisDataManager.syncToRedis();
  }
  
  static async syncFromRedis(password) {
    return await RedisDataManager.syncFromRedis(password);
  }
  
  // === CORE DATA METHODS ===
  static async getTodayData() {
    return await SessionManager.getTodayData();
  }

  static async saveTodayData(dayData) {
    return await TimeDataCore.saveTodayData(dayData);
  }

  static async archiveDay(dayData) {
    return await TimeDataCore.archiveDay(dayData);
  }

  static async getHistoricalDay(dateString) {
    return await TimeDataCore.getHistoricalDay(dateString);
  }

  static async clearAllData() {
    return await TimeDataCore.clearAllData();
  }

  static async getAllData() {
    return await TimeDataCore.getAllData();
  }

  // === SESSION MANAGEMENT ===
  static async addActivityTime(type, minutes) {
    console.log(`🎯 TimeDataService: Delegating addActivityTime to SessionManager: ${type}, ${minutes} min`);
    return await SessionManager.addActivityTime(type, minutes);
  }

  static async startElectronicSession(category, estimatedMinutes) {
    console.log(`🎯 TimeDataService: Delegating startElectronicSession to SessionManager: ${category}, ${estimatedMinutes} min`);
    return await SessionManager.startElectronicSession(category, estimatedMinutes);
  }

  static async endElectronicSession(actualMinutes = null) {
    console.log(`🎯 TimeDataService: Delegating endElectronicSession to SessionManager: ${actualMinutes} min`);
    return await SessionManager.endElectronicSession(actualMinutes);
  }

  static async getActiveSession() {
    return await SessionManager.getActiveSession();
  }

  static async cancelActiveSession() {
    console.log(`🎯 TimeDataService: Delegating cancelActiveSession to SessionManager`);
    return await SessionManager.cancelActiveSession();
  }

  static async quickAddElectronicSession(category, minutes) {
    console.log(`🎯 TimeDataService: Delegating quickAddElectronicSession to SessionManager: ${category}, ${minutes} min`);
    return await SessionManager.quickAddElectronicSession(category, minutes);
  }

  static async getTimeSummary() {
    return await SessionManager.getTimeSummary();
  }

  // === UPDATE METHODS WITH AUTO-SYNC ===

  // Update electronic session time by timestamp
  static async updateElectronicSessionTime(timestamp, newMinutes) {
    try {
      const data = await SessionManager.getTodayData();
      
      // Find the activity by timestamp
      const activityIndex = data.activities.findIndex(
        activity => activity.timestamp === timestamp && activity.type === 'electronic'
      );
      
      if (activityIndex === -1) {
        throw new Error('Electronic session not found');
      }
      
      const activity = data.activities[activityIndex];
      const oldMinutes = activity.actualMinutes;
      const timeDifference = newMinutes - oldMinutes;
      
      // Update the activity
      data.activities[activityIndex].actualMinutes = newMinutes;
      
      // Update the base time used (adjust for the difference)
      data.baseTimeUsed = Math.max(0, data.baseTimeUsed + timeDifference);
      
      // Update timestamp
      data.updatedAt = DateTime.local().toISO();
      
      // Save the updated data
      await TimeDataCore.saveTodayData(data);
      
      // 🔄 AUTO-SYNC TO REDIS after updating session time
      RedisDataManager.syncToRedis().then(result => {
        if (result.success) {
          console.log(`✅ Session time update synced to Redis: ${activity.category} (${oldMinutes} → ${newMinutes} min)`);
        } else {
          console.error('❌ Failed to sync session time update to Redis:', result.error);
        }
      }).catch(error => {
        console.error('❌ Auto-sync error after session time update:', error);
      });
      
      return data;
    } catch (error) {
      console.error('Error updating electronic session time:', error);
      throw error;
    }
  }
  
  // Update bonus activity time using Redis settings
  static async updateBonusActivityTime(category, newActivityMinutes) {
    try {
      const data = await SessionManager.getTodayData();
      const todayLimits = await RedisDataManager.getTodayLimits();
      
      if (!data.bonusTime[category]) {
        throw new Error(`Invalid bonus category: ${category}`);
      }
      
      const bonusConfig = todayLimits.bonusSettings[category];
      if (!bonusConfig) {
        throw new Error(`No bonus configuration found for category: ${category}`);
      }
      
      const oldActivityMinutes = data.bonusTime[category].activityMinutes;
      
      // Calculate new bonus earned using Redis-defined ratio and limits
      const newBonusEarned = Math.min(
        Math.floor(newActivityMinutes * bonusConfig.ratio), 
        bonusConfig.maxBonusMinutes
      );
      
      // Update the bonus time data
      data.bonusTime[category].activityMinutes = newActivityMinutes;
      data.bonusTime[category].earned = newBonusEarned;
      
      // Update timestamp
      data.updatedAt = DateTime.local().toISO();
      
      // Save the updated data
      await TimeDataCore.saveTodayData(data);
      
      // 🔄 AUTO-SYNC TO REDIS after updating bonus activity time
      RedisDataManager.syncToRedis().then(result => {
        if (result.success) {
          console.log(`✅ Bonus activity time update synced to Redis: ${category} (${oldActivityMinutes} → ${newActivityMinutes} min)`);
        } else {
          console.error('❌ Failed to sync bonus activity time update to Redis:', result.error);
        }
      }).catch(error => {
        console.error('❌ Auto-sync error after bonus activity time update:', error);
      });
      
      return data;
    } catch (error) {
      console.error('Error updating bonus activity time:', error);
      throw error;
    }
  }
  
  // Helper method to recalculate all time totals using Redis settings
  static async recalculateTimeTotals() {
    try {
      const data = await SessionManager.getTodayData();
      const todayLimits = await RedisDataManager.getTodayLimits();
      
      // Recalculate base time used from all electronic activities
      let totalBaseTime = 0;
      if (data.activities && data.activities.length > 0) {
        data.activities.forEach(activity => {
          if (activity.type === 'electronic') {
            totalBaseTime += activity.actualMinutes;
          }
        });
      }
      
      data.baseTimeUsed = totalBaseTime;
      
      // Recalculate bonus earnings for all activity types using Redis settings
      Object.keys(data.bonusTime).forEach(category => {
        const activityMinutes = data.bonusTime[category].activityMinutes;
        const bonusConfig = todayLimits.bonusSettings[category];
        
        if (bonusConfig) {
          data.bonusTime[category].earned = Math.min(
            Math.floor(activityMinutes * bonusConfig.ratio), 
            bonusConfig.maxBonusMinutes
          );
        }
      });
      
      // Update timestamp
      data.updatedAt = DateTime.local().toISO();
      
      // Save the updated data
      await TimeDataCore.saveTodayData(data);
      
      // 🔄 AUTO-SYNC TO REDIS after recalculating totals
      RedisDataManager.syncToRedis().then(result => {
        if (result.success) {
          console.log(`✅ Recalculated totals synced to Redis`);
        } else {
          console.error('❌ Failed to sync recalculated totals to Redis:', result.error);
        }
      }).catch(error => {
        console.error('❌ Auto-sync error after recalculating totals:', error);
      });
      
      return data;
    } catch (error) {
      console.error('Error recalculating time totals:', error);
      throw error;
    }
  }

  // === CONVENIENCE METHODS ===
  
  // Get available electronic categories with labels
  static async getAvailableElectronicCategories() {
    try {
      const categories = await RedisDataManager.getElectronicCategories();
      return Object.keys(categories).map(key => ({
        id: key,
        label: categories[key],
        value: key
      }));
    } catch (error) {
      console.error('Error getting available electronic categories:', error);
      return [];
    }
  }
  
  // Get available bonus activity types with labels
  static async getAvailableBonusActivities() {
    try {
      const activities = await RedisDataManager.getBonusActivityTypes();
      const bonusSettings = await RedisDataManager.getCurrentLimits();
      
      return Object.keys(activities).map(key => ({
        id: key,
        label: activities[key],
        value: key,
        maxMinutes: bonusSettings.bonusSettings[key]?.maxBonusMinutes || 0,
        ratio: bonusSettings.bonusSettings[key]?.ratio || 0
      }));
    } catch (error) {
      console.error('Error getting available bonus activities:', error);
      return [];
    }
  }
  
  // Validate if a category/activity exists in Redis
  static async validateCategory(type, category) {
    try {
      if (type === 'electronic') {
        const categories = await RedisDataManager.getElectronicCategories();
        return categories.hasOwnProperty(category);
      } else if (type === 'bonus') {
        const activities = await RedisDataManager.getBonusActivityTypes();
        return activities.hasOwnProperty(category);
      }
      return false;
    } catch (error) {
      console.error('Error validating category:', error);
      return false;
    }
  }
  
  // Get current configuration summary (for debugging)
  static async getConfigSummary() {
    try {
      const systemSettings = await RedisDataManager.getSystemSettings();
      const parentSettings = await RedisDataManager.getParentSettings();
      const todayLimits = await RedisDataManager.getTodayLimits();
      
      return {
        systemSettings,
        parentSettings,
        todayLimits,
        electronicCategories: await RedisDataManager.getElectronicCategories(),
        bonusActivityTypes: await RedisDataManager.getBonusActivityTypes(),
        availableElectronicCategories: await TimeDataService.getAvailableElectronicCategories(),
        availableBonusActivities: await TimeDataService.getAvailableBonusActivities(),
        dataSource: todayLimits.source,
        timestamp: DateTime.local().toISO()
      };
    } catch (error) {
      console.error('Error getting config summary:', error);
      return { error: error.message };
    }
  }
}

// Export backward compatibility constants
export const ELECTRONIC_CATEGORIES = TimeDataService.ELECTRONIC_CATEGORIES;
export const ELECTRONIC_LABELS = TimeDataService.ELECTRONIC_LABELS;
export const TIME_LIMITS = TimeDataService.TIME_LIMITS;

export default TimeDataService;