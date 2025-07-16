// src/components/EndSessionModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService, { ELECTRONIC_LABELS } from '../services/TimeDataService';

const EndSessionModal = ({ visible, onClose, onSessionUpdate, activeSession }) => {
  const { theme } = useTheme();
  const [adjustedTime, setAdjustedTime] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Calculate elapsed time since session started
  const getElapsedTime = () => {
    if (!activeSession) return 0;
    const startTime = new Date(activeSession.startTime);
    const now = new Date();
    return Math.round((now - startTime) / 60000); // Convert to minutes
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

  const handleEndSession = async () => {
    const timeToUse = isAdjusting && adjustedTime ? parseInt(adjustedTime) : getElapsedTime();
    
    if (timeToUse <= 0) {
      Alert.alert('Invalid Time', 'Session time must be greater than 0 minutes.');
      return;
    }

    const deviceName = ELECTRONIC_LABELS[activeSession.category];
    const elapsedTime = getElapsedTime();
    const difference = timeToUse - activeSession.estimatedMinutes;
    const differenceText = difference > 0 ? `${difference}m over` : difference < 0 ? `${Math.abs(difference)}m under` : 'exactly as estimated';

    Alert.alert(
      'End Session',
      `End ${deviceName} session?\n\nEstimated: ${activeSession.estimatedMinutes}m\nActual: ${timeToUse}m (${differenceText})\n\nThis will use ${timeToUse} minutes from your daily time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          onPress: async () => {
            const result = await TimeDataService.endElectronicSession(timeToUse);
            
            if (result.success) {
              onSessionUpdate();
              onClose();
              
              const successMessage = result.difference === 0 
                ? `Perfect timing! Used exactly ${result.actualMinutes} minutes as estimated.`
                : result.difference > 0 
                  ? `Session ended! Used ${result.actualMinutes} minutes (${result.difference}m over estimate).`
                  : `Great job! Finished early! Used ${result.actualMinutes} minutes (${Math.abs(result.difference)}m under estimate).`;
              
              Alert.alert(
                'Session Complete!',
                `${successMessage}\n\nTime remaining: ${formatTime(result.newTimeRemaining)}`
              );
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  const handleCancelSession = () => {
    Alert.alert(
      'Cancel Session',
      'Cancel this session without logging any time? This cannot be undone.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            const result = await TimeDataService.cancelActiveSession();
            if (result.success) {
              onSessionUpdate();
              onClose();
              Alert.alert('Session Cancelled', 'No time was logged for this session.');
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (visible && activeSession) {
      setAdjustedTime('');
      setIsAdjusting(false);
    }
  }, [visible, activeSession]);

  if (!activeSession) return null;

  const elapsedTime = getElapsedTime();
  const timeToUse = isAdjusting && adjustedTime ? parseInt(adjustedTime) || 0 : elapsedTime;
  const deviceName = ELECTRONIC_LABELS[activeSession.category];
  const estimatedEndTime = new Date(activeSession.estimatedEndTime);
  const isOverTime = new Date() > estimatedEndTime;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.menuBackground }]}>
          
          {/* Header */}
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            End {deviceName} Session
          </Text>
          
          {/* Session Info */}
          <View style={[styles.sessionInfo, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
            <Text style={[styles.sessionLabel, { color: theme.text, opacity: 0.7 }]}>Session Started:</Text>
            <Text style={[styles.sessionValue, { color: theme.text }]}>
              {new Date(activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            
            <Text style={[styles.sessionLabel, { color: theme.text, opacity: 0.7 }]}>Estimated Duration:</Text>
            <Text style={[styles.sessionValue, { color: theme.text }]}>
              {activeSession.estimatedMinutes} minutes
            </Text>
            
            <Text style={[styles.sessionLabel, { color: theme.text, opacity: 0.7 }]}>Actual Time Elapsed:</Text>
            <Text style={[styles.sessionValue, { color: isOverTime ? '#F44336' : theme.text }]}>
              {formatTime(elapsedTime)} {isOverTime && '(Over time!)'}
            </Text>
          </View>

          {/* Time Adjustment */}
          <View style={styles.adjustmentSection}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Adjust actual time used:
            </Text>
            <Text style={[styles.helpText, { color: theme.text, opacity: 0.6 }]}>
              Leave blank to use actual elapsed time ({formatTime(elapsedTime)})
            </Text>
            
            <TextInput
              style={[
                styles.adjustInput,
                {
                  backgroundColor: theme.isDark ? '#333' : '#f5f5f5',
                  color: theme.text,
                  borderColor: isAdjusting ? theme.buttonBackground : 'transparent',
                }
              ]}
              value={adjustedTime}
              onChangeText={(text) => {
                setAdjustedTime(text);
                setIsAdjusting(text.length > 0);
              }}
              placeholder={`${elapsedTime} minutes`}
              placeholderTextColor={theme.isDark ? '#999' : '#666'}
              keyboardType="numeric"
            />
          </View>

          {/* Time Preview */}
          <View style={styles.previewContainer}>
            <Text style={[styles.previewText, { color: theme.text }]}>
              Will log: {formatTime(timeToUse)}
            </Text>
            <Text style={[styles.previewText, { color: theme.text, opacity: 0.7 }]}>
              Difference from estimate: {timeToUse === activeSession.estimatedMinutes ? 'Perfect!' : 
                timeToUse > activeSession.estimatedMinutes ? 
                  `+${timeToUse - activeSession.estimatedMinutes}m over` : 
                  `${activeSession.estimatedMinutes - timeToUse}m under`}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.isDark ? '#444' : '#ddd' }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.endButton, { backgroundColor: theme.buttonBackground }]}
              onPress={handleEndSession}
            >
              <Text style={[styles.endButtonText, { color: theme.buttonText }]}>
                End Session
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
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  sessionInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sessionLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 2,
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  adjustmentSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    marginBottom: 8,
  },
  adjustInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
  },
  previewContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    marginBottom: 20,
  },
  previewText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 2,
  },
  buttonContainer: {
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
    fontSize: 16,
    fontWeight: '500',
  },
  endButton: {
    flex: 0.55,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EndSessionModal;