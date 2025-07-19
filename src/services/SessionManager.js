// src/services/SessionManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import TimeDataCore, { getTodayString } from './TimeDataCore';
import RedisDataManager from './RedisDataManager';
import { DateTime } from 'luxon';

class SessionManager {
  // === DEFAULT DATA STRUCTURE ===

  // Create default daily data structure using Redis settings
  static async getDefaultDayData() {
    try {
      const parentSettings = await RedisDataManager.getParentSettings();
      const bonusActivityTypes = parentSettings.bonusActivityTypes || {};
      const electronicCategories = parentSettings.electronicCategories || {};

      // Create bonusTime structure based on Redis settings
      const bonusTime = {};
      Object.keys(bonusActivityTypes).forEach(activityType => {
        bonusTime[activityType] = {
          earned: 0,
          used: 0,
          activityMinutes: 0,
        };
      });

      // Create electronicUsage structure based on Redis settings
      const electronicUsage = {};
      Object.keys(electronicCategories).forEach(category => {
        electronicUsage[category] = 0;
      });

      return {
        date: getTodayString(),
        baseTimeUsed: 0,
        bonusTime,
        electronicUsage,
        activeSession: null,
        activities: [],
        createdAt: DateTime.local().toISO(),
        updatedAt: DateTime.local().toISO(),
      };
    } catch (error) {
      console.error('Error creating default day data:', error);
      // Emergency fallback
      return {
        date: getTodayString(),
        baseTimeUsed: 0,
        bonusTime: {
          soccer: { earned: 0, used: 0, activityMinutes: 0 },
          fitness: { earned: 0, used: 0, activityMinutes: 0 },
          reading: { earned: 0, used: 0, activityMinutes: 0 },
        },
        electronicUsage: {
          tablet: 0,
          phone: 0,
          playstation: 0,
          switch: 0,
          tv_movie: 0,
          computer: 0,
        },
        activeSession: null,
        activities: [],
        createdAt: DateTime.local().toISO(),
        updatedAt: DateTime.local().toISO(),
      };
    }
  }

  // === CORE DATA METHODS ===

  // Get today's data (creates new day if needed)
  static async getTodayData() {
    try {
      const todayString = getTodayString();
      const storedData = await AsyncStorage.getItem('currentDayData');

      if (storedData) {
        const dayData = JSON.parse(storedData);

        // Check if stored data is for today
        if (dayData.date === todayString) {
          return dayData;
        } else {
          // It's a new day - archive old data and create new
          await TimeDataCore.archiveDay(dayData);
          const newDayData = await SessionManager.getDefaultDayData();
          await TimeDataCore.saveTodayData(newDayData);
          return newDayData;
        }
      } else {
        // No data exists - create new day using Redis settings
        const newDayData = await SessionManager.getDefaultDayData();
        await TimeDataCore.saveTodayData(newDayData);
        return newDayData;
      }
    } catch (error) {
      console.error('Error getting today data:', error);
      return await SessionManager.getDefaultDayData();
    }
  }

  // === BONUS ACTIVITY MANAGEMENT ===

  // Add activity time using Redis settings
  static async addActivityTime(type, minutes) {
    try {
      const dayData = await SessionManager.getTodayData();
      const todayLimits = await RedisDataManager.getTodayLimits();
      const bonusConfig = todayLimits.bonusSettings[type];

      if (!bonusConfig) {
        throw new Error(
          `Invalid activity type: ${type}. Available types: ${Object.keys(
            todayLimits.bonusSettings,
          ).join(', ')}`,
        );
      }

      const maxBonus = bonusConfig.maxBonusMinutes;
      const ratio = bonusConfig.ratio;

      // Ensure the bonus activity structure exists before accessing it
      if (!dayData.bonusTime[type]) {
        dayData.bonusTime[type] = {
          earned: 0,
          used: 0,
          activityMinutes: 0,
        };
      }

      // Add to activity minutes (unlimited tracking)
      const currentActivityMinutes =
        dayData.bonusTime[type].activityMinutes || 0;
      const newActivityMinutes = currentActivityMinutes + minutes;

      // Calculate earned bonus using Redis-defined ratio
      const potentialEarned = Math.floor(newActivityMinutes * ratio);

      // Check individual bonus limit
      const individualLimit = Math.min(potentialEarned, maxBonus);

      // Check total bonus limit for ALL bonus activities (this logic might need refinement based on exact bonus rules)
      // The overall max daily total (todayLimits.maxDailyTotal) should cap the *sum* of base + bonus time.
      // Individual bonus types have their own caps (maxBonus).
      // The `newEarned` calculation here attempts to cap *this specific bonus* based on *other* bonuses,
      // which might not be the desired behavior if overall cap is handled by getTimeSummary.
      // For now, let's simplify and rely on the individual bonus type's cap (maxBonus).
      // The overall cap will be enforced when deducting time in _deductTimeFromSources
      // or when checking totalAvailable in getTimeSummary.

      const previousEarned = dayData.bonusTime[type].earned || 0;
      dayData.bonusTime[type].activityMinutes = newActivityMinutes;
      dayData.bonusTime[type].earned = individualLimit; // Cap by individual bonus max

      await TimeDataCore.saveTodayData(dayData);

      // AUTO-SYNC TO REDIS after bonus activity
      RedisDataManager.syncToRedis()
        .then(result => {
          if (result.success) {
            console.log(
              `✅ Bonus activity synced to Redis: ${type} +${minutes} minutes`,
            );
          } else {
            console.error(
              '❌ Failed to sync bonus activity to Redis:',
              result.error,
            );
          }
        })
        .catch(error => {
          console.error('❌ Auto-sync error after bonus activity:', error);
        });

      return {
        success: true,
        activityMinutes: newActivityMinutes,
        earnedToday: dayData.bonusTime[type].earned,
        maxPossible: maxBonus,
        addedThisSession: minutes,
        bonusEarnedThisSession: dayData.bonusTime[type].earned - previousEarned,
        totalBonusEarned: Object.values(dayData.bonusTime).reduce(
          (sum, bonus) => {
            return sum + (bonus ? bonus.earned : 0);
          },
          0,
        ),
        bonusCapReached: dayData.bonusTime[type].earned >= maxBonus,
        ratio: ratio,
        source: todayLimits.source,
      };
    } catch (error) {
      console.error('Error adding activity time:', error);
      return { success: false, error: error.message };
    }
  }

  // === ELECTRONIC SESSION MANAGEMENT ===

  // Start electronic session using Redis categories
  static async startElectronicSession(category, estimatedMinutes) {
    try {
      const electronicCategories =
        await RedisDataManager.getElectronicCategories();

      if (!electronicCategories[category]) {
        throw new Error(
          `Invalid electronic category: ${category}. Available categories: ${Object.keys(
            electronicCategories,
          ).join(', ')}`,
        );
      }

      const dayData = await SessionManager.getTodayData();
      const summary = await SessionManager.getTimeSummary();

      // Check if there's already an active session
      if (dayData.activeSession) {
        return {
          success: false,
          error: 'Session already active',
          activeSession: dayData.activeSession,
        };
      }

      // Keep this check: Prevent starting a session if it immediately puts them over.
      if (estimatedMinutes > summary.totals.remaining) {
        const lockoutMessage = await RedisDataManager.getAppLockoutMessage(); // Use dynamic message
        return {
          success: false,
          error: lockoutMessage, // Use dynamic message
          requested: estimatedMinutes,
          available: summary.totals.remaining,
        };
      }

      // Create new session
      const now = DateTime.local(); // Instead of new Date()
      const endTime = now.plus({ minutes: estimatedMinutes });

      const newSession = {
        category,
        startTime: now.toISO(), // Local timezone ISO string
        estimatedMinutes,
        estimatedEndTime: endTime.toISO(), // Local timezone ISO string
        id: `session_${now.toMillis()}`, // Use milliseconds for unique ID
      };

      dayData.activeSession = newSession;
      await TimeDataCore.saveTodayData(dayData);

      // AUTO-SYNC TO REDIS after starting session
      RedisDataManager.syncToRedis()
        .then(result => {
          if (result.success) {
            console.log(
              `✅ Session start synced to Redis: ${category} (${estimatedMinutes} min)`,
            );
          } else {
            console.error(
              '❌ Failed to sync session start to Redis:',
              result.error,
            );
          }
        })
        .catch(error => {
          console.error('❌ Auto-sync error after session start:', error);
        });

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

  // End electronic session with Redis-based time deduction
  static async endElectronicSession(actualMinutes = null) {
    try {
      const dayData = await SessionManager.getTodayData();

      if (!dayData.activeSession) {
        return {
          success: false,
          error: 'No active session to end',
        };
      }

      const session = dayData.activeSession;
      const startTime = DateTime.fromISO(session.startTime); // Parse as local time
      const endTime = DateTime.local(); // Current local time

      // Calculate actual elapsed time if not provided
      const elapsedMinutes =
        actualMinutes || Math.round(endTime.diff(startTime, 'minutes').minutes);

      // Get current summary and limits *before* deducting to check for overage
      const summaryBeforeDeduct = await SessionManager.getTimeSummary();
      const todayLimits = await RedisDataManager.getTodayLimits();

      // No longer return false if it goes over. We will record the overage.
      const wentOverLimit =
        elapsedMinutes > summaryBeforeDeduct.totals.remaining;

      // Add to electronic usage tracking
      dayData.electronicUsage[session.category] =
        (dayData.electronicUsage[session.category] || 0) + elapsedMinutes;

      // Deduct from available time (base time first, then bonus)
      await SessionManager._deductTimeFromSources(
        dayData,
        elapsedMinutes,
        todayLimits,
      );

      // Clear the active session
      const completedSession = {
        ...session,
        endTime: endTime.toISO(), // Local timezone ISO string
        actualMinutes: elapsedMinutes,
      };
      dayData.activeSession = null;

      // Add to activities history
      if (!dayData.activities) {
        dayData.activities = [];
      }
      dayData.activities.push({
        type: 'electronic',
        category: session.category,
        startTime: session.startTime,
        endTime: endTime.toISO(),
        estimatedMinutes: session.estimatedMinutes,
        actualMinutes: elapsedMinutes,
        timestamp: endTime.toISO(),
      });

      await TimeDataCore.saveTodayData(dayData);

      // AUTO-SYNC TO REDIS after ending session (synchronous for critical data)
      try {
        const syncResult = await RedisDataManager.syncToRedis();
        if (syncResult.success) {
          console.log(
            `✅ Session end synced to Redis: ${session.category} (${elapsedMinutes} min actual)`,
          );
        } else {
          console.error(
            '❌ Failed to sync session end to Redis:',
            syncResult.error,
          );
        }
      } catch (error) {
        console.error('❌ Auto-sync error after session end:', error);
      }

      // Get the new summary *after* deduction to reflect the updated remaining time
      const newSummary = await SessionManager.getTimeSummary();

      return {
        success: true,
        completedSession,
        actualMinutes: elapsedMinutes,
        estimatedMinutes: session.estimatedMinutes,
        difference: elapsedMinutes - session.estimatedMinutes,
        newTimeRemaining: newSummary.totals.remaining, // Use the actual new remaining time
        syncedToRedis: true,
        wentOverLimit: wentOverLimit, // Flag to indicate if this session caused an overage
        overageMinutes: wentOverLimit
          ? elapsedMinutes - summaryBeforeDeduct.totals.remaining
          : 0,
      };
    } catch (error) {
      console.error('Error ending session:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to deduct time from various sources
  static async _deductTimeFromSources(dayData, minutes, todayLimits) {
    let remainingToDeduct = minutes;

    // First deduct from base time if available
    // Ensure baseTimeUsed is initialized (it should be by getDefaultDayData)
    dayData.baseTimeUsed = dayData.baseTimeUsed || 0;

    const baseTimeRemaining = todayLimits.dailyBase - dayData.baseTimeUsed;
    if (remainingToDeduct > 0 && baseTimeRemaining > 0) {
      const deductFromBase = Math.min(remainingToDeduct, baseTimeRemaining);
      dayData.baseTimeUsed += deductFromBase;
      remainingToDeduct -= deductFromBase;
    }

    // Then deduct from bonus time in order of Redis-defined bonus activities
    const bonusActivityTypes = await RedisDataManager.getBonusActivityTypes();
    const bonusOrder = Object.keys(bonusActivityTypes);

    for (const bonusType of bonusOrder) {
      if (remainingToDeduct > 0) {
        // Ensure bonusTime[bonusType] exists and has 'earned'/'used' initialized
        dayData.bonusTime[bonusType] = dayData.bonusTime[bonusType] || {
          earned: 0,
          used: 0,
          activityMinutes: 0,
        };

        const bonusAvailable =
          (dayData.bonusTime[bonusType].earned || 0) -
          (dayData.bonusTime[bonusType].used || 0);
        if (bonusAvailable > 0) {
          const deductFromBonus = Math.min(remainingToDeduct, bonusAvailable);
          dayData.bonusTime[bonusType].used += deductFromBonus;
          remainingToDeduct -= deductFromBonus;
        }
      }
    }
    // If remainingToDeduct is still > 0 here, it means the user went over their
    // base time AND all their bonus time. We record this implicitly by the fact
    // that `baseTimeUsed` will exceed `dailyBase` or `bonusTime.used` will exceed `bonusTime.earned`.
    // The `getTimeSummary` will then correctly show a negative `remaining` time.
  }

  // Get active session info
  static async getActiveSession() {
    try {
      const dayData = await SessionManager.getTodayData();
      return dayData.activeSession;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  // Cancel active session without logging time
  static async cancelActiveSession() {
    try {
      const dayData = await SessionManager.getTodayData();

      if (!dayData.activeSession) {
        return { success: false, error: 'No active session to cancel' };
      }

      const cancelledSession = dayData.activeSession;
      dayData.activeSession = null;

      await TimeDataCore.saveTodayData(dayData);

      // AUTO-SYNC TO REDIS after cancelling session
      RedisDataManager.syncToRedis()
        .then(result => {
          if (result.success) {
            console.log(
              `✅ Session cancellation synced to Redis: ${cancelledSession.category}`,
            );
          } else {
            console.error(
              '❌ Failed to sync session cancellation to Redis:',
              result.error,
            );
          }
        })
        .catch(error => {
          console.error(
            '❌ Auto-sync error after session cancellation:',
            error,
          );
        });

      return {
        success: true,
        cancelledSession,
      };
    } catch (error) {
      console.error('Error cancelling session:', error);
      return { success: false, error: error.message };
    }
  }

  // Quick add electronic session (for already completed activities)
  static async quickAddElectronicSession(category, minutes) {
    try {
      const electronicCategories =
        await RedisDataManager.getElectronicCategories();

      if (!electronicCategories[category]) {
        throw new Error(
          `Invalid electronic category: ${category}. Available categories: ${Object.keys(
            electronicCategories,
          ).join(', ')}`,
        );
      }

      const dayData = await SessionManager.getTodayData();
      // We still get the summary here to calculate `wentOverLimit` for the return,
      // but we don't block the quick add based on `summary.totals.remaining`.
      const summaryBeforeAdd = await SessionManager.getTimeSummary();
      const todayLimits = await RedisDataManager.getTodayLimits();

      // No longer return false if it goes over. We will record the overage.
      const wentOverLimit = minutes > summaryBeforeAdd.totals.remaining;

      // Add to electronic usage tracking
      dayData.electronicUsage[category] =
        (dayData.electronicUsage[category] || 0) + minutes;

      // Deduct from available time (base time first, then bonus)
      await SessionManager._deductTimeFromSources(
        dayData,
        minutes,
        todayLimits,
      );

      // Add to activities history
      if (!dayData.activities) {
        dayData.activities = [];
      }

      const now = DateTime.local();
      const startTime = now.minus({ minutes }); // Estimate start time

      dayData.activities.push({
        type: 'electronic',
        category: category,
        startTime: startTime.toISO(),
        endTime: now.toISO(),
        estimatedMinutes: minutes,
        actualMinutes: minutes,
        timestamp: now.toISO(),
        quickAdd: true, // Mark as quick add
      });

      await TimeDataCore.saveTodayData(dayData);

      // AUTO-SYNC TO REDIS after quick add (synchronous for critical data)
      try {
        console.log(
          `🔄 Starting sync to Redis for quick add: ${category} (${minutes} min)`,
        );
        const syncResult = await RedisDataManager.syncToRedis();
        if (syncResult.success) {
          console.log(
            `✅ Quick add synced to Redis: ${category} (${minutes} min)`,
          );
        } else {
          console.error(
            '❌ Failed to sync quick add to Redis:',
            syncResult.error,
          );
        }
      } catch (error) {
        console.error('❌ Auto-sync error after quick add:', error);
      }

      // Get the new summary *after* deduction to reflect the updated remaining time
      const newSummary = await SessionManager.getTimeSummary();

      return {
        success: true,
        category,
        minutes,
        newTimeRemaining: newSummary.totals.remaining, // Use the actual new remaining time
        syncedToRedis: true,
        wentOverLimit: wentOverLimit, // Flag to indicate if this quick add caused an overage
        overageMinutes: wentOverLimit
          ? minutes - summaryBeforeAdd.totals.remaining
          : 0,
      };
    } catch (error) {
      console.error('Error quick adding session:', error);
      return { success: false, error: error.message };
    }
  }

  // === TIME SUMMARY ===

  // Get time summary using Redis settings
  static async getTimeSummary() {
    try {
      const dayData = await SessionManager.getTodayData();
      const todayLimits = await RedisDataManager.getTodayLimits();
      const bonusActivityTypes = await RedisDataManager.getBonusActivityTypes();

      // Build bonus time summary from Redis activity types
      const bonusTime = {};
      let totalBonusEarned = 0;
      let totalBonusUsed = 0;

      Object.keys(bonusActivityTypes).forEach(activityType => {
        // Ensure bonus data exists for the type in dayData
        if (!dayData.bonusTime[activityType]) {
          dayData.bonusTime[activityType] = {
            earned: 0,
            used: 0,
            activityMinutes: 0,
          };
        }
        const bonus = dayData.bonusTime[activityType] || {
          earned: 0,
          used: 0,
          activityMinutes: 0,
        };
        const config = todayLimits.bonusSettings[activityType] || {
          maxBonusMinutes: 0,
          ratio: 0,
        };

        bonusTime[activityType] = {
          earned: bonus.earned,
          used: bonus.used,
          available: bonus.earned - bonus.used,
          maxPossible: config.maxBonusMinutes,
          activityMinutes: bonus.activityMinutes,
          ratio: config.ratio,
          label: bonusActivityTypes[activityType],
        };

        totalBonusEarned += bonus.earned;
        totalBonusUsed += bonus.used;
      });

      // `maxTotalBonus` is the maximum bonus minutes that *can be earned* from all activities
      // It's `todayLimits.maxDailyTotal - todayLimits.dailyBase`
      // This implicitly limits the *sum* of bonuses to not exceed the overall daily total minus base.
      const maxTotalBonusOverall = Math.max(
        0,
        todayLimits.maxDailyTotal - todayLimits.dailyBase,
      );

      // totalBonusEarned, after being calculated from individual earned values,
      // should also be capped by maxTotalBonusOverall before being added to dailyBase.
      const cappedTotalBonusEarned = Math.min(
        totalBonusEarned,
        maxTotalBonusOverall,
      );

      const totalTimeAvailable = todayLimits.dailyBase + cappedTotalBonusEarned; // This is the total time the child *should* have
      const totalTimeUsed = dayData.baseTimeUsed + totalBonusUsed; // This is the actual time spent
      const timeRemaining = totalTimeAvailable - totalTimeUsed;

      // Build electronic usage summary from Redis categories
      const electronicCategories =
        await RedisDataManager.getElectronicCategories();
      const electronicUsage = {};
      let totalElectronicUsage = 0;

      Object.keys(electronicCategories).forEach(category => {
        const usage = dayData.electronicUsage[category] || 0;
        electronicUsage[category] = usage;
        totalElectronicUsage += usage;
      });
      electronicUsage.total = totalElectronicUsage;

      return {
        baseTime: {
          available: todayLimits.dailyBase,
          used: dayData.baseTimeUsed,
          remaining: Math.max(0, todayLimits.dailyBase - dayData.baseTimeUsed), // Base time remaining can't be negative here
        },
        electronicUsage,
        activeSession: dayData.activeSession,
        bonusTime: {
          ...bonusTime,
          totalEarned: cappedTotalBonusEarned, // This reflects the cap
          totalUsed: totalBonusUsed,
          totalAvailable: cappedTotalBonusEarned - totalBonusUsed, // Reflects capped earned minus used
          maxTotalPossible: maxTotalBonusOverall, // This is the overall cap for bonus time
        },
        totals: {
          available: totalTimeAvailable, // This is the max theoretical time
          used: totalTimeUsed, // This is the actual time used (can go over `available`)
          remaining: timeRemaining, // Can now be negative if used > available
        },
        limits: {
          dailyBase: todayLimits.dailyBase,
          maxDailyTotal: todayLimits.maxDailyTotal,
          isWeekend: todayLimits.isWeekend,
          bonusSettings: todayLimits.bonusSettings,
          source: todayLimits.source,
        },
        categories: {
          electronic: electronicCategories,
          activities: bonusActivityTypes,
        },
        date: dayData.date,
      };
    } catch (error) {
      console.error('Error getting time summary:', error);
      return null;
    }
  }
}

export default SessionManager;
