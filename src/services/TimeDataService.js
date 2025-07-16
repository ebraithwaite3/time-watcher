// src/services/TimeDataService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
// import NotificationService from './NotificationService';

// Constants for time limits
export const TIME_LIMITS = {
  DAILY_BASE: 120,        // 120 minutes base time per day
  BONUS_SOCCER: 30,       // Up to 30 minutes bonus for soccer
  BONUS_FITNESS: 30,      // Up to 30 minutes bonus for fitness
  MAX_DAILY_TOTAL: 150,   // 120 + 30 max total bonus = 150 minutes max per day
  BONUS_RATIO: 0.5,       // 1 minute bonus for every 2 minutes activity (1/2 = 0.5)
};

// Electronic usage categories
export const ELECTRONIC_CATEGORIES = {
  TABLET: 'tablet',
  PHONE: 'phone', 
  GAMING: 'gaming',
  TV_MOVIE: 'tv_movie',
};

export const ELECTRONIC_LABELS = {
  [ELECTRONIC_CATEGORIES.TABLET]: 'Tablet',
  [ELECTRONIC_CATEGORIES.PHONE]: 'Phone',
  [ELECTRONIC_CATEGORIES.GAMING]: 'Gaming',
  [ELECTRONIC_CATEGORIES.TV_MOVIE]: 'TV/Movies',
};

// Helper function to get today's date string (YYYY-MM-DD)
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0]; // Returns "2025-07-16" format
};

// Default daily data structure
const getDefaultDayData = () => ({
  date: getTodayString(),
  baseTimeUsed: 0,           // Minutes used from base 120
  bonusTime: {
    soccer: {
      earned: 0,             // Minutes earned from soccer (0-30)
      used: 0,               // Minutes used from soccer bonus
      activityMinutes: 0,    // Total minutes spent doing soccer (unlimited tracking)
    },
    fitness: {
      earned: 0,             // Minutes earned from fitness (0-30)
      used: 0,               // Minutes used from fitness bonus
      activityMinutes: 0,    // Total minutes spent doing fitness (unlimited tracking)
    },
  },
  electronicUsage: {
    tablet: 0,               // Minutes spent on tablet
    phone: 0,                // Minutes spent on phone
    gaming: 0,               // Minutes spent gaming
    tv_movie: 0,             // Minutes spent watching TV/movies
  },
  activeSession: null,       // Current active session (if any)
  activities: [],            // Array of time tracking sessions
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Storage keys
const STORAGE_KEYS = {
  CURRENT_DAY: 'currentDayData',
  HISTORICAL_DATA: 'historicalTimeData',
};

class TimeDataService {
  
  // Get today's data (creates new day if needed)
  static async getTodayData() {
    try {
      const todayString = getTodayString();
      const storedData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_DAY);
      
      if (storedData) {
        const dayData = JSON.parse(storedData);
        
        // Check if stored data is for today
        if (dayData.date === todayString) {
          return dayData;
        } else {
          // It's a new day - archive old data and create new
          await this.archiveDay(dayData);
          const newDayData = getDefaultDayData();
          await this.saveTodayData(newDayData);
          return newDayData;
        }
      } else {
        // No data exists - create new day
        const newDayData = getDefaultDayData();
        await this.saveTodayData(newDayData);
        return newDayData;
      }
    } catch (error) {
      console.error('Error getting today data:', error);
      return getDefaultDayData();
    }
  }

  // Save today's data
  static async saveTodayData(dayData) {
    try {
      dayData.updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_DAY, JSON.stringify(dayData));
      console.log('📅 Saved today data:', dayData);
    } catch (error) {
      console.error('Error saving today data:', error);
    }
  }

  // Add activity minutes and calculate bonus time (1 minute bonus per 2 minutes activity)
  // Users can log unlimited activity time, but bonus caps at limits
  static async addActivityTime(type, minutes) {
    try {
      const dayData = await this.getTodayData();
      const maxBonus = type === 'soccer' ? TIME_LIMITS.BONUS_SOCCER : TIME_LIMITS.BONUS_FITNESS;
      
      // Add to activity minutes (unlimited tracking)
      const currentActivityMinutes = dayData.bonusTime[type].activityMinutes;
      const newActivityMinutes = currentActivityMinutes + minutes;
      
      // Calculate earned bonus (1 minute for every 2 minutes of activity)
      const potentialEarned = Math.floor(newActivityMinutes * TIME_LIMITS.BONUS_RATIO);
      
      // Check total bonus limit (can't exceed 30 total bonus across both activities)
      const currentTotalBonus = dayData.bonusTime.soccer.earned + dayData.bonusTime.fitness.earned;
      const otherBonusEarned = type === 'soccer' ? dayData.bonusTime.fitness.earned : dayData.bonusTime.soccer.earned;
      const maxAllowedForThisActivity = Math.min(maxBonus, TIME_LIMITS.BONUS_SOCCER + TIME_LIMITS.BONUS_FITNESS - otherBonusEarned);
      
      // Final earned amount (capped by individual max and total daily bonus limit)
      const newEarned = Math.min(potentialEarned, maxAllowedForThisActivity);
      const previousEarned = dayData.bonusTime[type].earned;
      
      dayData.bonusTime[type].activityMinutes = newActivityMinutes;
      dayData.bonusTime[type].earned = newEarned;
      await this.saveTodayData(dayData);
      
      return {
        success: true,
        activityMinutes: newActivityMinutes,
        earnedToday: newEarned,
        maxPossible: maxBonus,
        addedThisSession: minutes,
        bonusEarnedThisSession: newEarned - previousEarned,
        totalBonusEarned: dayData.bonusTime.soccer.earned + dayData.bonusTime.fitness.earned + (newEarned - previousEarned),
        bonusCapReached: newEarned >= maxBonus || (currentTotalBonus + (newEarned - previousEarned)) >= 30,
      };
    } catch (error) {
      console.error('Error adding activity time:', error);
      return { success: false, error: error.message };
    }
  }

  // Start an electronic session
  static async startElectronicSession(category, estimatedMinutes) {
    try {
      if (!Object.values(ELECTRONIC_CATEGORIES).includes(category)) {
        throw new Error(`Invalid electronic category: ${category}`);
      }

      const dayData = await this.getTodayData();
      const summary = await this.getTimeSummary();
      
      // Check if there's already an active session
      if (dayData.activeSession) {
        return {
          success: false,
          error: 'Session already active',
          activeSession: dayData.activeSession,
        };
      }

      // Check if user has enough time available
      if (estimatedMinutes > summary.totals.remaining) {
        return {
          success: false,
          error: 'Not enough time remaining',
          requested: estimatedMinutes,
          available: summary.totals.remaining,
        };
      }

      // Create new session
      const now = new Date();
      const endTime = new Date(now.getTime() + (estimatedMinutes * 60000));
      
      const newSession = {
        category,
        startTime: now.toISOString(),
        estimatedMinutes,
        estimatedEndTime: endTime.toISOString(),
        id: `session_${Date.now()}`,
      };

      dayData.activeSession = newSession;
      await this.saveTodayData(dayData);

      // Schedule notification for session end
      // NotificationService.scheduleSessionEndNotification(
      //   newSession.id,
      //   newSession.estimatedEndTime,
      //   ELECTRONIC_LABELS[category]
      // );

      return {
        success: true,
        session: newSession,
        estimatedEndTime: endTime,
        timeRemaining: summary.totals.remaining,
      };
    } catch (error) {
      console.error('Error starting session:', error);
      return { success: false, error: error.message };
    }
  }

  // End an electronic session and log actual usage
  static async endElectronicSession(actualMinutes = null) {
    try {
      const dayData = await this.getTodayData();
      
      if (!dayData.activeSession) {
        return {
          success: false,
          error: 'No active session to end',
        };
      }

      const session = dayData.activeSession;
      const startTime = new Date(session.startTime);
      const endTime = new Date();
      
      // Calculate actual elapsed time if not provided
      const elapsedMinutes = actualMinutes || Math.round((endTime - startTime) / 60000);
      
      // Get current summary before deducting time
      const summary = await this.getTimeSummary();
      
      // Check if user has enough time for the actual usage
      if (elapsedMinutes > summary.totals.remaining) {
        return {
          success: false,
          error: 'Not enough time remaining for actual usage',
          actualMinutes: elapsedMinutes,
          available: summary.totals.remaining,
        };
      }

      // Add to electronic usage tracking
      dayData.electronicUsage[session.category] += elapsedMinutes;

      // Deduct from available time (base time first, then bonus)
      let remainingToDeduct = elapsedMinutes;

      // First deduct from base time if available
      const baseTimeRemaining = TIME_LIMITS.DAILY_BASE - dayData.baseTimeUsed;
      if (remainingToDeduct > 0 && baseTimeRemaining > 0) {
        const deductFromBase = Math.min(remainingToDeduct, baseTimeRemaining);
        dayData.baseTimeUsed += deductFromBase;
        remainingToDeduct -= deductFromBase;
      }

      // Then deduct from bonus time if needed
      if (remainingToDeduct > 0) {
        // Deduct from soccer bonus first
        const soccerAvailable = dayData.bonusTime.soccer.earned - dayData.bonusTime.soccer.used;
        if (remainingToDeduct > 0 && soccerAvailable > 0) {
          const deductFromSoccer = Math.min(remainingToDeduct, soccerAvailable);
          dayData.bonusTime.soccer.used += deductFromSoccer;
          remainingToDeduct -= deductFromSoccer;
        }

        // Then deduct from fitness bonus if still needed
        const fitnessAvailable = dayData.bonusTime.fitness.earned - dayData.bonusTime.fitness.used;
        if (remainingToDeduct > 0 && fitnessAvailable > 0) {
          const deductFromFitness = Math.min(remainingToDeduct, fitnessAvailable);
          dayData.bonusTime.fitness.used += deductFromFitness;
          remainingToDeduct -= deductFromFitness;
        }
      }

      // Clear the active session
      const completedSession = { ...session, endTime: endTime.toISOString(), actualMinutes: elapsedMinutes };
      dayData.activeSession = null;

      // Cancel the scheduled notification since session is ending
      // NotificationService.cancelSessionNotification(session.id);

      // Add to activities history
      if (!dayData.activities) {
        dayData.activities = [];
      }
      dayData.activities.push({
        type: 'electronic',
        category: session.category,
        startTime: session.startTime,
        endTime: endTime.toISOString(),
        estimatedMinutes: session.estimatedMinutes,
        actualMinutes: elapsedMinutes,
        timestamp: endTime.toISOString(),
      });

      await this.saveTodayData(dayData);

      return {
        success: true,
        completedSession,
        actualMinutes: elapsedMinutes,
        estimatedMinutes: session.estimatedMinutes,
        difference: elapsedMinutes - session.estimatedMinutes,
        newTimeRemaining: summary.totals.remaining - elapsedMinutes,
      };
    } catch (error) {
      console.error('Error ending session:', error);
      return { success: false, error: error.message };
    }
  }

  // Get active session info
  static async getActiveSession() {
    try {
      const dayData = await this.getTodayData();
      return dayData.activeSession;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  // Cancel active session without logging time
  static async cancelActiveSession() {
    try {
      const dayData = await this.getTodayData();
      
      if (!dayData.activeSession) {
        return { success: false, error: 'No active session to cancel' };
      }

      const cancelledSession = dayData.activeSession;
      dayData.activeSession = null;
      
      // Cancel the scheduled notification
      // NotificationService.cancelSessionNotification(cancelledSession.id);
      
      await this.saveTodayData(dayData);

      return {
        success: true,
        cancelledSession,
      };
    } catch (error) {
      console.error('Error cancelling session:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current time summary
  static async getTimeSummary() {
    try {
      const dayData = await this.getTodayData();
      
      const totalBonusEarned = dayData.bonusTime.soccer.earned + dayData.bonusTime.fitness.earned;
      const totalBonusUsed = dayData.bonusTime.soccer.used + dayData.bonusTime.fitness.used;
      const totalTimeAvailable = TIME_LIMITS.DAILY_BASE + Math.min(totalBonusEarned, 30); // Cap total bonus at 30
      const totalTimeUsed = dayData.baseTimeUsed + totalBonusUsed;
      const timeRemaining = totalTimeAvailable - totalTimeUsed;

      return {
        baseTime: {
          available: TIME_LIMITS.DAILY_BASE,
          used: dayData.baseTimeUsed,
          remaining: TIME_LIMITS.DAILY_BASE - dayData.baseTimeUsed,
        },
        electronicUsage: {
          tablet: dayData.electronicUsage.tablet,
          phone: dayData.electronicUsage.phone,
          gaming: dayData.electronicUsage.gaming,
          tv_movie: dayData.electronicUsage.tv_movie,
          total: dayData.electronicUsage.tablet + dayData.electronicUsage.phone + 
                 dayData.electronicUsage.gaming + dayData.electronicUsage.tv_movie,
        },
        activeSession: dayData.activeSession,
        bonusTime: {
          soccer: {
            earned: dayData.bonusTime.soccer.earned,
            used: dayData.bonusTime.soccer.used,
            available: dayData.bonusTime.soccer.earned - dayData.bonusTime.soccer.used,
            maxPossible: TIME_LIMITS.BONUS_SOCCER,
            activityMinutes: dayData.bonusTime.soccer.activityMinutes,
          },
          fitness: {
            earned: dayData.bonusTime.fitness.earned,
            used: dayData.bonusTime.fitness.used,
            available: dayData.bonusTime.fitness.earned - dayData.bonusTime.fitness.used,
            maxPossible: TIME_LIMITS.BONUS_FITNESS,
            activityMinutes: dayData.bonusTime.fitness.activityMinutes,
          },
          totalEarned: Math.min(totalBonusEarned, 30), // Cap at 30 total bonus
        },
        totals: {
          available: totalTimeAvailable,
          used: totalTimeUsed,
          remaining: Math.max(0, timeRemaining),
        },
        date: dayData.date,
      };
    } catch (error) {
      console.error('Error getting time summary:', error);
      return null;
    }
  }

  // Archive a day's data to historical storage
  static async archiveDay(dayData) {
    try {
      const historical = await AsyncStorage.getItem(STORAGE_KEYS.HISTORICAL_DATA);
      const historicalData = historical ? JSON.parse(historical) : {};
      
      historicalData[dayData.date] = dayData;
      
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORICAL_DATA, JSON.stringify(historicalData));
      console.log(`📦 Archived data for ${dayData.date}`);
    } catch (error) {
      console.error('Error archiving day data:', error);
    }
  }

  // Get historical data for a specific date
  static async getHistoricalDay(dateString) {
    try {
      const historical = await AsyncStorage.getItem(STORAGE_KEYS.HISTORICAL_DATA);
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
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_DAY);
      await AsyncStorage.removeItem(STORAGE_KEYS.HISTORICAL_DATA);
      console.log('🗑️ Cleared all time tracking data');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }

  // Debug: Get all stored data
  static async getAllData() {
    try {
      const currentDay = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_DAY);
      const historical = await AsyncStorage.getItem(STORAGE_KEYS.HISTORICAL_DATA);
      
      return {
        currentDay: currentDay ? JSON.parse(currentDay) : null,
        historical: historical ? JSON.parse(historical) : {},
      };
    } catch (error) {
      console.error('Error getting all data:', error);
      return { currentDay: null, historical: {} };
    }
  }
}

export default TimeDataService;