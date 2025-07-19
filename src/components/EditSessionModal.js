// src/components/EditSessionModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService, { ELECTRONIC_LABELS } from '../services/TimeDataService';

const EditSessionModal = ({ visible, activity, onClose, onSave }) => {
  const { theme } = useTheme();
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [timeEditModalVisible, setTimeEditModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [newTimeValue, setNewTimeValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && activity) {
      setPassword('');
      setNewTimeValue('');
      setPasswordModalVisible(true);
      setTimeEditModalVisible(false);
    }
  }, [visible, activity]);

  // Handle password submission
  const handlePasswordSubmit = () => {
    if (password === 'P@rent') {
      setPasswordModalVisible(false);
      setPassword('');
      
      // Set initial time value based on activity type
      if (activity.type === 'electronic') {
        setNewTimeValue(activity.actualMinutes.toString());
      } else {
        setNewTimeValue(activity.activityMinutes.toString());
      }
      
      setTimeEditModalVisible(true);
    } else {
      Alert.alert('Error', 'Incorrect password');
      setPassword('');
    }
  };

  // Handle time edit submission
  const handleTimeEditSubmit = async () => {
    const newTime = parseInt(newTimeValue);
    
    if (isNaN(newTime) || newTime < 0) {
      Alert.alert('Error', 'Please enter a valid number of minutes');
      return;
    }

    setSaving(true);

    try {
      if (activity.type === 'electronic') {
        // Update electronic session time
        await TimeDataService.updateElectronicSessionTime(
          activity.timestamp, 
          newTime
        );
      } else {
        // Update bonus activity time
        await TimeDataService.updateBonusActivityTime(
          activity.category,
          newTime
        );
      }

      // Close modals and notify parent
      handleClose();
      onSave();
      
      Alert.alert('Success', 'Time updated successfully');
    } catch (error) {
      console.error('Error updating time:', error);
      Alert.alert('Error', 'Failed to update time');
    } finally {
      setSaving(false);
    }
  };

  // Close all modals and reset state
  const handleClose = () => {
    setPasswordModalVisible(false);
    setTimeEditModalVisible(false);
    setPassword('');
    setNewTimeValue('');
    onClose();
  };

  // Close password modal specifically
  const handlePasswordModalClose = () => {
    setPasswordModalVisible(false);
    setPassword('');
    onClose();
  };

  // Close time edit modal specifically
  const handleTimeEditModalClose = () => {
    setTimeEditModalVisible(false);
    setNewTimeValue('');
    onClose();
  };

  // Get activity display info
  const getActivityInfo = () => {
    if (!activity) return { name: '', emoji: '' };
    
    if (activity.type === 'electronic') {
      return {
        name: `${ELECTRONIC_LABELS[activity.category]} Session`,
        emoji: '📱'
      };
    } else {
      return {
        name: `${activity.category === 'soccer' ? 'Soccer' : 'Fitness'} Activity`,
        emoji: activity.category === 'soccer' ? '⚽' : '💪'
      };
    }
  };

  const activityInfo = getActivityInfo();

  return (
    <>
      {/* Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handlePasswordModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.passwordModalContainer, { backgroundColor: theme.menuBackground }]}>
            <Text style={[styles.passwordModalTitle, { color: theme.text }]}>
              Enter Password to Edit
            </Text>
            <Text style={[styles.activityLabel, { color: theme.text, opacity: 0.7 }]}>
              {activityInfo.emoji} {activityInfo.name}
            </Text>
            <TextInput
              style={[styles.passwordInput, { 
                backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                color: theme.text,
                borderColor: theme.isDark ? '#666' : '#ddd'
              }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              placeholder="Password"
              placeholderTextColor={theme.text + '80'}
              autoFocus={true}
              onSubmitEditing={handlePasswordSubmit}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handlePasswordModalClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handlePasswordSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Time Modal */}
      <Modal
        visible={timeEditModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleTimeEditModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModalContainer, { backgroundColor: theme.menuBackground }]}>
            <Text style={[styles.editModalTitle, { color: theme.text }]}>
              Edit {activity?.type === 'electronic' ? 'Session' : 'Activity'} Time
            </Text>
            <Text style={[styles.editModalSubtext, { color: theme.text, opacity: 0.7 }]}>
              {activityInfo.emoji} {activityInfo.name}
            </Text>
            
            <View style={styles.currentTimeContainer}>
              <Text style={[styles.currentTimeLabel, { color: theme.text, opacity: 0.6 }]}>
                Current: {activity?.type === 'electronic' ? activity?.actualMinutes : activity?.activityMinutes} minutes
              </Text>
            </View>

            <TextInput
              style={[styles.timeInput, { 
                backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                color: theme.text,
                borderColor: theme.isDark ? '#666' : '#ddd'
              }]}
              value={newTimeValue}
              onChangeText={setNewTimeValue}
              keyboardType="numeric"
              placeholder="Minutes"
              placeholderTextColor={theme.text + '80'}
              autoFocus={true}
              onSubmitEditing={handleTimeEditSubmit}
              editable={!saving}
            />
            <Text style={[styles.editHint, { color: theme.text, opacity: 0.6 }]}>
              Enter the new time in minutes
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleTimeEditModalClose}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.submitButton,
                  saving && styles.disabledButton
                ]}
                onPress={handleTimeEditSubmit}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Password Modal Styles
  passwordModalContainer: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  passwordModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  activityLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  // Edit Modal Styles
  editModalContainer: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  editModalSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  currentTimeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 16,
  },
  currentTimeLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  editHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  // Button Styles
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default EditSessionModal;