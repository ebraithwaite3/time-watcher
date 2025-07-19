// src/components/ParentActionsModal.js
import React, { useState } from 'react';
import { DateTime } from 'luxon';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ParentActionsModal = ({
  visible,
  onClose,
  onActionComplete,
  childName,
  applyParentActionToChild,
  resetChildDay,
}) => {
  const { theme } = useTheme();
  const [actionType, setActionType] = useState('session');
  const [timeAmount, setTimeAmount] = useState('');
  const [reason, setReason] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('tablet');
  const [saving, setSaving] = useState(false);

  const actionTypes = [
    { id: 'session', label: '📱 Log Session', description: 'Add electronic usage session' },
    { id: 'punishment', label: '⚠️ Punishment', description: 'Remove time for misbehavior' },
    { id: 'bonus', label: '🎁 Bonus Time', description: 'Add extra time as reward' },
    { id: 'reset', label: '🔄 Reset Today', description: 'Reset all time usage for today' },
  ];

  const deviceOptions = [
    { id: 'tablet', label: '📱 Tablet' },
    { id: 'phone', label: '📞 Phone' },
    { id: 'playstation', label: '🎮 PlayStation' },
    { id: 'switch', label: '🕹️ Switch' },
    { id: 'tv_movie', label: '📺 TV/Movies' },
    { id: 'computer', label: '💻 Computer' },
  ];

  // Reset modal state when it opens
  React.useEffect(() => {
    if (visible) {
      setActionType('session');
      setTimeAmount('');
      setReason('');
      setSelectedDevice('tablet');
      setSaving(false);
    }
  }, [visible]);

  const handleAction = async () => {
    if (actionType === 'reset') {
      return handleResetDay();
    }

    const minutes = parseInt(timeAmount);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert('Error', 'Please enter a valid number of minutes');
      return;
    }

    // Session doesn't require a reason, others do
    if (actionType !== 'session' && !reason.trim()) {
      Alert.alert('Error', 'Please enter a reason for this action');
      return;
    }

    setSaving(true);

    try {
      let result;
      
      if (actionType === 'session') {
        result = await addElectronicSession(selectedDevice, minutes, reason);
      } else {
        result = await applyParentAction(actionType, minutes, reason);
      }
      
      if (result.success) {
        onClose();
        onActionComplete();
        
        let message;
        if (actionType === 'session') {
          message = `📱 Added ${minutes} minute ${deviceOptions.find(d => d.id === selectedDevice)?.label} session for ${childName}`;
        } else {
          const actionLabel = actionTypes.find(a => a.id === actionType)?.label || actionType;
          message = `${actionLabel}: ${minutes} minutes\nReason: ${reason}\n\nApplied to ${childName}'s account.`;
        }
        
        Alert.alert('Action Applied! ✅', message);
      } else {
        Alert.alert('Error', result.error || 'Failed to apply action');
      }
    } catch (error) {
      console.error('❌ Error applying parent action:', error);
      Alert.alert('Error', 'Failed to apply action');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDay = () => {
    Alert.alert(
      'Reset Today?',
      `This will reset all time usage for ${childName} today. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const result = await resetChildDay(childName);
              if (result.success) {
                onClose();
                onActionComplete();
                Alert.alert('Day Reset! ✅', `${childName}'s time usage has been reset for today.`);
              } else {
                Alert.alert('Error', result.error || 'Failed to reset day');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reset day');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // Add electronic session for child
  const addElectronicSession = async (device, minutes, note) => {
    try {
      const now = DateTime.local();
      const startTime = now.minus({ minutes }); // Estimate start time
      
      const sessionActivity = {
        type: 'electronic',
        category: device,
        startTime: startTime.toISO(),
        endTime: now.toISO(),
        estimatedMinutes: minutes,
        actualMinutes: minutes,
        timestamp: now.toISO(),
        addedByParent: true,
        parentNote: note || 'Added by parent',
      };

      return await applyParentActionToChild(childName, sessionActivity, minutes);
    } catch (error) {
      console.error('Error adding electronic session:', error);
      return { success: false, error: error.message };
    }
  };
  // Apply parent action (punishment/bonus) by creating a special activity entry
  const applyParentAction = async (type, minutes, reason) => {
    try {
      const now = DateTime.local();
      
      const parentActivity = {
        type: 'parent_action',
        action: type,
        minutes: type === 'punishment' ? minutes : -minutes, // Punishment = positive (removes time), bonus = negative (adds time)
        reason: reason,
        appliedBy: 'Parent',
        timestamp: now.toISO(),
        startTime: now.toISO(),
        endTime: now.toISO(),
        actualMinutes: type === 'punishment' ? minutes : -minutes,
      };

      return await applyParentActionToChild(childName, parentActivity, type === 'punishment' ? minutes : -minutes);
    } catch (error) {
      console.error('Error applying parent action:', error);
      return { success: false, error: error.message };
    }
  };

  const formatTime = minutes => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.menuBackground },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Parent Actions
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }]}>
            Apply actions to {childName}'s time
          </Text>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Action Type Selection */}
            <Text style={[styles.label, { color: theme.text }]}>Action Type:</Text>
            {actionTypes.map(action => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionTypeCard,
                  {
                    backgroundColor: actionType === action.id 
                      ? theme.buttonBackground 
                      : theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)',
                    borderColor: actionType === action.id ? theme.buttonBackground : 'transparent',
                  },
                ]}
                onPress={() => setActionType(action.id)}
              >
                <Text style={[
                  styles.actionTypeLabel,
                  { color: actionType === action.id ? theme.buttonText : theme.text }
                ]}>
                  {action.label}
                </Text>
                <Text style={[
                  styles.actionTypeDescription,
                  { color: actionType === action.id ? theme.buttonText : theme.text, opacity: 0.7 }
                ]}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Device Selection (for sessions only) */}
            {actionType === 'session' && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>Device:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceScrollView}>
                  {deviceOptions.map(device => (
                    <TouchableOpacity
                      key={device.id}
                      style={[
                        styles.deviceChip,
                        {
                          backgroundColor: selectedDevice === device.id 
                            ? theme.buttonBackground 
                            : theme.isDark ? '#333' : '#f5f5f5',
                          borderColor: selectedDevice === device.id ? theme.buttonBackground : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedDevice(device.id)}
                    >
                      <Text style={[
                        styles.deviceChipText,
                        { color: selectedDevice === device.id ? theme.buttonText : theme.text }
                      ]}>
                        {device.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Time Input (for all except reset) */}
            {actionType !== 'reset' && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>
                  {actionType === 'session' ? 'Session Duration:' :
                   actionType === 'punishment' ? 'Time to Remove:' : 'Time to Add:'}
                </Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                      color: theme.text,
                      borderColor: theme.isDark ? '#666' : '#ddd',
                    },
                  ]}
                  value={timeAmount}
                  onChangeText={setTimeAmount}
                  keyboardType="numeric"
                  placeholder="Enter minutes"
                  placeholderTextColor={theme.text + '80'}
                  maxLength={3}
                />
              </>
            )}

            {/* Reason/Note Input */}
            {actionType !== 'reset' && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>
                  {actionType === 'session' ? 'Note (optional):' : 'Reason:'}
                </Text>
                <TextInput
                  style={[
                    styles.reasonInput,
                    {
                      backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                      color: theme.text,
                      borderColor: theme.isDark ? '#666' : '#ddd',
                    },
                  ]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder={
                    actionType === 'session' ? 'Optional note about this session' :
                    actionType === 'punishment' ? 'Why is time being removed?' : 
                    'Why is bonus time being given?'
                  }
                  placeholderTextColor={theme.text + '80'}
                  multiline={true}
                  numberOfLines={2}
                />
              </>
            )}

            {/* Preview */}
            {actionType !== 'reset' && timeAmount && (
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: 
                      actionType === 'session' ? 'rgba(33, 150, 243, 0.1)' :
                      actionType === 'punishment' ? 'rgba(244, 67, 54, 0.1)' : 
                      'rgba(76, 175, 80, 0.1)',
                  },
                ]}
              >
                <Text style={[
                  styles.previewText,
                  { color: 
                      actionType === 'session' ? '#2196F3' :
                      actionType === 'punishment' ? '#F44336' : '#4CAF50' 
                  }
                ]}>
                  {actionType === 'session' ? '📱 Will log' :
                   actionType === 'punishment' ? '⚠️ Will remove' : '🎁 Will add'} {formatTime(parseInt(timeAmount) || 0)}
                  {actionType === 'session' ? ` ${deviceOptions.find(d => d.id === selectedDevice)?.label} session` : ''}
                </Text>
                <Text style={[styles.previewSubtext, { color: theme.text, opacity: 0.7 }]}>
                  {actionType === 'session' ? 'This will count as time used' :
                   actionType === 'punishment' ? 'This will reduce available time' : 
                   'This will increase available time'}
                </Text>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.actionButton,
                { 
                  backgroundColor: 
                    actionType === 'session' ? '#2196F3' :
                    actionType === 'punishment' ? '#F44336' :
                    actionType === 'bonus' ? '#4CAF50' :
                    theme.buttonBackground 
                },
                saving && styles.disabledButton,
              ]}
              onPress={handleAction}
              disabled={
                saving || 
                (actionType === 'reset' ? false : !timeAmount) ||
                (actionType !== 'session' && actionType !== 'reset' && !reason.trim())
              }
            >
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {saving ? 'Applying...' : 
                 actionType === 'session' ? '📱 Log Session' :
                 actionType === 'punishment' ? '⚠️ Apply Punishment' :
                 actionType === 'bonus' ? '🎁 Give Bonus' :
                 '🔄 Reset Day'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    height: '80%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 5,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  scrollContent: {
    flex: 1,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  actionTypeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  actionTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionTypeDescription: {
    fontSize: 12,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  previewCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  previewSubtext: {
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
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
  actionButton: {
    // backgroundColor handled dynamically
  },
  actionButtonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ParentActionsModal;