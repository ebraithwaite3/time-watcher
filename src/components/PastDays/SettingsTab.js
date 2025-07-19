// src/components/PastDays/SettingsTab.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const SettingsTab = ({ parentSettings, systemSettings, onSaveSettings, onRefreshSettings }) => {
  const { theme } = useTheme();
  
  // Local state for editing
  const [editedParentSettings, setEditedParentSettings] = useState({
    familyName: parentSettings.familyName || 'TimeWatcher Family',
    syncPassword: parentSettings.syncPassword || 'P@rent',
    timezone: parentSettings.timezone || 'America/New_York',
    appLockoutMessage: parentSettings.appLockoutMessage || "Time's up! Please ask a parent for more time."
  });
  
  const [editedSystemSettings, setEditedSystemSettings] = useState({
    defaultWeekdayTotal: systemSettings.defaultWeekdayTotal || 120,
    defaultWeekendTotal: systemSettings.defaultWeekendTotal || 120,
    defaultMaxDailyTotal: systemSettings.defaultMaxDailyTotal || 150,
    dailyActivityResetTime: systemSettings.dailyActivityResetTime || '00:00',
    enableNotifications: systemSettings.enableNotifications ?? true
  });

  const handleSave = () => {
    Alert.alert(
      'Save Settings',
      'Save changes to family settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            onSaveSettings(editedParentSettings, editedSystemSettings);
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    onRefreshSettings();
    // Reset local state
    setEditedParentSettings({
      familyName: parentSettings.familyName || 'TimeWatcher Family',
      syncPassword: parentSettings.syncPassword || 'P@rent',
      timezone: parentSettings.timezone || 'America/New_York',
      appLockoutMessage: parentSettings.appLockoutMessage || "Time's up! Please ask a parent for more time."
    });
    setEditedSystemSettings({
      defaultWeekdayTotal: systemSettings.defaultWeekdayTotal || 120,
      defaultWeekendTotal: systemSettings.defaultWeekendTotal || 120,
      defaultMaxDailyTotal: systemSettings.defaultMaxDailyTotal || 150,
      dailyActivityResetTime: systemSettings.dailyActivityResetTime || '00:00',
      enableNotifications: systemSettings.enableNotifications ?? true
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* Parent Settings */}
      <View style={[styles.settingsSection, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>👨‍👩‍👧‍👦 Parent Settings</Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Family Name:</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedParentSettings.familyName}
            onChangeText={text => setEditedParentSettings(prev => ({ ...prev, familyName: text }))}
            placeholder="Enter family name"
            placeholderTextColor={theme.text + '80'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Sync Password:</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedParentSettings.syncPassword}
            onChangeText={text => setEditedParentSettings(prev => ({ ...prev, syncPassword: text }))}
            placeholder="Enter sync password"
            placeholderTextColor={theme.text + '80'}
            secureTextEntry={true}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Timezone:</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedParentSettings.timezone}
            onChangeText={text => setEditedParentSettings(prev => ({ ...prev, timezone: text }))}
            placeholder="America/New_York"
            placeholderTextColor={theme.text + '80'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>App Lockout Message:</Text>
          <TextInput
            style={[styles.settingTextArea, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedParentSettings.appLockoutMessage}
            onChangeText={text => setEditedParentSettings(prev => ({ ...prev, appLockoutMessage: text }))}
            placeholder="Message shown when time runs out"
            placeholderTextColor={theme.text + '80'}
            multiline={true}
            numberOfLines={3}
          />
        </View>
      </View>

      {/* System Settings */}
      <View style={[styles.settingsSection, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🔧 System Settings</Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Default Weekday Time (minutes):</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedSystemSettings.defaultWeekdayTotal.toString()}
            onChangeText={text => setEditedSystemSettings(prev => ({ ...prev, defaultWeekdayTotal: parseInt(text) || 120 }))}
            placeholder="120"
            placeholderTextColor={theme.text + '80'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Default Weekend Time (minutes):</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedSystemSettings.defaultWeekendTotal.toString()}
            onChangeText={text => setEditedSystemSettings(prev => ({ ...prev, defaultWeekendTotal: parseInt(text) || 120 }))}
            placeholder="120"
            placeholderTextColor={theme.text + '80'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Max Daily Total (minutes):</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedSystemSettings.defaultMaxDailyTotal.toString()}
            onChangeText={text => setEditedSystemSettings(prev => ({ ...prev, defaultMaxDailyTotal: parseInt(text) || 150 }))}
            placeholder="150"
            placeholderTextColor={theme.text + '80'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Daily Reset Time:</Text>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.isDark ? '#333' : '#f5f5f5', color: theme.text }]}
            value={editedSystemSettings.dailyActivityResetTime}
            onChangeText={text => setEditedSystemSettings(prev => ({ ...prev, dailyActivityResetTime: text }))}
            placeholder="00:00"
            placeholderTextColor={theme.text + '80'}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.refreshButton, { backgroundColor: theme.isDark ? '#444' : '#ddd' }]}
          onPress={handleRefresh}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>🔄 Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, { backgroundColor: theme.buttonBackground }]}
          onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>💾 Save Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  settingsSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  settingTextArea: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SettingsTab;