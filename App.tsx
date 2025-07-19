// App.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTime } from 'luxon';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PastDaysScreen from './src/screens/PastDaysScreen';
import ParentDashboard from './src/screens/ParentDashboard';
import Header from './src/components/Header';
import timeWatcherRedis from './src/services/RedisService';
import TimeDataService from './src/services/TimeDataService';
// import NotificationService from './src/services/NotificationService';

// Main App Component (wrapped in ThemeProvider)
const AppContent = () => {
  const { theme } = useTheme();
  const [userName, setUserName] = useState('');
  const [isParent, setIsParent] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' or 'pastDays'
  const [isLoading, setIsLoading] = useState(true);
  const [redisStatus, setRedisStatus] = useState('unknown'); // 'connected', 'cached', 'error'
  const [dataSource, setDataSource] = useState('unknown'); // 'redis', 'cache', 'fallback'
  const [refreshKey, setRefreshKey] = useState(0); // 🔧 ADD: Force component refresh

  // AsyncStorage Debug Helper
  const debugStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const values = await AsyncStorage.multiGet(keys);
      console.log('📱 AsyncStorage Contents:', Object.fromEntries(values));
    } catch (error) {
      console.error('Error reading AsyncStorage:', error);
    }
  };

  // Check Redis connection status
  const checkRedisConnection = async () => {
    try {
      const allData = await timeWatcherRedis.getAllData();
      if (allData && allData.systemSettings) {
        setRedisStatus('connected');
        return true;
      } else {
        setRedisStatus('error');
        return false;
      }
    } catch (error) {
      console.error('Redis connection check failed:', error);
      setRedisStatus('error');
      return false;
    }
  };

  // 🔧 FIX: Function to update ALL legacy storage keys (moved outside)
  const updateLegacyStorageKeys = async (finalData, userName) => {
    console.log('🔄 Updating legacy storage keys for:', userName);
    console.log('🔍 finalData[userName] exists:', !!finalData[userName]);
    console.log('🔍 finalData[userName].todayData exists:', !!finalData[userName]?.todayData);
    
    if (finalData[userName] && finalData[userName].todayData) {
      console.log('📝 About to update currentDayData with:', {
        baseTimeUsed: finalData[userName].todayData.baseTimeUsed,
        activitiesCount: finalData[userName].todayData.activities?.length
      });
      await AsyncStorage.setItem('currentDayData', JSON.stringify(finalData[userName].todayData));
      console.log('✅ Updated currentDayData for TimeDataService');
      
      // Verify it was saved
      const verification = await AsyncStorage.getItem('currentDayData');
      const parsed = JSON.parse(verification);
      console.log('🔍 Verification - currentDayData now has baseTimeUsed:', parsed.baseTimeUsed);
    } else {
      console.log('❌ Cannot update currentDayData - missing data structure');
    }
    
    if (finalData[userName] && finalData[userName].historicalData) {
      await AsyncStorage.setItem('historicalTimeData', JSON.stringify(finalData[userName].historicalData));
      console.log('✅ Updated historicalTimeData for TimeDataService');
    }
    
    // Update other legacy keys if they exist in Redis data
    if (finalData[userName] && finalData[userName].limits) {
      await AsyncStorage.setItem('limits', JSON.stringify(finalData[userName].limits));
      console.log('✅ Updated limits for TimeDataService');
    }
    
    if (finalData[userName] && finalData[userName].bonusSettings) {
      await AsyncStorage.setItem('bonusSettings', JSON.stringify(finalData[userName].bonusSettings));
      console.log('✅ Updated bonusSettings for TimeDataService');
    }
  };

  // Smart sync function that pulls from Redis first, then merges intelligently
  const smartSyncWithRedis = async (userName) => {
    try {
      console.log('🔄 === CHILD APP SMART SYNC ===');
      console.log('👤 Child:', userName);
      
      // STEP 1: Get local data
      const localAllAppData = await AsyncStorage.getItem('allAppData');
      let localData = localAllAppData ? JSON.parse(localAllAppData) : null;
      console.log('📱 Local data loaded:', !!localData);
      
      // STEP 2: Get Redis data FIRST
      let redisData = null;
      try {
        redisData = await timeWatcherRedis.getAllData();
        console.log('☁️ Redis data loaded:', !!redisData);
      } catch (redisError) {
        console.log('⚠️ Redis fetch failed:', redisError);
        // If Redis fails, use local data only
        if (localData) {
          console.log('📱 Using local data only (Redis unavailable)');
          return { success: true, source: 'local' };
        } else {
          throw new Error('No local or Redis data available');
        }
      }
      
      // STEP 3: Intelligent merge strategy
      let finalData;
      
      if (!localData && redisData) {
        // No local data, use Redis data
        console.log('☁️ Using Redis data (no local data)');
        finalData = redisData;
      } else if (localData && !redisData) {
        // No Redis data, use local data
        console.log('📱 Using local data (no Redis data)');
        finalData = localData;
      } else if (localData && redisData) {
        // SMART MERGE: Both exist - merge intelligently
        console.log('🔄 Merging local and Redis data...');
        finalData = await smartMergeData(localData, redisData, userName);
      } else {
        throw new Error('No data available from any source');
      }
      
      // STEP 4: Save merged data locally
      await AsyncStorage.setItem('allAppData', JSON.stringify(finalData));
      console.log('💾 Merged data saved locally');
      
      // STEP 5: Only sync back to Redis if we made meaningful local changes
      const hasLocalChanges = await checkForLocalChanges(localData, redisData, userName);
      if (hasLocalChanges) {
        console.log('📤 Syncing local changes back to Redis...');
        await timeWatcherRedis.setAllData(finalData);
      } else {
        console.log('✅ No local changes to sync back');
      }
      
      console.log('✅ === SMART SYNC COMPLETED ===');
      return { success: true, source: 'merged' };
      
    } catch (error) {
      console.error('❌ Smart sync error:', error);
      return { success: false, error: error.message };
    }
  };

  // Smart merge function that preserves parent actions
  const smartMergeData = async (localData, redisData, userName) => {
    console.log('🧠 Smart merging data for:', userName);
    
    // Start with Redis data as base (preserves parent actions)
    const merged = JSON.parse(JSON.stringify(redisData));
    
    // Get today's date
    const todayString = DateTime.local().toISODate();
    
    // Focus on the current child's data
    if (localData[userName] && redisData[userName]) {
      const localChild = localData[userName];
      const redisChild = redisData[userName];
      
      console.log('🔍 Comparing child data...');
      console.log('📱 Local todayData:', {
        exists: !!localChild.todayData,
        baseTimeUsed: localChild.todayData?.baseTimeUsed,
        activitiesCount: localChild.todayData?.activities?.length
      });
      console.log('☁️ Redis todayData:', {
        exists: !!redisChild.todayData,
        baseTimeUsed: redisChild.todayData?.baseTimeUsed,
        activitiesCount: redisChild.todayData?.activities?.length
      });
      
      // CRITICAL: Check for parent actions in Redis that aren't in local
      const redisParentActions = redisChild.todayData?.activities?.filter(a => 
        a.type === 'parent_action' || a.addedByParent
      ) || [];
      
      const localParentActions = localChild.todayData?.activities?.filter(a => 
        a.type === 'parent_action' || a.addedByParent
      ) || [];
      
      console.log('⚠️ Parent actions - Redis:', redisParentActions.length, 'Local:', localParentActions.length);
      console.log('🔍 Redis parent actions:', redisParentActions.map(a => ({ action: a.action, timestamp: a.timestamp, minutes: a.minutes })));
      console.log('🔍 Local parent actions:', localParentActions.map(a => ({ action: a.action, timestamp: a.timestamp, minutes: a.minutes })));
      console.log('🔍 Redis baseTimeUsed:', redisChild.todayData?.baseTimeUsed);
      console.log('🔍 Local baseTimeUsed:', localChild.todayData?.baseTimeUsed);
      
      // 🔧 FIX: Compare by timestamp, not just count
      let hasNewParentActions = false;
      
      if (redisParentActions.length > localParentActions.length) {
        hasNewParentActions = true;
        console.log('🚨 Redis has MORE parent actions than local');
      } else if (redisParentActions.length === localParentActions.length && redisParentActions.length > 0) {
        // Same count, but check if timestamps are different (newer actions)
        const redisLatestTimestamp = Math.max(...redisParentActions.map(a => new Date(a.timestamp).getTime()));
        const localLatestTimestamp = localParentActions.length > 0 
          ? Math.max(...localParentActions.map(a => new Date(a.timestamp).getTime()))
          : 0;
        
        console.log('🔍 Redis latest timestamp:', new Date(redisLatestTimestamp).toISOString());
        console.log('🔍 Local latest timestamp:', new Date(localLatestTimestamp).toISOString());
        
        if (redisLatestTimestamp > localLatestTimestamp) {
          hasNewParentActions = true;
          console.log('🚨 Redis has NEWER parent actions than local');
        }
      }
      
      // Also check if Redis baseTimeUsed is different from local
      if (redisChild.todayData?.baseTimeUsed !== localChild.todayData?.baseTimeUsed) {
        hasNewParentActions = true;
        console.log(`🚨 Redis baseTimeUsed (${redisChild.todayData?.baseTimeUsed}) differs from local (${localChild.todayData?.baseTimeUsed})`);
      }
      
      if (hasNewParentActions) {
        console.log('🚨 FOUND NEW PARENT ACTIONS IN REDIS - PRESERVING');
        
        // Redis has parent actions that local doesn't - use Redis as base
        merged[userName] = JSON.parse(JSON.stringify(redisChild));
        
        // But merge in any newer local electronic activities
        if (localChild.todayData?.activities) {
          const localElectronicActivities = localChild.todayData.activities.filter(a => 
            a.type === 'electronic' && !a.addedByParent
          );
          
          // Add local electronic activities that aren't in Redis
          localElectronicActivities.forEach(localActivity => {
            const existsInRedis = merged[userName].todayData.activities.some(redisActivity => 
              redisActivity.timestamp === localActivity.timestamp
            );
            
            if (!existsInRedis) {
              console.log('➕ Adding local electronic activity to Redis data');
              merged[userName].todayData.activities.push(localActivity);
              
              // Update time usage accordingly
              merged[userName].todayData.baseTimeUsed += localActivity.actualMinutes;
              if (localActivity.category) {
                merged[userName].todayData.electronicUsage[localActivity.category] = 
                  (merged[userName].todayData.electronicUsage[localActivity.category] || 0) + localActivity.actualMinutes;
              }
            }
          });
          
          // Sort activities by timestamp
          merged[userName].todayData.activities.sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
        }
        
      } else {
        console.log('📱 No new parent actions, using standard merge...');
        // No new parent actions, can use local data as base and add any Redis updates
        merged[userName] = JSON.parse(JSON.stringify(localChild));
      }
      
      // Always use the latest timestamps
      merged[userName].updatedAt = DateTime.local().toISO();
      if (merged[userName].todayData) {
        merged[userName].todayData.updatedAt = DateTime.local().toISO();
      }
    }
    
    console.log('✅ Smart merge completed');
    return merged;
  };

  // Check if local data has changes that need to be synced back
  const checkForLocalChanges = async (localData, redisData, userName) => {
    if (!localData || !redisData || !localData[userName] || !redisData[userName]) {
      return false;
    }
    
    const localChild = localData[userName];
    const redisChild = redisData[userName];
    
    // Check if local has newer electronic activities
    const localActivities = localChild.todayData?.activities?.filter(a => 
      a.type === 'electronic' && !a.addedByParent
    ) || [];
    
    const redisActivities = redisChild.todayData?.activities?.filter(a => 
      a.type === 'electronic' && !a.addedByParent
    ) || [];
    
    // If local has more electronic activities, we have changes to sync
    return localActivities.length > redisActivities.length;
  };

  // Periodic Redis sync for active users
  const scheduleRedisSync = () => {
    // Sync every 5 minutes when app is active
    const interval = setInterval(async () => {
      if (userName && !isParent) {
        try {
          console.log('🔄 Periodic smart sync...');
          const syncResult = await smartSyncWithRedis(userName);
          if (syncResult.success) {
            console.log('✅ Periodic smart sync successful');
            
            // 🔧 FIX: Force component refresh after periodic sync
            setRefreshKey(prev => prev + 1);
            
            const connected = await checkRedisConnection();
            if (connected) {
              // Check if we need to refresh local data
              const currentLimits = await TimeDataService.getCurrentLimits();
              setDataSource(currentLimits.source);
            }
          }
        } catch (error) {
          console.error('❌ Periodic smart sync failed:', error);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return interval;
  };

  // Check AsyncStorage when app starts
  useEffect(() => {
    // Configure notifications
    // NotificationService.configure();
    
    loadUserData();
    
    // Start periodic sync
    const syncInterval = scheduleRedisSync();
    
    // Cleanup on unmount
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, []);

  // Check data source when user changes
  useEffect(() => {
    if (userName && !isParent) {
      checkDataSource();
    }
  }, [userName, isParent]);

  const checkDataSource = async () => {
    try {
      const currentLimits = await TimeDataService.getCurrentLimits();
      setDataSource(currentLimits.source);
      console.log('📊 Current data source:', currentLimits.source);
    } catch (error) {
      console.error('Error checking data source:', error);
      setDataSource('error');
    }
  };

  // Load saved user data on app start
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      
      // Check Redis connection first
      const redisConnected = await checkRedisConnection();
      
      const storedName = await AsyncStorage.getItem('userName');
      const parentMode = await AsyncStorage.getItem('isParent');
      
      if (storedName) {
        setUserName(storedName);
        setIsParent(parentMode === 'true');
        
        // Set the username in TimeDataService for consistency
        await TimeDataService.setUserName(storedName);
        
        console.log('Loaded user:', storedName, 'Parent mode:', parentMode === 'true');
        
        // For child users, use smart sync instead of pushing to Redis
        if (parentMode !== 'true') {
          const limits = await AsyncStorage.getItem('limits');
          const bonusSettings = await AsyncStorage.getItem('bonusSettings');
          
          if (!limits || !bonusSettings) {
            console.warn('Missing essential data for child user, may need to re-login');
          }
          
          // Check current data source
          await checkDataSource();
          
          // If Redis is available, use SMART SYNC instead of pushing
          if (redisConnected) {
            try {
              console.log('🔄 Starting smart sync with Redis...');
              const syncResult = await smartSyncWithRedis(storedName);
              if (syncResult.success) {
                console.log('✅ Smart sync completed successfully');
                
                // 🔧 SIMPLE FIX: Just update currentDayData directly
                console.log('🔧 Force updating currentDayData...');
                const allAppDataString = await AsyncStorage.getItem('allAppData');
                if (allAppDataString) {
                  const allAppData = JSON.parse(allAppDataString);
                  if (allAppData[storedName] && allAppData[storedName].todayData) {
                    await AsyncStorage.setItem('currentDayData', JSON.stringify(allAppData[storedName].todayData));
                    console.log('✅ Updated currentDayData with baseTimeUsed:', allAppData[storedName].todayData.baseTimeUsed);
                  }
                }
                
                // Force component refresh
                console.log('🔄 Triggering component refresh after smart sync...');
                setRefreshKey(prev => prev + 1);
                console.log('✅ Component refresh triggered');
              } else {
                console.warn('⚠️ Smart sync failed, using local data:', syncResult.error);
              }
            } catch (error) {
              console.warn('⚠️ Smart sync failed, but continuing with cached data:', error);
            }
          }
        }
      }
      
      // Debug storage contents
      await debugStorage();
    } catch (error) {
      console.log('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSaved = async (name: string) => {
    setUserName(name);
    
    // Set the username in TimeDataService for consistency
    await TimeDataService.setUserName(name);
    
    // Check if this is a parent login
    const parentMode = await AsyncStorage.getItem('isParent');
    setIsParent(parentMode === 'true');
    
    console.log('App received name:', name, 'Parent mode:', parentMode === 'true');
    
    // Check data source for child users
    if (parentMode !== 'true') {
      await checkDataSource();
    }
    
    // Debug storage after name is saved
    await debugStorage();
  };

  const handleNameCleared = async () => {
    try {
      // Clear all user-related data
      await AsyncStorage.multiRemove([
        'userName',
        'isParent',
        'currentDayData',
        'historicalTimeData',
        'limits',
        'bonusSettings',
        'systemSettings',
        'parentSettings',
        'allAppData'
      ]);
      
      // Clear TimeDataService data as well
      await TimeDataService.clearAllData();
      
      // Reset state
      setUserName('');
      setIsParent(false);
      setCurrentScreen('dashboard');
      setDataSource('unknown');
      
      console.log('App: All user data cleared');
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  };

  const handleNavigateToPastDays = () => {
    setCurrentScreen('pastDays');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const getDataSourceColor = () => {
    switch (dataSource) {
      case 'redis': return '#4CAF50';
      case 'cache': return '#FF9800';
      case 'fallback': return '#F44336';
      default: return theme.text;
    }
  };

  const getDataSourceText = () => {
    switch (dataSource) {
      case 'redis': return 'Live Data';
      case 'cache': return 'Cached Data';
      case 'fallback': return 'Offline Mode';
      default: return '';
    }
  };

  // Show loading screen while checking for existing user data
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar 
          barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.headerBackground}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading TimeWatcher...
          </Text>
          <Text style={[styles.loadingSubtext, { color: theme.text, opacity: 0.7 }]}>
            Checking server connection
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.headerBackground}
      />
      
      {/* Show header only if user is logged in AND on dashboard */}
      {userName && currentScreen === 'dashboard' && (
        <Header userName={userName} onNameCleared={handleNameCleared} />
      )}
      
      {/* Data Source Indicator for child users */}
      {userName && !isParent && dataSource !== 'unknown' && (
        <View style={styles.dataSourceContainer}>
          <View style={[styles.dataSourceDot, { backgroundColor: getDataSourceColor() }]} />
          <Text style={[styles.dataSourceText, { color: getDataSourceColor() }]}>
            {getDataSourceText()}
          </Text>
        </View>
      )}
      
      {/* Navigation Logic */}
      {!userName ? (
        <WelcomeScreen onNameSaved={handleNameSaved} />
      ) : currentScreen === 'pastDays' ? (
        <PastDaysScreen onBack={handleBackToDashboard} />
      ) : isParent ? (
        <ParentDashboard userName={userName} />
      ) : (
        <DashboardScreen 
          key={refreshKey} // 🔧 ADD: Force refresh when key changes
          userName={userName} 
          onNavigateToPastDays={handleNavigateToPastDays}
        />
      )}
    </SafeAreaView>
  );
};

// Root App Component with Theme Provider
function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  dataSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dataSourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dataSourceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default App;