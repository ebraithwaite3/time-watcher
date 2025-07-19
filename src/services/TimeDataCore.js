// src/services/TimeDataCore.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTime } from 'luxon';
import timeWatcherRedis from './RedisService';

// Storage keys
export const STORAGE_KEYS = {
  CURRENT_DAY: 'currentDayData',
  HISTORICAL_DATA: 'historicalTimeData',
  USER_NAME: 'userName',
  LIMITS: 'limits',
  BONUS_SETTINGS: 'bonusSettings',
  SYSTEM_SETTINGS: 'systemSettings',
  PARENT_SETTINGS: 'parentSettings',
};

// Helper function to get today's date string (YYYY-MM-DD)
export const getTodayString = () => {
  return DateTime.local().toISODate();
};

// Helper function to check if it's a new day (for data archiving)
export const isNewDay = lastDate => {
  if (!lastDate) return true;

  const today = getTodayString();
  return today !== lastDate;
};

// Helper function to get current timestamp in local timezone
export const getCurrentTimestamp = () => {
  return DateTime.local().toISO(); // Returns ISO string with local timezone
};

// FALLBACK DEFAULTS
export const FALLBACK_DEFAULTS = {
  DAILY_BASE: 120,
  MAX_DAILY_TOTAL: 150,
  BONUS_RATIO: 0.5,
  ELECTRONIC_CATEGORIES: {
    tablet: 'Tablet',
    phone: 'Phone',
    playstation: 'PlayStation',
    switch: 'Switch',
    tv_movie: 'TV/Movies',
    computer: 'Computer',
  },
  BONUS_ACTIVITY_TYPES: {
    soccer: 'Soccer Practice',
    fitness: 'Physical Activity',
    reading: 'Reading Time',
  },
};

class TimeDataCore {
  // === USERNAME MANAGEMENT ===

  static async setUserName(userName) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, userName);
      console.log(`👤 Username set to: ${userName}`);
    } catch (error) {
      console.error('Error setting username:', error);
    }
  }

  static async getUserName() {
    try {
      const userName = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
      return userName || 'Unknown';
    } catch (error) {
      console.error('Error getting username:', error);
      return 'Unknown';
    }
  }

  // === BASIC DATA OPERATIONS ===

  // Save today's data
  static async saveTodayData(dayData) {
    try {
      dayData.updatedAt = getCurrentTimestamp();
      await AsyncStorage.setItem(
        STORAGE_KEYS.CURRENT_DAY,
        JSON.stringify(dayData),
      );
      console.log('📅 Saved today data');
    } catch (error) {
      console.error('Error saving today data:', error);
    }
  }

  // Archive a day's data to historical storage
  static async archiveDay(dayData) {
    try {
      const historical = await AsyncStorage.getItem(
        STORAGE_KEYS.HISTORICAL_DATA,
      );
      const historicalData = historical ? JSON.parse(historical) : {};

      historicalData[dayData.date] = dayData;

      await AsyncStorage.setItem(
        STORAGE_KEYS.HISTORICAL_DATA,
        JSON.stringify(historicalData),
      );
      console.log(`📦 Archived data for ${dayData.date}`);
    } catch (error) {
      console.error('Error archiving day data:', error);
    }
  }

  // Get historical data for a specific date
  static async getHistoricalDay(dateString) {
    try {
      const historical = await AsyncStorage.getItem(
        STORAGE_KEYS.HISTORICAL_DATA,
      );
      const historicalData = historical ? JSON.parse(historical) : {};
      return historicalData[dateString] || null;
    } catch (error) {
      console.error('Error getting historical data:', error);
      return null;
    }
  }

  // Debug: Clear all data (for testing)
  static async clearAllData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CURRENT_DAY,
        STORAGE_KEYS.HISTORICAL_DATA,
        STORAGE_KEYS.LIMITS,
        STORAGE_KEYS.BONUS_SETTINGS,
        STORAGE_KEYS.SYSTEM_SETTINGS,
        STORAGE_KEYS.PARENT_SETTINGS,
      ]);
      console.log('🗑️ Cleared all time tracking data');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }

  // Debug: Get all stored data
  static async getAllData() {
    try {
      const currentDay = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_DAY);
      const historical = await AsyncStorage.getItem(
        STORAGE_KEYS.HISTORICAL_DATA,
      );
      const limits = await AsyncStorage.getItem(STORAGE_KEYS.LIMITS);
      const bonusSettings = await AsyncStorage.getItem(
        STORAGE_KEYS.BONUS_SETTINGS,
      );

      return {
        currentDay: currentDay ? JSON.parse(currentDay) : null,
        historical: historical ? JSON.parse(historical) : {},
        limits: limits ? JSON.parse(limits) : null,
        bonusSettings: bonusSettings ? JSON.parse(bonusSettings) : null,
      };
    } catch (error) {
      console.error('Error getting all data:', error);
      return {
        currentDay: null,
        historical: {},
        limits: null,
        bonusSettings: null,
      };
    }
  }
}

export default TimeDataCore;
