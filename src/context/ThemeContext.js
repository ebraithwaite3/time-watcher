// src/context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define your color themes
export const themes = {
  orange: {
    name: 'Orange Theme',
    background: '#FF8C00', // Dark Orange - good contrast with black
    text: '#000000',       // Black text
    headerBackground: '#FF7F00', // Slightly darker orange for header
    headerText: '#000000',
    buttonBackground: '#000000',
    buttonText: '#FF8C00',
    menuBackground: '#FFFFFF',
    menuText: '#000000',
    isDark: false,
  },
  dark: {
    name: 'Dark Theme',
    background: '#000000',   // Black background
    text: '#87CEEB',        // Sky Blue - excellent contrast with black
    headerBackground: '#1A1A1A', // Very dark gray for header
    headerText: '#87CEEB',
    buttonBackground: '#87CEEB',
    buttonText: '#000000',
    menuBackground: '#2A2A2A',
    menuText: '#87CEEB',
    isDark: true,
  },
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('orange'); // Default to orange

  // Load saved theme on app start
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('selectedTheme');
      if (savedTheme && themes[savedTheme]) {
        setCurrentTheme(savedTheme);
        console.log('Loaded theme from storage:', savedTheme);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const switchTheme = async (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
      try {
        await AsyncStorage.setItem('selectedTheme', themeName);
        console.log('Theme saved to storage:', themeName);
      } catch (error) {
        console.log('Error saving theme:', error);
      }
    }
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'orange' ? 'dark' : 'orange';
    switchTheme(newTheme);
  };

  const theme = themes[currentTheme];

  return (
    <ThemeContext.Provider value={{
      theme,
      currentTheme,
      switchTheme,
      toggleTheme,
      availableThemes: Object.keys(themes),
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};