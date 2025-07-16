// src/components/EarnBonusModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService from '../services/TimeDataService';

const EarnBonusModal = ({ visible, onClose, onBonusEarned, timeSummary }) => {
  const { theme } = useTheme();
  const [selectedActivity, setSelectedActivity] = useState('soccer');
  const [activityMinutes, setActivityMinutes] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedActivity('soccer');
      setActivityMinutes('');
    }
  }, [visible]);

  // Calculate bonus minutes from activity minutes
  const calculateBonus = (minutes) => {
    if (!minutes || minutes <= 0) return 0;
    return Math.floor(minutes * 0.5); // 1 bonus minute per 2 activity minutes
  };

  // Get current progress for selected activity
  const getCurrentProgress = () => {
    if (!timeSummary) return { earned: 0, activityMinutes: 0, maxPossible: 30 };
    
    const activity = timeSummary.bonusTime[selectedActivity];
    return {
      earned: activity.earned,
      activityMinutes: activity.activityMinutes,
      maxPossible: 30,
    };
  };

  // Calculate remaining potential bonus
  const getRemainingPotential = () => {
    const progress = getCurrentProgress();
    const totalBonusEarned = timeSummary ? timeSummary.bonusTime.totalEarned : 0;
    
    // Can't exceed 30 minutes for this activity
    const activityLimit = Math.max(0, progress.maxPossible - progress.earned);
    
    // Can't exceed 30 minutes total bonus
    const totalLimit = Math.max(0, 30 - totalBonusEarned);
    
    return Math.min(activityLimit, totalLimit);
  };

  // Get bonus that would be earned from current input
  const getBonusFromInput = () => {
    const inputMinutes = parseInt(activityMinutes) || 0;
    const potentialBonus = calculateBonus(inputMinutes);
    const remainingPotential = getRemainingPotential();
    
    return Math.min(potentialBonus, remainingPotential);
  };

  // Handle activity submission
  const handleSubmit = async () => {
    const minutes = parseInt(activityMinutes);
    
    if (!minutes || minutes <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of minutes.');
      return;
    }

    if (minutes > 300) { // 5 hours seems reasonable max
      Alert.alert('Too Much Time', 'Please enter a more reasonable amount of time (under 5 hours).');
      return;
    }

    const bonusEarned = getBonusFromInput();
    const activityName = selectedActivity === 'soccer' ? 'Soccer' : 'Fitness';
    
    Alert.alert(
      'Log Activity',
      `Log ${minutes} minutes of ${activityName}?\n\nBonus earned: +${bonusEarned} minutes`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Activity',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await TimeDataService.addActivityTime(selectedActivity, minutes);
              
              if (result.success) {
                onBonusEarned(); // Refresh dashboard
                onClose();
                
                let message = `Great job! You earned ${result.bonusEarnedThisSession} bonus minutes.`;
                if (result.bonusCapReached) {
                  message += `\n\nYou've reached your daily bonus limit!`;
                }
                
                Alert.alert('Activity Logged!', message);
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to log activity. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const progress = getCurrentProgress();
  const remainingPotential = getRemainingPotential();
  const bonusFromInput = getBonusFromInput();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.menuBackground }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            
            {/* Header */}
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Earn Bonus Time
            </Text>
            <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }]}>
              1 minute bonus for every 2 minutes of activity
            </Text>

            {/* Activity Selection */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Activity:</Text>
            <View style={styles.activityButtons}>
              <TouchableOpacity
                style={[
                  styles.activityButton,
                  {
                    backgroundColor: selectedActivity === 'soccer' 
                      ? theme.buttonBackground 
                      : theme.isDark ? '#333' : '#f5f5f5',
                  }
                ]}
                onPress={() => setSelectedActivity('soccer')}
              >
                <Text style={[
                  styles.activityButtonText,
                  {
                    color: selectedActivity === 'soccer' 
                      ? theme.buttonText 
                      : theme.text,
                  }
                ]}>
                  ⚽ Soccer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.activityButton,
                  {
                    backgroundColor: selectedActivity === 'fitness' 
                      ? theme.buttonBackground 
                      : theme.isDark ? '#333' : '#f5f5f5',
                  }
                ]}
                onPress={() => setSelectedActivity('fitness')}
              >
                <Text style={[
                  styles.activityButtonText,
                  {
                    color: selectedActivity === 'fitness' 
                      ? theme.buttonText 
                      : theme.text,
                  }
                ]}>
                  💪 Fitness
                </Text>
              </TouchableOpacity>
            </View>

            {/* Current Progress */}
            <View style={[styles.progressSection, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
              <Text style={[styles.progressTitle, { color: theme.text }]}>
                {selectedActivity === 'soccer' ? 'Soccer' : 'Fitness'} Progress Today
              </Text>
              
              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: theme.text, opacity: 0.7 }]}>
                  Activity Time:
                </Text>
                <Text style={[styles.progressValue, { color: theme.text }]}>
                  {progress.activityMinutes} min
                </Text>
              </View>
              
              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: theme.text, opacity: 0.7 }]}>
                  Bonus Earned:
                </Text>
                <Text style={[styles.progressValue, { color: '#4CAF50' }]}>
                  {progress.earned} / {progress.maxPossible} min
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={[styles.progressBarContainer, { backgroundColor: theme.isDark ? '#333' : '#E0E0E0' }]}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      backgroundColor: '#4CAF50',
                      width: `${(progress.earned / progress.maxPossible) * 100}%` 
                    }
                  ]} 
                />
              </View>

              {remainingPotential > 0 && (
                <Text style={[styles.remainingText, { color: theme.text, opacity: 0.7 }]}>
                  You can still earn {remainingPotential} more minutes
                </Text>
              )}
            </View>

            {/* Time Input */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Minutes spent on {selectedActivity === 'soccer' ? 'soccer' : 'fitness'} today:
            </Text>
            
            <TextInput
              style={[
                styles.timeInput,
                {
                  backgroundColor: theme.isDark ? '#333' : '#f5f5f5',
                  color: theme.text,
                  borderColor: theme.text,
                }
              ]}
              value={activityMinutes}
              onChangeText={setActivityMinutes}
              placeholder="Enter minutes..."
              placeholderTextColor={theme.isDark ? '#999' : '#666'}
              keyboardType="numeric"
            />

            {/* Bonus Preview */}
            {activityMinutes && bonusFromInput > 0 && (
              <View style={styles.bonusPreview}>
                <Text style={[styles.bonusPreviewText, { color: '#4CAF50' }]}>
                  🎉 You'll earn {bonusFromInput} bonus minutes!
                </Text>
              </View>
            )}

            {/* No bonus warning */}
            {activityMinutes && bonusFromInput === 0 && remainingPotential === 0 && (
              <View style={styles.bonusPreview}>
                <Text style={[styles.bonusPreviewText, { color: '#FF9800' }]}>
                  ⚠️ You've reached your daily bonus limit
                </Text>
              </View>
            )}

            {/* Quick Time Buttons */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Quick options:</Text>
            <View style={styles.quickTimeButtons}>
              {[15, 30, 60, 90].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.quickTimeButton,
                    { backgroundColor: theme.isDark ? '#333' : '#f5f5f5' }
                  ]}
                  onPress={() => setActivityMinutes(time.toString())}
                >
                  <Text style={[styles.quickTimeButtonText, { color: theme.text }]}>
                    {time}m
                  </Text>
                  <Text style={[styles.quickTimeBonus, { color: '#4CAF50' }]}>
                    +{Math.min(calculateBonus(time), remainingPotential)}
                  </Text>
                </TouchableOpacity>
              ))}
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
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: (activityMinutes && !loading) ? theme.buttonBackground : '#999',
                  }
                ]}
                onPress={handleSubmit}
                disabled={!activityMinutes || loading}
              >
                <Text style={[styles.submitButtonText, { color: theme.buttonText }]}>
                  {loading ? 'Logging...' : 'Log Activity'}
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
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
    maxHeight: '90%',
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
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  activityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  activityButton: {
    flex: 0.48,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  activityButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    marginVertical: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  remainingText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  timeInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  bonusPreview: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    marginBottom: 16,
  },
  bonusPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickTimeButton: {
    flex: 0.22,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickTimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickTimeBonus: {
    fontSize: 10,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  submitButton: {
    flex: 0.55,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EarnBonusModal;