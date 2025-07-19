// src/components/ElectronicUsageModal.js
import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import TimeDataService, {
  ELECTRONIC_CATEGORIES,
  ELECTRONIC_LABELS,
} from '../services/TimeDataService';

const ElectronicUsageModal = ({
  visible,
  onClose,
  onSessionUpdate,
  timeSummary,
}) => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState(
    ELECTRONIC_CATEGORIES.TABLET,
  );
  const [selectedTime, setSelectedTime] = useState(30);
  const [customTime, setCustomTime] = useState('');
  const [isUsingCustom, setIsUsingCustom] = useState(false);

  // Quick time options that don't exceed remaining time
  const getAvailableTimeOptions = () => {
    if (!timeSummary) return [];

    const options = [15, 30, 60, 120]; // 15min, 30min, 1hr, 2hr
    return options.filter(time => time <= timeSummary.totals.remaining);
  };

  // Format end time for display
  const getEstimatedEndTime = minutes => {
    const now = DateTime.local();
    const endTime = now.plus({ minutes });
    return endTime.toFormat('h:mm a'); // Returns "2:30 PM" format
  };

  // Get the time to use (either selected preset or custom)
  const getTimeToUse = () => {
    if (isUsingCustom) {
      return parseInt(customTime) || 0;
    }
    return selectedTime;
  };

  // Calculate remaining time after this session
  const getRemainingAfterSession = () => {
    if (!timeSummary) return 0;
    return Math.max(0, timeSummary.totals.remaining - getTimeToUse());
  };

  const handleStartSession = async () => {
    const timeToUse = getTimeToUse();

    if (timeToUse <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid time amount.');
      return;
    }

    if (timeToUse > timeSummary.totals.remaining) {
      Alert.alert(
        'Not Enough Time',
        `You only have ${timeSummary.totals.remaining} minutes remaining.`,
      );
      return;
    }

    const endTimeString = getEstimatedEndTime(timeToUse);
    const deviceName = ELECTRONIC_LABELS[selectedCategory];

    Alert.alert(
      'Start Session',
      `Start ${timeToUse} minute ${deviceName} session?\n\nFinish by: ${endTimeString}\nTime remaining after: ${getRemainingAfterSession()} minutes`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Session',
          onPress: async () => {
            const result = await TimeDataService.startElectronicSession(
              selectedCategory,
              timeToUse,
            );

            if (result.success) {
              onSessionUpdate();
              onClose();
              Alert.alert(
                'Session Started!',
                `${deviceName} session started. Come back to end your session when finished.`,
              );
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setSelectedCategory(ELECTRONIC_CATEGORIES.TABLET);
    setSelectedTime(30);
    setCustomTime('');
    setIsUsingCustom(false);
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  const availableOptions = getAvailableTimeOptions();
  const timeToUse = getTimeToUse();
  const isValidTime =
    timeToUse > 0 && timeToUse <= (timeSummary?.totals.remaining || 0);

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
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Electronic Usage
          </Text>
          <Text
            style={[styles.timeRemaining, { color: theme.text, opacity: 0.7 }]}
          >
            {timeSummary?.totals.remaining || 0} minutes remaining today
          </Text>

          {/* Device Selection */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            Device:
          </Text>
          <View
            style={[
              styles.pickerContainer,
              { backgroundColor: theme.isDark ? '#333' : '#f5f5f5' },
            ]}
          >
            <Picker
              selectedValue={selectedCategory}
              onValueChange={setSelectedCategory}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
            >
              {Object.entries(ELECTRONIC_LABELS).map(([key, label]) => (
                <Picker.Item key={key} label={label} value={key} />
              ))}
            </Picker>
          </View>

          {/* Time Selection */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            Estimated Time:
          </Text>

          {/* Quick Time Buttons */}
          {availableOptions.length > 0 && (
            <View style={styles.quickTimeContainer}>
              {availableOptions.map(time => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.quickTimeButton,
                    {
                      backgroundColor:
                        !isUsingCustom && selectedTime === time
                          ? theme.buttonBackground
                          : theme.isDark
                          ? '#333'
                          : '#f5f5f5',
                    },
                  ]}
                  onPress={() => {
                    setSelectedTime(time);
                    setIsUsingCustom(false);
                    setCustomTime('');
                  }}
                >
                  <Text
                    style={[
                      styles.quickTimeText,
                      {
                        color:
                          !isUsingCustom && selectedTime === time
                            ? theme.buttonText
                            : theme.text,
                      },
                    ]}
                  >
                    {time}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Custom Time Input */}
          <Text style={[styles.customLabel, { color: theme.text }]}>
            Or enter custom minutes:
          </Text>
          <TextInput
            style={[
              styles.customInput,
              {
                backgroundColor: theme.isDark ? '#333' : '#f5f5f5',
                color: theme.text,
                borderColor: isUsingCustom
                  ? theme.buttonBackground
                  : 'transparent',
              },
            ]}
            value={customTime}
            onChangeText={text => {
              setCustomTime(text);
              setIsUsingCustom(text.length > 0);
            }}
            placeholder="Minutes..."
            placeholderTextColor={theme.isDark ? '#999' : '#666'}
            keyboardType="numeric"
          />

          {/* Time Preview */}
          {isValidTime && (
            <View style={styles.previewContainer}>
              <Text
                style={[
                  styles.previewText,
                  { color: theme.text, opacity: 0.8 },
                ]}
              >
                Finish by: {getEstimatedEndTime(timeToUse)}
              </Text>
              <Text
                style={[
                  styles.previewText,
                  { color: theme.text, opacity: 0.8 },
                ]}
              >
                Will leave you: {getRemainingAfterSession()} minutes
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { backgroundColor: theme.isDark ? '#444' : '#ddd' },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.startButton,
                {
                  backgroundColor: isValidTime
                    ? theme.buttonBackground
                    : '#999',
                },
              ]}
              onPress={handleStartSession}
              disabled={!isValidTime}
            >
              <Text
                style={[styles.startButtonText, { color: theme.buttonText }]}
              >
                Start Session
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
    marginBottom: 8,
  },
  timeRemaining: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  quickTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickTimeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  quickTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  customInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  previewText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  startButton: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ElectronicUsageModal;
