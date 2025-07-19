// src/screens/ParentDashboard.js
import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import CalendarTab from '../components/PastDays/CalendarTab';
import TrendsTab from '../components/PastDays/TrendsTab';
import StatsTab from '../components/PastDays/StatsTab';
import TodaysHistoryModal from '../components/TodaysHistoryModal';
import timeWatcherRedis from '../services/RedisService';
import SettingsTab from '../components/PastDays/SettingsTab';
import ParentActionsModal from '../components/ParentActionsModal';

const ParentDashboard = ({ userName }) => {
  const { theme } = useTheme();
  const [children, setChildren] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [importData, setImportData] = useState('');
  const [settings, setSettings] = useState({
    parentSettings: {},
    systemSettings: {},
  });

  // ADD MISSING STATE FOR CALENDAR
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [showDayHistoryModal, setShowDayHistoryModal] = useState(false);

  const [showParentActionsModal, setShowParentActionsModal] = useState(false);
  const [selectedChildForActions, setSelectedChildForActions] = useState(null);

  const tabs = [
    { id: 'overview', title: 'Overview', icon: '👨‍👩‍👧‍👦' },
    { id: 'calendar', title: 'Calendar', icon: '📅' },
    { id: 'trends', title: 'Trends', icon: '📈' },
    { id: 'stats', title: 'Stats', icon: '📊' },
    { id: 'settings', title: 'Settings', icon: '⚙️' },
  ];

  useEffect(() => {
    loadChildrenData();
    loadSettings();
  }, []);

  const loadChildrenData = async () => {
    try {
      // 🔧 FIX: Use allAppData instead of parentData
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      if (storedAllAppData) {
        const allAppData = JSON.parse(storedAllAppData);
        console.log('📱 Loading from allAppData:', Object.keys(allAppData));

        // Transform allAppData into the children format expected by ParentDashboard
        const transformedChildren = {};

        Object.keys(allAppData).forEach(childName => {
          // Skip non-child entries (parentSettings, systemSettings)
          if (
            childName === 'parentSettings' ||
            childName === 'systemSettings'
          ) {
            return;
          }

          const childData = allAppData[childName];
          console.log(`👤 Processing child: ${childName}`, childData);

          // Create the child entry
          transformedChildren[childName] = {
            name: childName,
            lastImport: childData.updatedAt || DateTime.local().toISO(),
            historicalData: {},
            totalDays: 0,
          };

          // Add today's data to historical data if it exists
          if (childData.todayData && childData.todayData.date) {
            const todayDate = childData.todayData.date;
            transformedChildren[childName].historicalData[todayDate] =
              childData.todayData;
          }

          // Add historical data if it exists
          if (childData.historicalData) {
            Object.keys(childData.historicalData).forEach(date => {
              // Skip invalid dates like "undefined"
              if (date !== 'undefined' && childData.historicalData[date]) {
                transformedChildren[childName].historicalData[date] =
                  childData.historicalData[date];
              }
            });
          }

          // Update total days count
          transformedChildren[childName].totalDays = Object.keys(
            transformedChildren[childName].historicalData,
          ).length;

          console.log(
            `👤 Loaded ${childName}: ${transformedChildren[childName].totalDays} days`,
          );
        });

        setChildren(transformedChildren);

        // Auto-select first child if none selected
        if (!selectedChild && Object.keys(transformedChildren).length > 0) {
          setSelectedChild(Object.keys(transformedChildren)[0]);
        }

        console.log(
          '✅ Loaded children from allAppData:',
          Object.keys(transformedChildren),
        );
      } else {
        // Fallback: Try the old parentData format for backward compatibility
        console.log('⚠️ No allAppData found, trying old parentData format...');
        const storedParentData = await AsyncStorage.getItem('parentData');
        if (storedParentData) {
          const parsedChildren = JSON.parse(storedParentData);
          setChildren(parsedChildren);

          if (!selectedChild && Object.keys(parsedChildren).length > 0) {
            setSelectedChild(Object.keys(parsedChildren)[0]);
          }
          console.log('📱 Loaded from old parentData format');
        }
      }
    } catch (error) {
      console.error('Error loading children data:', error);
    }
  };

  const saveSettings = async (newParentSettings, newSystemSettings) => {
    try {
      console.log('🔄 Saving settings...', {
        newParentSettings,
        newSystemSettings,
      });

      // Get current allAppData
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      let allAppData = {};

      if (storedAllAppData) {
        allAppData = JSON.parse(storedAllAppData);
        console.log('📱 Current allAppData loaded');
      } else {
        console.log('⚠️ No existing allAppData found, creating new structure');
      }

      // Ensure parent and system settings exist
      if (!allAppData.parentSettings) {
        allAppData.parentSettings = {};
      }
      if (!allAppData.systemSettings) {
        allAppData.systemSettings = {};
      }

      // Update settings with new values
      allAppData.parentSettings = {
        ...allAppData.parentSettings,
        ...newParentSettings,
      };
      allAppData.systemSettings = {
        ...allAppData.systemSettings,
        ...newSystemSettings,
      };

      // Update lastParentUpdate timestamp
      allAppData.parentSettings.lastParentUpdate = DateTime.local().toISO();

      console.log('💾 Updated settings structure:', {
        parentSettings: allAppData.parentSettings,
        systemSettings: allAppData.systemSettings,
      });

      // Save to local storage first
      await AsyncStorage.setItem('allAppData', JSON.stringify(allAppData));
      console.log('✅ Settings saved to AsyncStorage');

      // Update local state
      setSettings({
        parentSettings: allAppData.parentSettings,
        systemSettings: allAppData.systemSettings,
      });
      console.log('✅ Local state updated');

      // Try to save to Redis
      try {
        console.log('🔄 Syncing to Redis...');
        const result = await timeWatcherRedis.setAllData(allAppData);

        if (result && result.success) {
          console.log('✅ Redis sync successful');
          Alert.alert(
            'Settings Saved! ✅',
            'Settings have been saved locally and synced to server.',
          );
        } else {
          console.log('⚠️ Redis sync failed:', result);
          Alert.alert(
            'Partial Save',
            'Settings saved locally but failed to sync to server. Check your internet connection.',
          );
        }
      } catch (redisError) {
        console.error('❌ Redis sync error:', redisError);
        Alert.alert(
          'Partial Save',
          'Settings saved locally but failed to sync to server. Check your internet connection.',
        );
      }
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      Alert.alert('Save Failed', `Failed to save settings: ${error.message}`);
    }
  };

  const loadSettings = async () => {
    try {
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      if (storedAllAppData) {
        const allAppData = JSON.parse(storedAllAppData);
        setSettings({
          parentSettings: allAppData.parentSettings || {},
          systemSettings: allAppData.systemSettings || {},
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveChildrenData = async newChildren => {
    try {
      // 🔧 FIX: Save back to allAppData format instead of parentData
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      let allAppData = {};

      if (storedAllAppData) {
        allAppData = JSON.parse(storedAllAppData);
      }

      // Update each child's data in allAppData
      Object.keys(newChildren).forEach(childName => {
        const childInfo = newChildren[childName];

        // Initialize child entry if it doesn't exist
        if (!allAppData[childName]) {
          allAppData[childName] = {
            profile: {
              name: childName,
              deviceId: `${childName.toLowerCase()}_device_001`,
            },
            limits: { weekday: 120, weekend: 120, maxDailyTotal: 150 },
            bonusSettings: {
              soccer: { maxBonusMinutes: 30, ratio: 0.5 },
              fitness: { maxBonusMinutes: 30, ratio: 1 },
              reading: { maxBonusMinutes: 60, ratio: 0.25 },
            },
            todayData: null,
            historicalData: {},
            createdAt: DateTime.local().toISO(),
            updatedAt: DateTime.local().toISO(),
          };
        }

        // Update historical data
        allAppData[childName].historicalData = childInfo.historicalData || {};
        allAppData[childName].updatedAt =
          childInfo.lastImport || DateTime.local().toISO();

        // Find today's data and set it as todayData
        const todayString = DateTime.local().toISODate();
        if (childInfo.historicalData && childInfo.historicalData[todayString]) {
          allAppData[childName].todayData =
            childInfo.historicalData[todayString];
        }
      });

      // Save back to allAppData
      await AsyncStorage.setItem('allAppData', JSON.stringify(allAppData));

      // Also save to parentData for backward compatibility
      await AsyncStorage.setItem('parentData', JSON.stringify(newChildren));

      setChildren(newChildren);
      console.log('✅ Saved children data to allAppData and parentData');
    } catch (error) {
      console.error('Error saving children data:', error);
      Alert.alert('Error', 'Failed to save children data');
    }
  };

  // Function to apply parent actions to child's data
  const applyParentActionToChild = async (childName, actionData, timeImpact) => {
    try {
      console.log('🔄 === STARTING PARENT ACTION ===');
      console.log('📋 Action Details:', { childName, actionData, timeImpact });
      
      // Get current allAppData
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      if (!storedAllAppData) {
        throw new Error('No app data found');
      }
      
      let allAppData = JSON.parse(storedAllAppData);
      console.log('📱 Loaded allAppData, children:', Object.keys(allAppData).filter(k => k !== 'parentSettings' && k !== 'systemSettings'));
      
      // Find the child
      if (!allAppData[childName]) {
        throw new Error(`Child ${childName} not found`);
      }
      
      const childData = allAppData[childName];
      console.log('👤 Found child data for:', childName);
      
      // Get today's date
      const todayString = DateTime.local().toISODate();
      console.log('📅 Today date:', todayString);
      
      // Log current state BEFORE changes
      console.log('📊 BEFORE - Current todayData:', {
        exists: !!childData.todayData,
        date: childData.todayData?.date,
        baseTimeUsed: childData.todayData?.baseTimeUsed,
        activitiesCount: childData.todayData?.activities?.length || 0
      });
      
      // Ensure todayData exists
      if (!childData.todayData || childData.todayData.date !== todayString) {
        console.log('🆕 Creating new todayData structure');
        // Create today's data structure
        childData.todayData = {
          date: todayString,
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
      
      // Store original values for comparison
      const originalBaseTimeUsed = childData.todayData.baseTimeUsed;
      const originalActivitiesCount = childData.todayData.activities?.length || 0;
      
      // Add the activity to today's activities
      childData.todayData.activities = childData.todayData.activities || [];
      childData.todayData.activities.push(actionData);
      console.log('➕ Added activity to activities array. New count:', childData.todayData.activities.length);
      
      // Update time usage based on action type
      if (actionData.type === 'electronic') {
        // Electronic session - add to baseTimeUsed and device usage
        childData.todayData.baseTimeUsed += timeImpact;
        childData.todayData.electronicUsage[actionData.category] = 
          (childData.todayData.electronicUsage[actionData.category] || 0) + timeImpact;
          
        console.log(`📱 ELECTRONIC SESSION: Added ${timeImpact}min ${actionData.category}. BaseTimeUsed: ${originalBaseTimeUsed} -> ${childData.todayData.baseTimeUsed}`);
      } else if (actionData.type === 'parent_action') {
        // Parent action (punishment/bonus)
        if (actionData.action === 'punishment') {
          // Punishment - add to baseTimeUsed (reduces remaining time)
          childData.todayData.baseTimeUsed += timeImpact;
          console.log(`⚠️ PUNISHMENT: Added ${timeImpact}min. BaseTimeUsed: ${originalBaseTimeUsed} -> ${childData.todayData.baseTimeUsed}`);
        } else if (actionData.action === 'bonus') {
          // Bonus - reduce baseTimeUsed (increases remaining time), but don't go below 0
          const oldValue = childData.todayData.baseTimeUsed;
          childData.todayData.baseTimeUsed = Math.max(0, childData.todayData.baseTimeUsed + timeImpact);
          console.log(`🎁 BONUS: Reduced by ${Math.abs(timeImpact)}min. BaseTimeUsed: ${oldValue} -> ${childData.todayData.baseTimeUsed}`);
        }
      }
      
      // Update timestamps
      const now = DateTime.local().toISO();
      childData.todayData.updatedAt = now;
      childData.updatedAt = now;
      
      // Also add to historical data
      if (!childData.historicalData) {
        childData.historicalData = {};
      }
      childData.historicalData[todayString] = { ...childData.todayData };
      console.log('📚 Updated historical data for:', todayString);
      
      // Log final state AFTER changes
      console.log('📊 AFTER - Updated todayData:', {
        date: childData.todayData.date,
        baseTimeUsed: childData.todayData.baseTimeUsed,
        activitiesCount: childData.todayData.activities.length,
        lastActivity: childData.todayData.activities[childData.todayData.activities.length - 1]
      });
      
      // Save to AsyncStorage first
      await AsyncStorage.setItem('allAppData', JSON.stringify(allAppData));
      console.log('✅ Saved to AsyncStorage');
      
      // 🔧 ENHANCED: Try multiple Redis sync strategies
      let redisSyncSuccess = false;
      
      try {
        console.log('🔄 === REDIS SYNC ATTEMPT 1: setAllData ===');
        const result1 = await timeWatcherRedis.setAllData(allAppData);
        console.log('🔄 setAllData result:', result1);
        
        if (result1 && result1.success) {
          console.log('✅ setAllData successful');
          redisSyncSuccess = true;
        } else {
          console.log('❌ setAllData failed, trying setChildData...');
          
          // Try child-specific sync
          console.log('🔄 === REDIS SYNC ATTEMPT 2: setChildData ===');
          const childDataForRedis = {
            profile: childData.profile,
            limits: childData.limits,
            bonusSettings: childData.bonusSettings,
            todayData: childData.todayData,
            historicalData: childData.historicalData,
            createdAt: childData.createdAt,
            updatedAt: childData.updatedAt
          };
          
          console.log('📤 Sending to Redis:', {
            childName,
            todayDataExists: !!childDataForRedis.todayData,
            baseTimeUsed: childDataForRedis.todayData?.baseTimeUsed,
            activitiesCount: childDataForRedis.todayData?.activities?.length
          });
          
          const result2 = await timeWatcherRedis.setChildData(childName, childDataForRedis);
          console.log('🔄 setChildData result:', result2);
          
          if (result2 && result2.success) {
            console.log('✅ setChildData successful');
            redisSyncSuccess = true;
          }
        }
      } catch (redisError) {
        console.error('❌ Redis sync error:', redisError);
      }
      
      // Verify Redis sync by reading back
      try {
        console.log('🔍 === VERIFYING REDIS SYNC ===');
        const verifyData = await timeWatcherRedis.getChildData(childName);
        console.log('📥 Redis verification result:', {
          success: !!verifyData,
          baseTimeUsed: verifyData?.todayData?.baseTimeUsed,
          activitiesCount: verifyData?.todayData?.activities?.length,
          lastActivityType: verifyData?.todayData?.activities?.[verifyData.todayData.activities.length - 1]?.type
        });
      } catch (verifyError) {
        console.error('❌ Redis verification failed:', verifyError);
      }
      
      // Refresh local data to show changes
      console.log('🔄 Refreshing local children data...');
      await loadChildrenData();
      
      console.log('✅ === PARENT ACTION COMPLETED ===');
      return { 
        success: true, 
        redisSynced: redisSyncSuccess,
        finalBaseTimeUsed: childData.todayData.baseTimeUsed 
      };
      
    } catch (error) {
      console.error('❌ Error applying parent action:', error);
      return { success: false, error: error.message };
    }
  };

  // Function to reset child's day
  const resetChildDay = async childName => {
    try {
      console.log('🔄 Resetting day for child:', childName);

      // Get current allAppData
      const storedAllAppData = await AsyncStorage.getItem('allAppData');
      if (!storedAllAppData) {
        throw new Error('No app data found');
      }

      let allAppData = JSON.parse(storedAllAppData);

      // Find the child
      if (!allAppData[childName]) {
        throw new Error(`Child ${childName} not found`);
      }

      const childData = allAppData[childName];
      const todayString = DateTime.local().toISODate();

      // Reset today's data
      childData.todayData = {
        date: todayString,
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

      // Update timestamps
      childData.updatedAt = DateTime.local().toISO();

      // Remove from historical data if it exists
      if (childData.historicalData && childData.historicalData[todayString]) {
        delete childData.historicalData[todayString];
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem('allAppData', JSON.stringify(allAppData));
      console.log('✅ Day reset saved to AsyncStorage');

      // Sync to Redis
      try {
        const result = await timeWatcherRedis.setAllData(allAppData);
        if (result && result.success) {
          console.log('✅ Day reset synced to Redis');
        }
      } catch (redisError) {
        console.error('❌ Redis sync error:', redisError);
      }

      // Refresh local data
      await loadChildrenData();

      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting child day:', error);
      return { success: false, error: error.message };
    }
  };

  // Handle opening parent actions modal
  const handleParentActions = childName => {
    setSelectedChildForActions(childName);
    setShowParentActionsModal(true);
  };

  // Handle parent actions completion
  const handleParentActionsComplete = () => {
    // Refresh children data to show updated information
    loadChildrenData();
    loadSettings();
  };

  // SAFE DATA MERGE FUNCTION - Prevents data loss!
  const mergeDataSafely = (existingData, newData) => {
    // Create a deep copy of existing data as base
    const merged = JSON.parse(JSON.stringify(existingData));

    // Merge activities arrays - combine and deduplicate by timestamp
    if (newData.activities && Array.isArray(newData.activities)) {
      const existingActivities = merged.activities || [];
      const newActivities = newData.activities;

      // Create a map of existing activities by timestamp for fast lookup
      const existingByTimestamp = new Map();
      existingActivities.forEach(activity => {
        if (activity.timestamp) {
          existingByTimestamp.set(activity.timestamp, activity);
        }
      });

      // Add new activities, avoiding duplicates
      newActivities.forEach(newActivity => {
        if (
          newActivity.timestamp &&
          !existingByTimestamp.has(newActivity.timestamp)
        ) {
          existingActivities.push(newActivity);
        }
      });

      // Sort activities by timestamp
      merged.activities = existingActivities.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      );
    }

    // Merge electronic usage - take the higher values
    if (newData.electronicUsage) {
      merged.electronicUsage = merged.electronicUsage || {};
      Object.keys(newData.electronicUsage).forEach(device => {
        merged.electronicUsage[device] = Math.max(
          merged.electronicUsage[device] || 0,
          newData.electronicUsage[device] || 0,
        );
      });
    }

    // 🔧 FIX: Merge bonus time - handle ALL bonus activities dynamically
    if (newData.bonusTime) {
      merged.bonusTime = merged.bonusTime || {};

      // Get all bonus activity types from both existing and new data
      const allBonusTypes = new Set([
        ...Object.keys(merged.bonusTime || {}),
        ...Object.keys(newData.bonusTime || {}),
      ]);

      // Process each bonus activity type
      allBonusTypes.forEach(activityType => {
        // Skip aggregate fields
        if (
          activityType.startsWith('total') ||
          activityType.startsWith('max')
        ) {
          // For aggregate fields, just copy from newData if available
          if (newData.bonusTime[activityType] !== undefined) {
            merged.bonusTime[activityType] = newData.bonusTime[activityType];
          }
          return;
        }

        // Initialize if doesn't exist
        if (!merged.bonusTime[activityType]) {
          merged.bonusTime[activityType] = {
            earned: 0,
            used: 0,
            activityMinutes: 0,
          };
        }

        // Merge individual activity data if present in newData
        if (newData.bonusTime[activityType]) {
          // Take higher values to avoid losing progress
          merged.bonusTime[activityType].earned = Math.max(
            merged.bonusTime[activityType].earned || 0,
            newData.bonusTime[activityType].earned || 0,
          );
          merged.bonusTime[activityType].used = Math.max(
            merged.bonusTime[activityType].used || 0,
            newData.bonusTime[activityType].used || 0,
          );
          merged.bonusTime[activityType].activityMinutes = Math.max(
            merged.bonusTime[activityType].activityMinutes || 0,
            newData.bonusTime[activityType].activityMinutes || 0,
          );

          // Copy over additional fields like ratio, label if they exist
          if (newData.bonusTime[activityType].ratio !== undefined) {
            merged.bonusTime[activityType].ratio =
              newData.bonusTime[activityType].ratio;
          }
          if (newData.bonusTime[activityType].label !== undefined) {
            merged.bonusTime[activityType].label =
              newData.bonusTime[activityType].label;
          }
        }
      });
    }

    // Merge base time used - take the higher value
    if (newData.baseTimeUsed !== undefined) {
      merged.baseTimeUsed = Math.max(
        merged.baseTimeUsed || 0,
        newData.baseTimeUsed || 0,
      );
    }

    // Update timestamps to latest
    merged.updatedAt =
      newData.updatedAt || merged.updatedAt || DateTime.local().toISO();
    if (
      newData.createdAt &&
      (!merged.createdAt ||
        new Date(newData.createdAt) < new Date(merged.createdAt))
    ) {
      merged.createdAt = newData.createdAt;
    }

    // Preserve active session from newer data
    if (newData.activeSession) {
      merged.activeSession = newData.activeSession;
    }

    return merged;
  };

  const importChildData = () => {
    if (!importData.trim()) {
      Alert.alert('No Data', 'Please paste the child data to import');
      return;
    }

    try {
      const parsed = JSON.parse(importData.trim());

      // Validate the data structure
      if (!parsed.exportInfo || !parsed.exportInfo.childName) {
        Alert.alert(
          'Invalid Data',
          "This doesn't appear to be valid TimeTracker export data",
        );
        return;
      }

      const childName = parsed.exportInfo.childName;
      const exportDate = parsed.exportInfo.exportDate;

      // Add this child's data
      const updatedChildren = { ...children };
      if (!updatedChildren[childName]) {
        updatedChildren[childName] = {
          name: childName,
          lastImport: exportDate,
          historicalData: {},
          totalDays: 0,
        };
      }

      let mergedDays = 0;
      let newDays = 0;
      let totalImportedDays = 0;

      // SAFE MERGE: Historical data
      if (parsed.historicalData) {
        Object.keys(parsed.historicalData).forEach(date => {
          const existingData = updatedChildren[childName].historicalData[date];
          const newData = parsed.historicalData[date];

          if (existingData) {
            // MERGE existing data safely
            updatedChildren[childName].historicalData[date] = mergeDataSafely(
              existingData,
              newData,
            );
            mergedDays++;
          } else {
            // NEW date - safe to add
            updatedChildren[childName].historicalData[date] = newData;
            newDays++;
          }
          totalImportedDays++;
        });
      }

      // SAFE MERGE: Today's data if present
      if (parsed.todayData) {
        const todayDate = parsed.todayData.date || DateTime.local().toISODate();
        const existingTodayData =
          updatedChildren[childName].historicalData[todayDate];

        if (existingTodayData) {
          // MERGE today's data safely
          updatedChildren[childName].historicalData[todayDate] =
            mergeDataSafely(existingTodayData, parsed.todayData);
          if (totalImportedDays === 0) mergedDays++; // Count today if not already counted
        } else {
          // NEW today data - safe to add
          updatedChildren[childName].historicalData[todayDate] =
            parsed.todayData;
          if (totalImportedDays === 0) newDays++; // Count today if not already counted
        }

        if (totalImportedDays === 0) totalImportedDays = 1; // Count today if no historical data
      }

      // Update stats
      updatedChildren[childName].lastImport = exportDate;
      updatedChildren[childName].totalDays = Object.keys(
        updatedChildren[childName].historicalData,
      ).length;

      saveChildrenData(updatedChildren);
      setSelectedChild(childName);
      setImportData('');
      setShowImportInput(false);

      // Detailed success message
      let message = `Successfully imported data for ${childName}!\n\n`;
      if (newDays > 0) message += `📅 ${newDays} new days added\n`;
      if (mergedDays > 0)
        message += `🔄 ${mergedDays} existing days safely merged\n`;
      message += `\n📊 Total days: ${updatedChildren[childName].totalDays}`;

      Alert.alert('Import Successful! 🎉', message);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(
        'Import Error',
        'Failed to import data. Please check the format and try again.',
      );
    }
  };

  // ADD MISSING CALENDAR FUNCTIONS
  const handleDateSelect = async dateString => {
    setSelectedDate(dateString);

    // Get the data for this date
    const childData = children[selectedChild]?.historicalData || {};
    let dayData = childData[dateString] || null;

    // If no historical data found and this is today, try to get today's data
    // (This would require the child to export/import today's data)
    if (!dayData && dateString === DateTime.local().toISODate()) {
      // For now, we can only show historical data in parent mode
      // Today's data needs to be imported from child's export
      dayData = null;
    }

    setSelectedDayData(dayData);
  };

  const handleViewDayDetails = () => {
    if (selectedDayData) {
      setShowDayHistoryModal(true);
    }
  };

  // Format time for display
const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Calculate total time used from day data
const calculateTotalTimeUsed = (dayData) => {
  console.log('Calculating total time used for dayData:', dayData);
  if (!dayData) return 0;
  
  let totalUsed = dayData.baseTimeUsed || 0;
  
  // Add bonus time used
  if (dayData.bonusTime) {
    Object.keys(dayData.bonusTime).forEach(activityType => {
      if (activityType !== 'totalUsed' && activityType !== 'totalEarned' && activityType !== 'totalAvailable' && activityType !== 'maxTotalPossible') {
        const bonus = dayData.bonusTime[activityType];
        if (bonus && bonus.used) {
          totalUsed += bonus.used;
        }
      }
    });
  }
  
  return totalUsed;
};

// Calculate total bonus earned from day data
const calculateTotalBonusEarned = (dayData) => {
  if (!dayData || !dayData.bonusTime) return 0;
  
  let totalEarned = 0;
  
  Object.keys(dayData.bonusTime).forEach(activityType => {
    if (activityType !== 'totalUsed' && activityType !== 'totalEarned' && activityType !== 'totalAvailable' && activityType !== 'maxTotalPossible') {
      const bonus = dayData.bonusTime[activityType];
      if (bonus && bonus.earned) {
        totalEarned += bonus.earned;
      }
    }
  });
  
  return totalEarned;
};

const renderOverview = () => {
  const childrenList = Object.values(children);

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        👨‍👩‍👧‍👦 Family Overview
      </Text>

      {childrenList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            👨‍👩‍👧‍👦 No children data yet
          </Text>
          <Text
            style={[styles.emptySubtext, { color: theme.text, opacity: 0.6 }]}
          >
            Use the safe import button above to add your kids' TimeTracker
            data!
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.childrenTitle, { color: theme.text }]}>
            Your Children ({childrenList.length})
          </Text>
          <Text
            style={[
              styles.childrenCount,
              { color: theme.text, opacity: 0.8 },
            ]}
          >
            Managing {childrenList.length}{' '}
            {childrenList.length === 1 ? 'child' : 'children'}
          </Text>

          {childrenList.map(child => {
            // Get today's data for this child
            const todayString = DateTime.local().toISODate();
            const todayData = child.historicalData ? child.historicalData[todayString] : null;
            
            return (
              <View key={child.name} style={[styles.childCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
                <View style={styles.childHeader}>
                  <View style={styles.childInfo}>
                    <Text style={[styles.childName, { color: theme.text }]}>
                      👤 {child.name}
                    </Text>
                    <Text style={[styles.childSubtext, { color: theme.text, opacity: 0.6 }]}>
                      {child.totalDays} days tracked
                    </Text>
                    <Text style={[styles.childSubtext, { color: theme.text, opacity: 0.6 }]}>
                      Last import: {DateTime.fromISO(child.lastImport).toLocaleString(DateTime.DATE_SHORT)}
                    </Text>
                  </View>
                  
                  {/* Daily Stats */}
                  {todayData ? (
                    <View style={styles.dailyStats}>
                      <View style={styles.dailyStat}>
                        <Text style={[styles.dailyStatValue, { color: '#F44336' }]}>
                          {formatTime(calculateTotalTimeUsed(todayData))}
                        </Text>
                        <Text style={[styles.dailyStatLabel, { color: theme.text, opacity: 0.7 }]}>
                          Time Used
                        </Text>
                      </View>
              
                      <View style={styles.dailyStat}>
                        <Text style={[styles.dailyStatValue, { color: '#4CAF50' }]}>
                          {formatTime(calculateTotalBonusEarned(todayData))}
                        </Text>
                        <Text style={[styles.dailyStatLabel, { color: theme.text, opacity: 0.7 }]}>
                          Bonus Earned
                        </Text>
                      </View>
              
                      <View style={styles.dailyStat}>
                        <Text style={[styles.dailyStatValue, { color: theme.text }]}>
                          {todayData.activities ? todayData.activities.length : 0}
                        </Text>
                        <Text style={[styles.dailyStatLabel, { color: theme.text, opacity: 0.7 }]}>
                          Sessions
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noDailyData}>
                      <Text style={[styles.noDailyDataText, { color: theme.text, opacity: 0.6 }]}>
                        📭 No data today
                      </Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.buttonBackground }]}
                    onPress={() => handleParentActions(child.name)}
                  >
                    <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                      Actions
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
};

  const renderChildData = () => {
    // For Overview tab, always show overview regardless of child selection
    if (activeTab === 'overview') {
      return renderOverview();
    }

    // For other tabs, require child selection
    if (!selectedChild || !children[selectedChild]) {
      return (
        <View style={styles.noChildSelected}>
          <Text style={[styles.noChildText, { color: theme.text }]}>
            Select a child from the Overview tab to view their data
          </Text>
        </View>
      );
    }

    const childData = children[selectedChild].historicalData;

    switch (activeTab) {
      case 'calendar':
        return (
          <CalendarTab
            historicalData={childData}
            selectedDate={selectedDate}
            selectedDayData={selectedDayData}
            onDateSelect={handleDateSelect}
            onViewDayDetails={handleViewDayDetails}
          />
        );
      case 'trends':
        return <TrendsTab historicalData={childData} />;
      case 'stats':
        return <StatsTab historicalData={childData} />;
      case 'settings':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              ⚙️ Family Settings
            </Text>
            <SettingsTab
              parentSettings={settings.parentSettings}
              systemSettings={settings.systemSettings}
              onSaveSettings={saveSettings}
              onRefreshSettings={loadSettings}
            />
          </ScrollView>
        );
      default:
        return renderOverview();
    }
  };

  const handleSyncClick = async () => {
    try {
      console.log('🔄 Starting Redis data pull...');

      // Show loading state
      Alert.alert('Syncing...', 'Pulling latest data from server...');

      // Get all data from Redis
      const redisData = await timeWatcherRedis.getAllData();

      if (!redisData) {
        Alert.alert('No Server Data', 'No data found on server to sync');
        return;
      }

      console.log('📥 Received Redis data:', Object.keys(redisData));

      // Transform Redis data into the children format expected by ParentDashboard
      const transformedChildren = {};
      let childCount = 0;

      Object.keys(redisData).forEach(childName => {
        // Skip non-child entries (parentSettings, systemSettings)
        if (childName === 'parentSettings' || childName === 'systemSettings') {
          return;
        }

        const childData = redisData[childName];
        childCount++;

        // Create the child entry
        transformedChildren[childName] = {
          name: childName,
          lastImport: childData.updatedAt || DateTime.local().toISO(),
          historicalData: {},
          totalDays: 0,
        };

        // Add today's data to historical data if it exists
        if (childData.todayData && childData.todayData.date) {
          const todayDate = childData.todayData.date;
          transformedChildren[childName].historicalData[todayDate] =
            childData.todayData;
        }

        // Add historical data if it exists
        if (childData.historicalData) {
          Object.keys(childData.historicalData).forEach(date => {
            // Skip invalid dates like "undefined"
            if (date !== 'undefined' && childData.historicalData[date]) {
              transformedChildren[childName].historicalData[date] =
                childData.historicalData[date];
            }
          });
        }

        // Update total days count
        transformedChildren[childName].totalDays = Object.keys(
          transformedChildren[childName].historicalData,
        ).length;

        console.log(
          `👤 Synced ${childName}: ${transformedChildren[childName].totalDays} days`,
        );
      });

      if (childCount === 0) {
        Alert.alert('No Children Data', 'No children data found on server');
        return;
      }

      // Update local state with fresh Redis data
      setChildren(transformedChildren);

      // Auto-select first child if none selected or current child no longer exists
      if (!selectedChild || !transformedChildren[selectedChild]) {
        if (Object.keys(transformedChildren).length > 0) {
          setSelectedChild(Object.keys(transformedChildren)[0]);
        }
      }

      // Also update local storage with the fresh Redis data
      await AsyncStorage.setItem('allAppData', JSON.stringify(redisData));

      // Transform and save in parent dashboard format for backward compatibility
      await AsyncStorage.setItem(
        'parentData',
        JSON.stringify(transformedChildren),
      );

      // 📋 LOG ASYNC STORAGE CONTENTS AFTER SYNC
      console.log('📋 === ASYNC STORAGE CONTENTS AFTER SYNC ===');
      try {
        // Log allAppData
        const finalAllAppData = await AsyncStorage.getItem('allAppData');
        if (finalAllAppData) {
          const parsedAllAppData = JSON.parse(finalAllAppData);
          console.log('📱 allAppData keys:', Object.keys(parsedAllAppData));
          Object.keys(parsedAllAppData).forEach(key => {
            if (key !== 'parentSettings' && key !== 'systemSettings') {
              const childData = parsedAllAppData[key];
              console.log(`   👤 ${key}:`, {
                hasProfile: !!childData.profile,
                hasLimits: !!childData.limits,
                hasTodayData: !!childData.todayData,
                historicalDaysCount: childData.historicalData
                  ? Object.keys(childData.historicalData).length
                  : 0,
                updatedAt: childData.updatedAt,
              });
            } else {
              console.log(`   ⚙️ ${key}: present`);
            }
          });
        } else {
          console.log('📱 allAppData: null');
        }

        // Log parentData
        const finalParentData = await AsyncStorage.getItem('parentData');
        if (finalParentData) {
          const parsedParentData = JSON.parse(finalParentData);
          console.log('👨‍👩‍👧‍👦 parentData keys:', Object.keys(parsedParentData));
          Object.keys(parsedParentData).forEach(childName => {
            const child = parsedParentData[childName];
            console.log(
              `   👤 ${childName}: ${child.totalDays} days, last import: ${child.lastImport}`,
            );
          });
        } else {
          console.log('👨‍👩‍👧‍👦 parentData: null');
        }

        // Log all AsyncStorage keys for completeness
        const allKeys = await AsyncStorage.getAllKeys();
        console.log('🗄️ All AsyncStorage keys:', allKeys);
      } catch (logError) {
        console.error('❌ Error logging AsyncStorage:', logError);
      }
      console.log('📋 === END ASYNC STORAGE LOG ===');

      Alert.alert(
        'Sync Successful! ✅',
        `Successfully pulled data for ${childCount} ${
          childCount === 1 ? 'child' : 'children'
        } from server.\n\nData refreshed with latest information.`,
      );

      console.log('✅ Redis data pull completed');
    } catch (error) {
      console.error('❌ Redis sync error:', error);
      Alert.alert(
        'Sync Failed',
        `Failed to pull data from server: ${error.message}\n\nPlease check your internet connection and try again.`,
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            👨‍👩‍👧‍👦 Parent Dashboard
          </Text>
          <TouchableOpacity
            onPress={handleSyncClick}
            style={[
              styles.syncButton,
              { backgroundColor: theme.buttonBackground },
            ]}
          >
            <Text style={[styles.syncButtonText, { color: theme.buttonText }]}>
              📥 Sync Data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Child Selector */}
        {Object.keys(children).length > 0 && (
          <View style={styles.childSelectorContainer}>
            {Object.keys(children).length === 1 ? (
              // Single child - just show text
              <Text
                style={[
                  styles.singleChildText,
                  { color: theme.buttonBackground },
                ]}
              >
                Viewing: {selectedChild}
              </Text>
            ) : (
              // Multiple children - show dropdown
              <View style={styles.dropdownContainer}>
                <Text style={[styles.dropdownLabel, { color: theme.text }]}>
                  Viewing:
                </Text>
                <View
                  style={[
                    styles.pickerContainer,
                    {
                      backgroundColor: theme.isDark
                        ? '#333'
                        : 'rgba(255,255,255,0.9)',
                    },
                  ]}
                >
                  <Picker
                    selectedValue={selectedChild}
                    onValueChange={value => setSelectedChild(value)}
                    style={[styles.childPicker, { color: theme.text }]}
                    dropdownIconColor={theme.text}
                  >
                    {Object.keys(children).map(childName => (
                      <Picker.Item
                        key={childName}
                        label={`👤 ${childName} (${children[childName].totalDays} days)`}
                        value={childName}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === tab.id
                    ? theme.buttonBackground
                    : theme.isDark
                    ? '#333'
                    : 'rgba(255,255,255,0.8)',
              },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab.id ? theme.buttonText : theme.text,
                },
              ]}
            >
              {tab.icon} {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>{renderChildData()}</View>

      {/* Day History Modal for Calendar */}
      {selectedDayData && (
        <TodaysHistoryModal
          visible={showDayHistoryModal}
          onClose={() => setShowDayHistoryModal(false)}
          selectedDate={selectedDate}
          dayData={selectedDayData}
        />
      )}

      <ParentActionsModal
        visible={showParentActionsModal}
        onClose={() => setShowParentActionsModal(false)}
        childName={selectedChildForActions}
        onActionComplete={handleParentActionsComplete}
        applyParentActionToChild={applyParentActionToChild}
        resetChildDay={resetChildDay}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectedChild: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-around',
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  childrenCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  childCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
  },
  childDays: {
    fontSize: 12,
  },
  lastImport: {
    fontSize: 11,
  },
  importSection: {
    marginBottom: 30,
    padding: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  importSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  importSafetyNote: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  childrenTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  importButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  importForm: {
    marginTop: 10,
  },
  importLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  importTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  importButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 0.4,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmImportButton: {
    flex: 0.55,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmImportButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  noChildSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noChildText: {
    fontSize: 16,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  childSelectorContainer: {
    marginTop: 10,
  },
  childCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  parentActionsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  parentActionsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dailyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 16,
  },
  dailyStat: {
    alignItems: 'center',
    minWidth: 60,
  },
  dailyStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dailyStatLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  noDailyData: {
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 16,
  },
  noDailyDataText: {
    fontSize: 12,
    textAlign: 'center',
  },
  childInfo: {
    flex: 1,
  },
  childSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ParentDashboard;
