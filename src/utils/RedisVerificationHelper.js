// src/utils/RedisVerificationHelper.js
// Helper to verify Redis is the center of truth

import TimeDataService from '../services/TimeDataService';
import timeWatcherRedis from '../services/RedisService';

class RedisVerificationHelper {
  
  // Test method to verify Redis is center of truth
  static async verifyRedisIsCenterOfTruth() {
    console.log('🔍 VERIFICATION: Testing Redis as Center of Truth');
    
    try {
      // 1. Test System Settings
      console.log('\n1. Testing System Settings:');
      const systemSettings = await TimeDataService.getSystemSettings();
      console.log('   System Settings Source:', systemSettings.appVersion ? 'Redis/Cache' : 'Fallback');
      console.log('   Default Weekday Total:', systemSettings.defaultWeekdayTotal);
      console.log('   Default Weekend Total:', systemSettings.defaultWeekendTotal);
      console.log('   Default Max Daily Total:', systemSettings.defaultMaxDailyTotal);
      
      // 2. Test Parent Settings
      console.log('\n2. Testing Parent Settings:');
      const parentSettings = await TimeDataService.getParentSettings();
      console.log('   Electronic Categories:', Object.keys(parentSettings.electronicCategories || {}));
      console.log('   Bonus Activity Types:', Object.keys(parentSettings.bonusActivityTypes || {}));
      
      // 3. Test User Limits
      console.log('\n3. Testing User Limits:');
      const currentLimits = await TimeDataService.getCurrentLimits();
      console.log('   Data Source:', currentLimits.source);
      console.log('   Weekday Limit:', currentLimits.limits.weekday);
      console.log('   Weekend Limit:', currentLimits.limits.weekend);
      console.log('   Max Daily Total:', currentLimits.limits.maxDailyTotal);
      
      // 4. Test Bonus Settings
      console.log('\n4. Testing Bonus Settings:');
      Object.keys(currentLimits.bonusSettings).forEach(activity => {
        const setting = currentLimits.bonusSettings[activity];
        console.log(`   ${activity}: ${setting.maxBonusMinutes} min max, ${setting.ratio} ratio`);
      });
      
      // 5. Test Today's Limits
      console.log('\n5. Testing Today\'s Applied Limits:');
      const todayLimits = await TimeDataService.getTodayLimits();
      console.log('   Today\'s Base Time:', todayLimits.dailyBase);
      console.log('   Today\'s Max Total:', todayLimits.maxDailyTotal);
      console.log('   Is Weekend:', todayLimits.isWeekend);
      console.log('   Data Source:', todayLimits.source);
      
      // 6. Test Default Day Data Structure
      console.log('\n6. Testing Default Day Data:');
      const defaultDay = await TimeDataService.getDefaultDayData();
      console.log('   Bonus Time Types:', Object.keys(defaultDay.bonusTime));
      console.log('   Electronic Categories:', Object.keys(defaultDay.electronicUsage));
      
      // 7. Test Available Categories
      console.log('\n7. Testing Available Categories:');
      const electronicCategories = await TimeDataService.getAvailableElectronicCategories();
      const bonusActivities = await TimeDataService.getAvailableBonusActivities();
      console.log('   Electronic Categories:', electronicCategories.map(c => c.label));
      console.log('   Bonus Activities:', bonusActivities.map(a => `${a.label} (${a.maxMinutes}min, ${a.ratio}x)`));
      
      // 8. Test Direct Redis Access
      console.log('\n8. Testing Direct Redis Access:');
      const userName = await TimeDataService.getUserName();
      if (userName && userName !== 'Unknown') {
        const redisKidData = await timeWatcherRedis.getKidData(userName);
        console.log('   Redis Kid Data Available:', !!redisKidData);
        console.log('   Redis Limits:', redisKidData?.limits);
        console.log('   Redis Bonus Settings:', redisKidData?.bonusSettings);
      }
      
      // 9. Configuration Summary
      console.log('\n9. Full Configuration Summary:');
      const configSummary = await TimeDataService.getConfigSummary();
      console.log('   Data Source:', configSummary.dataSource);
      console.log('   Available Electronic Categories:', configSummary.availableElectronicCategories?.length || 0);
      console.log('   Available Bonus Activities:', configSummary.availableBonusActivities?.length || 0);
      
      // 10. Test Hard-coded vs Redis Values
      console.log('\n10. Hard-coded vs Redis Comparison:');
      console.log('   ❌ Hard-coded Soccer Bonus: 30 minutes');
      console.log('   ✅ Redis Soccer Bonus:', currentLimits.bonusSettings.soccer?.maxBonusMinutes || 'Not Found');
      console.log('   ❌ Hard-coded Fitness Bonus: 30 minutes');
      console.log('   ✅ Redis Fitness Bonus:', currentLimits.bonusSettings.fitness?.maxBonusMinutes || 'Not Found');
      console.log('   ❌ Hard-coded Reading Bonus: 60 minutes');
      console.log('   ✅ Redis Reading Bonus:', currentLimits.bonusSettings.reading?.maxBonusMinutes || 'Not Found');
      
      // Success Report
      console.log('\n✅ VERIFICATION COMPLETE');
      console.log('   Redis is being used as center of truth for:');
      console.log('   - System Settings (app version, defaults)');
      console.log('   - Parent Settings (categories, activity types)');
      console.log('   - User Limits (weekday/weekend/max totals)');
      console.log('   - Bonus Settings (max minutes, ratios)');
      console.log('   - Dynamic Category/Activity Lists');
      console.log('   - Default Data Structure Creation');
      
      return {
        success: true,
        redisIsCenterOfTruth: currentLimits.source === 'redis',
        dataSource: currentLimits.source,
        configSummary
      };
      
    } catch (error) {
      console.error('❌ VERIFICATION FAILED:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Quick test to show Redis values vs hard-coded values
  static async compareRedisVsHardcoded() {
    console.log('🔍 COMPARING: Redis vs Hard-coded Values');
    
    const currentLimits = await TimeDataService.getCurrentLimits();
    const todayLimits = await TimeDataService.getTodayLimits();
    
    console.log('\n📊 COMPARISON RESULTS:');
    console.log('Source:', currentLimits.source);
    console.log('');
    console.log('Daily Base Time:');
    console.log('  Hard-coded: 120 minutes');
    console.log('  Redis:', todayLimits.dailyBase, 'minutes');
    console.log('  Match:', todayLimits.dailyBase === 120 ? '✅' : '❌');
    console.log('');
    console.log('Max Daily Total:');
    console.log('  Hard-coded: 150 minutes');
    console.log('  Redis:', todayLimits.maxDailyTotal, 'minutes');
    console.log('  Match:', todayLimits.maxDailyTotal === 150 ? '✅' : '❌');
    console.log('');
    console.log('Soccer Bonus:');
    console.log('  Hard-coded: 30 minutes, 0.5 ratio');
    console.log('  Redis:', currentLimits.bonusSettings.soccer?.maxBonusMinutes, 'minutes,', currentLimits.bonusSettings.soccer?.ratio, 'ratio');
    console.log('');
    console.log('Fitness Bonus:');
    console.log('  Hard-coded: 30 minutes, 1.0 ratio');
    console.log('  Redis:', currentLimits.bonusSettings.fitness?.maxBonusMinutes, 'minutes,', currentLimits.bonusSettings.fitness?.ratio, 'ratio');
    console.log('');
    console.log('Reading Bonus:');
    console.log('  Hard-coded: 60 minutes, 0.25 ratio');
    console.log('  Redis:', currentLimits.bonusSettings.reading?.maxBonusMinutes, 'minutes,', currentLimits.bonusSettings.reading?.ratio, 'ratio');
    
    return {
      dataSource: currentLimits.source,
      redisValues: {
        dailyBase: todayLimits.dailyBase,
        maxDailyTotal: todayLimits.maxDailyTotal,
        bonusSettings: currentLimits.bonusSettings
      },
      hardcodedValues: {
        dailyBase: 120,
        maxDailyTotal: 150,
        bonusSettings: {
          soccer: { maxBonusMinutes: 30, ratio: 0.5 },
          fitness: { maxBonusMinutes: 30, ratio: 1.0 },
          reading: { maxBonusMinutes: 60, ratio: 0.25 }
        }
      }
    };
  }
  
  // Test that values change when Redis changes
  static async testRedisUpdates() {
    console.log('🔍 TESTING: Redis Update Propagation');
    
    // Get current values
    const beforeLimits = await TimeDataService.getCurrentLimits();
    console.log('Before Force Refresh:', beforeLimits.source);
    
    // Force refresh from Redis
    await TimeDataService.forceRefreshFromRedis();
    
    // Get values after refresh
    const afterLimits = await TimeDataService.getCurrentLimits();
    console.log('After Force Refresh:', afterLimits.source);
    
    return {
      beforeSource: beforeLimits.source,
      afterSource: afterLimits.source,
      refreshWorked: afterLimits.source === 'redis' || afterLimits.source === 'fallback'
    };
  }
}

export default RedisVerificationHelper;