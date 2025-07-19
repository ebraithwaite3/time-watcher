// src/screens/WelcomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import timeWatcherRedis from '../services/RedisService';
import TimeDataService from '../services/TimeDataService';

const WelcomeScreen = ({ onNameSaved }) => {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [isParent, setIsParent] = useState(false);
  const [parentPassword, setParentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [redisStatus, setRedisStatus] = useState('checking'); // 'checking', 'connected', 'error'
  const [systemSettings, setSystemSettings] = useState(null);

  // Check Redis connection and pre-load system settings on mount
  useEffect(() => {
    checkRedisConnection();
  }, []);

  const checkRedisConnection = async () => {
    try {
      setRedisStatus('checking');
      
      // Try to fetch system settings to verify Redis connection
      const settings = await TimeDataService.getSystemSettings();
      setSystemSettings(settings);
      
      // Check if we got real Redis data or fallback
      if (settings.appVersion && settings.appVersion !== '1.0.0') {
        setRedisStatus('connected');
      } else {
        // Try a direct Redis call to be sure
        const allData = await timeWatcherRedis.getAllData();
        if (allData && allData.systemSettings) {
          setRedisStatus('connected');
        } else {
          setRedisStatus('error');
        }
      }
    } catch (error) {
      console.error('Redis connection check failed:', error);
      setRedisStatus('error');
    }
  };

  const handleSaveName = async () => {
    // Basic name validation
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    setLoading(true);

    try {
      if (isParent) {
        // --- PARENT LOGIN FLOW ---
        if (!parentPassword.trim()) {
          Alert.alert('Password Required', 'Please enter the parent password.');
          setLoading(false);
          return;
        }

        // Fetch all data from Redis
        const allAppData = await timeWatcherRedis.getAllData();
        console.log('--- All App Data Loaded ---', allAppData);

        if (
          !allAppData ||
          !allAppData.parentSettings ||
          allAppData.parentSettings.syncPassword !== parentPassword.trim()
        ) {
          Alert.alert('Login Failed', 'Invalid parent name or password.');
          setLoading(false);
          return;
        }

        // Successful parent login: Save all app data to AsyncStorage
        await AsyncStorage.setItem('userName', name.trim());
        await AsyncStorage.setItem('isParent', 'true');
        await AsyncStorage.setItem('allAppData', JSON.stringify(allAppData));

        // Cache system and parent settings for offline use
        if (allAppData.systemSettings) {
          await AsyncStorage.setItem('systemSettings', JSON.stringify(allAppData.systemSettings));
        }
        if (allAppData.parentSettings) {
          await AsyncStorage.setItem('parentSettings', JSON.stringify(allAppData.parentSettings));
        }

        console.log('--- Parent Login Success ---');
        console.log('Name saved to storage:', name.trim());
        console.log('Parent mode: true');
        console.log('Redis data cached for offline use');

        Alert.alert('Success', `Welcome, ${name}! You're in Parent Mode.`);
        onNameSaved(name.trim());
      } else {
        // --- CHILD LOGIN FLOW ---
        const kidName = name.trim();
        
        // First, verify the kid exists in Redis
        const kidData = await timeWatcherRedis.getKidData(kidName);
        console.log('--- Kid Data Loaded ---', kidData);

        if (!kidData) {
          Alert.alert(
            'Child Not Found',
            `No profile found for "${kidName}". Please check the name or ask a parent to set up your profile first.`,
          );
          setLoading(false);
          return;
        }

        // Validate that the kid has proper configuration
        if (!kidData.limits || !kidData.bonusSettings) {
          Alert.alert(
            'Profile Incomplete',
            `${kidName}'s profile is missing important settings. Please ask a parent to complete the setup.`,
          );
          setLoading(false);
          return;
        }

        // Extract data from Redis structure
        const currentDayData = kidData.todayData || {};
        const historicalTimeData = kidData.historicalData || {};
        const limits = kidData.limits;
        const bonusSettings = kidData.bonusSettings;

        // Get system and parent settings for the child
        const allAppData = await timeWatcherRedis.getAllData();
        const systemSettings = allAppData?.systemSettings || {};
        const parentSettings = allAppData?.parentSettings || {};

        console.log('--- Kid Data Details ---');
        console.log('Current Day Data:', currentDayData);
        console.log('Historical Time Data:', historicalTimeData);
        console.log('Limits:', limits);
        console.log('Bonus Settings:', bonusSettings);
        console.log('System Settings:', systemSettings);
        console.log('Parent Settings Available:', !!parentSettings);

        // Validate bonus settings against parent settings
        if (parentSettings.bonusActivityTypes) {
          const availableActivities = Object.keys(parentSettings.bonusActivityTypes);
          const kidActivities = Object.keys(bonusSettings);
          const missingActivities = availableActivities.filter(activity => !kidActivities.includes(activity));
          
          if (missingActivities.length > 0) {
            console.warn('Missing bonus activities for kid:', missingActivities);
          }
        }

        // Validate electronic categories
        if (parentSettings.electronicCategories) {
          const availableCategories = Object.keys(parentSettings.electronicCategories);
          console.log('Available electronic categories:', availableCategories);
        }

        // Successful child login: Save all data to AsyncStorage
        await AsyncStorage.setItem('userName', kidName);
        await AsyncStorage.setItem('isParent', 'false');
        
        // Save the individual data components
        await AsyncStorage.setItem('currentDayData', JSON.stringify(currentDayData));
        await AsyncStorage.setItem('historicalTimeData', JSON.stringify(historicalTimeData));
        await AsyncStorage.setItem('limits', JSON.stringify(limits));
        await AsyncStorage.setItem('bonusSettings', JSON.stringify(bonusSettings));
        
        // Cache system and parent settings for offline use
        await AsyncStorage.setItem('systemSettings', JSON.stringify(systemSettings));
        await AsyncStorage.setItem('parentSettings', JSON.stringify(parentSettings));

        // Set username in TimeDataService
        await TimeDataService.setUserName(kidName);

        console.log('--- Child Login Success ---');
        console.log('Name saved to storage:', kidName);
        console.log('Parent mode: false');
        console.log('All Redis data cached locally');

        Alert.alert('Success', `Welcome, ${kidName}! Your time tracking is ready.`);
        onNameSaved(kidName);
      }
    } catch (error) {
      console.error('Error during login/data load:', error);
      
      let errorMessage = 'Failed to load data. Please check your connection and try again.';
      
      if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('Redis') || error.message.includes('cache')) {
        errorMessage = 'Server connection error. Please try again in a moment.';
      }
      
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (redisStatus) {
      case 'connected': return '#4CAF50';
      case 'error': return '#F44336';
      case 'checking': return '#FF9800';
      default: return theme.text;
    }
  };

  const getStatusText = () => {
    switch (redisStatus) {
      case 'connected': return 'Connected to server';
      case 'error': return 'Server connection limited';
      case 'checking': return 'Checking connection...';
      default: return 'Unknown status';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome!</Text>
        <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }]}>
          Enter your name to get started
        </Text>
        
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      <View style={styles.formContainer}>
        <Text style={[styles.label, { color: theme.text }]}>
          {isParent ? 'Parent Name:' : "What's your name?"}
        </Text>

        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.isDark ? '#333' : '#f5f5f5',
              color: theme.text,
              borderColor: theme.text,
            },
          ]}
          value={name}
          onChangeText={setName}
          placeholder={isParent ? 'Enter your name...' : 'Enter your name...'}
          placeholderTextColor={theme.isDark ? '#999' : '#666'}
          autoCapitalize="words"
          returnKeyType={isParent ? 'next' : 'done'}
          onSubmitEditing={isParent ? () => {} : handleSaveName}
          editable={!loading}
        />

        {/* Parent Mode Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            setIsParent(!isParent);
            setParentPassword(''); // Clear password when unchecking
          }}
          disabled={loading}>
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: isParent ? theme.buttonBackground : 'transparent',
                borderColor: theme.text,
              },
            ]}>
            {isParent && (
              <Text style={[styles.checkmark, { color: theme.buttonText }]}>
                ✓
              </Text>
            )}
          </View>
          <Text style={[styles.checkboxLabel, { color: theme.text }]}>
            I'm a parent
          </Text>
        </TouchableOpacity>

        {/* Parent Password Field */}
        {isParent && (
          <View style={styles.passwordContainer}>
            <Text style={[styles.label, { color: theme.text }]}>
              Parent Password:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.isDark ? '#333' : '#f5f5f5',
                  color: theme.text,
                  borderColor: theme.text,
                },
              ]}
              value={parentPassword}
              onChangeText={setParentPassword}
              placeholder="Enter parent password..."
              placeholderTextColor={theme.isDark ? '#999' : '#666'}
              secureTextEntry={true}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              editable={!loading}
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.buttonBackground,
              opacity: loading ? 0.7 : 1,
            },
          ]}
          onPress={handleSaveName}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>
              {isParent ? 'Login as Parent' : 'Get Started'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Redis Status Warning */}
        {redisStatus === 'error' && (
          <View style={styles.warningContainer}>
            <Text style={[styles.warningText, { color: '#F44336' }]}>
              ⚠️ Limited connectivity. Some features may use cached data.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  passwordContainer: {
    width: '100%',
    marginBottom: 20,
  },
  saveButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  warningText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default WelcomeScreen;