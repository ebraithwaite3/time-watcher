// src/components/Header.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const Header = ({ userName, onNameCleared }) => {
  const { theme, toggleTheme, currentTheme } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleChangeName = async () => {
    Alert.alert(
      'Change Name',
      'Are you sure you want to change your name? This will log you out.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Change Name',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userName');
              if (onNameCleared) {
                onNameCleared();
              }
              closeMenu();
            } catch (error) {
              console.log('Error clearing name:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
        <Text style={[styles.greeting, { color: theme.headerText }]}>
          Hi, {userName}! 👋
        </Text>
        
        <TouchableOpacity onPress={openMenu} style={styles.hamburgerButton}>
          <View style={[styles.hamburgerLine, { backgroundColor: theme.headerText }]} />
          <View style={[styles.hamburgerLine, { backgroundColor: theme.headerText }]} />
          <View style={[styles.hamburgerLine, { backgroundColor: theme.headerText }]} />
        </TouchableOpacity>
      </View>

      {/* Hamburger Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeMenu}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.menuBackground }]}>
            
            {/* Theme Toggle */}
            <View style={styles.menuItem}>
              <Text style={[styles.menuText, { color: theme.menuText }]}>
                Dark Theme
              </Text>
              <Switch
                value={currentTheme === 'dark'}
                onValueChange={handleThemeToggle}
                trackColor={{ 
                  false: theme.isDark ? '#555' : '#ddd', 
                  true: theme.text 
                }}
                thumbColor={currentTheme === 'dark' ? theme.background : '#fff'}
              />
            </View>

            {/* Separator */}
            <View style={[styles.separator, { backgroundColor: theme.isDark ? '#444' : '#eee' }]} />

            {/* Change Name */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleChangeName}
            >
              <Text style={[styles.menuText, { color: theme.menuText }]}>
                Change Name
              </Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
  },
  hamburgerButton: {
    padding: 8,
    justifyContent: 'space-between',
    width: 24,
    height: 18,
  },
  hamburgerLine: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginTop: 80, // Position below header
    marginRight: 20,
    borderRadius: 8,
    minWidth: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    marginHorizontal: 20,
  },
});

export default Header;