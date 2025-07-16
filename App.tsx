// App.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PastDaysScreen from './src/screens/PastDaysScreen';
import Header from './src/components/Header';
// import NotificationService from './src/services/NotificationService';

// Main App Component (wrapped in ThemeProvider)
const AppContent = () => {
  const { theme } = useTheme();
  const [userName, setUserName] = useState('');
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' or 'pastDays'

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

  // Check AsyncStorage when app starts
  useEffect(() => {
    // Configure notifications
    // NotificationService.configure();
    
    debugStorage();
    loadUserName();
  }, []);

  // Load saved username on app start
  const loadUserName = async () => {
    try {
      const storedName = await AsyncStorage.getItem('userName');
      if (storedName) {
        setUserName(storedName);
      }
    } catch (error) {
      console.log('Error loading username:', error);
    }
  };

  const handleNameSaved = (name: string) => {
    setUserName(name);
    console.log('App received name:', name);
    
    // Debug storage after name is saved
    debugStorage();
  };

  const handleNameCleared = () => {
    setUserName('');
    setCurrentScreen('dashboard'); // Reset to dashboard when name is cleared
    console.log('App: User name cleared');
  };

  const handleNavigateToPastDays = () => {
    setCurrentScreen('pastDays');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

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
      
      {/* Navigation Logic */}
      {!userName ? (
        <WelcomeScreen onNameSaved={handleNameSaved} />
      ) : currentScreen === 'pastDays' ? (
        <PastDaysScreen onBack={handleBackToDashboard} />
      ) : (
        <DashboardScreen 
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
});

export default App;