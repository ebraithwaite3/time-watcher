// src/components/QuickAddSessionModal.js
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
import TimeDataService, {
  ELECTRONIC_CATEGORIES,
  ELECTRONIC_LABELS,
} from '../services/TimeDataService';
import { Picker } from '@react-native-picker/picker';

const QuickAddSessionModal = ({
  visible,
  onClose,
  onSessionAdded,
  timeSummary,
}) => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [timeUsed, setTimeUsed] = useState('');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('PM');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Generate hours 1-12
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  // Generate minutes 0-59
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const periods = ['AM', 'PM'];

  // Reset modal state when it opens
  React.useEffect(() => {
    if (visible) {
      setSelectedCategory(null);
      setTimeUsed('');
      setSelectedHour(12);
      setSelectedMinute(0);
      setSelectedPeriod('PM');
      setShowDeviceDropdown(false);
      setShowTimePickerModal(false);
    }
  }, [visible]);

  const handleDeviceSelect = category => {
    setSelectedCategory(category);
    setShowDeviceDropdown(false);
  };

  const getSelectedStartTime = () => {
    // 🔧 FIX: Use Luxon for local timezone instead of UTC
    const today = DateTime.local();
    const hour24 =
      selectedPeriod === 'AM'
        ? selectedHour === 12
          ? 0
          : selectedHour
        : selectedHour === 12
        ? 12
        : selectedHour + 12;
  
    // Create start time in local timezone
    const startTime = today.set({
      hour: hour24,
      minute: selectedMinute,
      second: 0,
      millisecond: 0
    });
  
    return startTime.toJSDate(); // Convert to JS Date if needed for compatibility
  };

  const formatSelectedTime = () => {
    return `${selectedHour}:${selectedMinute
      .toString()
      .padStart(2, '0')} ${selectedPeriod}`;
  };

  const handleAddSession = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a device');
      return;
    }

    const minutes = parseInt(timeUsed);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert('Error', 'Please enter a valid number of minutes');
      return;
    }

    if (minutes > timeSummary.totals.remaining) {
      Alert.alert(
        'Not Enough Time',
        `You only have ${timeSummary.totals.remaining} minutes remaining today. You entered ${minutes} minutes.`,
      );
      return;
    }

    setSaving(true);

    try {
      console.log(`🧪 About to call TimeDataService.quickAddElectronicSession: ${selectedCategory}, ${minutes} min`);
      
      // 🔧 FIXED: Use the proper TimeDataService method instead of manual logic
      const result = await TimeDataService.quickAddElectronicSession(selectedCategory, minutes);
      
      if (result.success) {
        console.log('✅ Quick add successful:', result);
        
        // Close modal and notify parent
        onClose();
        onSessionAdded();

        Alert.alert(
          'Session Added',
          `Added ${minutes} minutes of ${ELECTRONIC_LABELS[selectedCategory]} usage. ${result.syncedToRedis ? '✅ Synced to server.' : '⚠️ Saved locally.'}`,
        );
      } else {
        console.error('❌ Quick add failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to add session');
      }
    } catch (error) {
      console.error('❌ Error adding quick session:', error);
      Alert.alert('Error', 'Failed to add session');
    } finally {
      setSaving(false);
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
              Quick Add Session
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }]}>
            Log a session you forgot to track
          </Text>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Device Selection Dropdown */}
            <Text style={[styles.label, { color: theme.text }]}>Device:</Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                  borderColor: theme.isDark ? '#666' : '#ddd',
                },
              ]}
              onPress={() => setShowDeviceDropdown(!showDeviceDropdown)}
            >
              <Text style={[styles.dropdownText, { color: theme.text }]}>
                {selectedCategory
                  ? ELECTRONIC_LABELS[selectedCategory]
                  : 'Select device...'}
              </Text>
              <Text style={[styles.dropdownArrow, { color: theme.text }]}>
                {showDeviceDropdown ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showDeviceDropdown && (
              <View
                style={[
                  styles.dropdownOptions,
                  {
                    backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                    borderColor: theme.isDark ? '#666' : '#ddd',
                  },
                ]}
              >
                {Object.entries(ELECTRONIC_CATEGORIES).map(
                  ([key, category]) => (
                    <TouchableOpacity
                      key={category}
                      style={styles.dropdownOption}
                      onPress={() => handleDeviceSelect(category)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          { color: theme.text },
                        ]}
                      >
                        {ELECTRONIC_LABELS[category]}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            )}

            {/* Time Input */}
            <Text style={[styles.label, { color: theme.text }]}>
              Time used (minutes):
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
              value={timeUsed}
              onChangeText={setTimeUsed}
              keyboardType="numeric"
              placeholder="Enter minutes"
              placeholderTextColor={theme.text + '80'}
              maxLength={3}
            />

            {/* Start Time Picker */}
            <Text style={[styles.label, { color: theme.text }]}>
              When did you start?
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: theme.isDark ? '#444' : '#f5f5f5',
                  borderColor: theme.isDark ? '#666' : '#ddd',
                },
              ]}
              onPress={() => setShowTimePickerModal(true)}
            >
              <Text style={[styles.dropdownText, { color: theme.text }]}>
                {formatSelectedTime()}
              </Text>
              <Text style={[styles.dropdownArrow, { color: theme.text }]}>
                ⏰
              </Text>
            </TouchableOpacity>

            {/* Time Remaining Info */}
            {timeSummary && (
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: theme.isDark
                      ? '#2A2A2A'
                      : 'rgba(255,255,255,0.8)',
                  },
                ]}
              >
                <Text
                  style={[styles.infoText, { color: theme.text, opacity: 0.7 }]}
                >
                  You have {formatTime(timeSummary.totals.remaining)} remaining
                  today
                </Text>
                {timeUsed && !isNaN(parseInt(timeUsed)) && (
                  <Text
                    style={[
                      styles.infoText,
                      {
                        color:
                          parseInt(timeUsed) > timeSummary.totals.remaining
                            ? '#F44336'
                            : '#4CAF50',
                      },
                    ]}
                  >
                    After adding:{' '}
                    {formatTime(
                      Math.max(
                        0,
                        timeSummary.totals.remaining - parseInt(timeUsed),
                      ),
                    )}{' '}
                    remaining
                  </Text>
                )}
              </View>
            )}

            {/* Bottom spacing for scroll */}
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
                styles.addButton,
                { backgroundColor: theme.buttonBackground },
                saving && styles.disabledButton,
              ]}
              onPress={handleAddSession}
              disabled={
                saving ||
                !selectedCategory ||
                !timeUsed ||
                isNaN(parseInt(timeUsed)) ||
                parseInt(timeUsed) <= 0
              }
            >
              <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
                {saving ? 'Adding...' : 'Add Session'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePickerModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.timePickerOverlay}>
          <View
            style={[
              styles.timePickerContainer,
              { backgroundColor: theme.menuBackground },
            ]}
          >
            <Text style={[styles.timePickerTitle, { color: theme.text }]}>
              Select Start Time
            </Text>

            <View style={{ marginTop: 20 }}>
              <Text style={[styles.timePickerTitle, { color: theme.text }]}>
                Select Start Time
              </Text>

              <View style={styles.nativePickerRow}>
                {/* Hour Picker */}
                <Picker
                  selectedValue={selectedHour}
                  onValueChange={value => setSelectedHour(value)}
                  style={styles.nativePicker}
                  dropdownIconColor={theme.text}
                  mode="dropdown"
                >
                  {hours.map(hour => (
                    <Picker.Item key={hour} label={`${hour}`} value={hour} />
                  ))}
                </Picker>

                {/* Minute Picker */}
                <Picker
                  selectedValue={selectedMinute}
                  onValueChange={value => setSelectedMinute(value)}
                  style={styles.nativePicker}
                  dropdownIconColor={theme.text}
                  mode="dropdown"
                >
                  {minutes.map(minute => (
                    <Picker.Item
                      key={minute}
                      label={minute.toString().padStart(2, '0')}
                      value={minute}
                    />
                  ))}
                </Picker>

                {/* AM/PM Picker */}
                <Picker
                  selectedValue={selectedPeriod}
                  onValueChange={value => setSelectedPeriod(value)}
                  style={styles.nativePicker}
                  dropdownIconColor={theme.text}
                  mode="dropdown"
                >
                  {periods.map(period => (
                    <Picker.Item key={period} label={period} value={period} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.timePickerButtons}>
              <TouchableOpacity
                style={[styles.timePickerButton, styles.cancelButton]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.timePickerButton,
                  { backgroundColor: theme.buttonBackground },
                ]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text
                  style={[styles.submitButtonText, { color: theme.buttonText }]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: 350,
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
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownArrow: {
    fontSize: 12,
  },
  dropdownOptions: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dropdownOptionText: {
    fontSize: 16,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  infoCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
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
  addButton: {
    // backgroundColor handled by theme
  },
  addButtonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    width: '90%',
    maxWidth: 350,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nativePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  nativePicker: {
    flex: 1,
    height: 50,
    marginHorizontal: 6,
  },
  timePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  timePickerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontWeight: '600',
  },
});

export default QuickAddSessionModal;