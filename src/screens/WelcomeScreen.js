// src/screens/WelcomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
// import NotificationService from '../services/NotificationService';

const WelcomeScreen = ({ onNameSaved }) => {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedName();
  }, []);

  const loadSavedName = async () => {
    try {
      const storedName = await AsyncStorage.getItem('userName');
      if (storedName) {
        setSavedName(storedName);
        console.log('Loaded name from storage:', storedName);
        // Notify parent component that user has a saved name
        if (onNameSaved) {
          onNameSaved(storedName);
        }
      }
    } catch (error) {
      console.log('Error loading name:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      await AsyncStorage.setItem('userName', name.trim());
      setSavedName(name.trim());
      setName('');
      console.log('Name saved to storage:', name.trim());
      
      // Request notification permissions when user signs in
      // const permissions = await NotificationService.requestPermissions();
      // if (permissions) {
      //   console.log('Notification permissions granted');
      //   Alert.alert('Success', 'Welcome! You\'ll get notified when your screen time sessions end.');
      // } else {
      //   console.log('Notification permissions denied');
      //   Alert.alert('Success', 'Welcome! (Notifications disabled - you can enable them in device settings)');
      // }
      
      Alert.alert('Success', 'Welcome! Your session tracking is ready.');
      
      // Notify parent component
      if (onNameSaved) {
        onNameSaved(name.trim());
      }
    } catch (error) {
      console.log('Error saving name:', error);
      Alert.alert('Error', 'Failed to save name');
    }
  };

  const clearName = async () => {
    try {
      await AsyncStorage.removeItem('userName');
      setSavedName('');
      console.log('Name cleared from storage');
      Alert.alert('Success', 'Name cleared!');
      
      // Notify parent component
      if (onNameSaved) {
        onNameSaved('');
      }
    } catch (error) {
      console.log('Error clearing name:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Welcome!
      </Text>

      {savedName ? (
        <View style={styles.savedNameContainer}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Hello, {savedName}! 👋
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.8 }]}>
            Ready to track some time?
          </Text>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.text }]}>
            Enter your name:
          </Text>
          
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.isDark ? '#333' : 'rgba(255, 255, 255, 0.9)',
                color: theme.text,
                borderColor: theme.text,
              }
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your name here..."
            placeholderTextColor={theme.isDark ? '#999' : '#666'}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: theme.buttonBackground }]} 
            onPress={saveName}
          >
            <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>
              Save Name
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  savedNameContainer: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    marginBottom: 16,
  },
  input: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WelcomeScreen;