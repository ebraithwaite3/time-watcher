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
  const [selectedActivity, setSelectedActivity] = useState('');
  const [activityMinutes, setActivityMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableActivities, setAvailableActivities] = useState([]);

  // Load available bonus activities from Redis when modal opens
  useEffect(() => {
    if (visible) {
      loadAvailableActivities();
      setActivityMinutes('');
    }
  }, [visible]);

  const loadAvailableActivities = async () => {
    try {
      const activities = await TimeDataService.getAvailableBonusActivities();
      console.log('📋 Available bonus activities:', activities);
      
      setAvailableActivities(activities);
      
      // Set default selection to first available activity
      if (activities.length > 0) {
        setSelectedActivity(activities[0].value);
      }
    } catch (error) {
      console.error('Error loading available activities:', error);
      // Fallback to default activities
      setAvailableActivities([
        { id: 'soccer', label: 'Soccer Practice', value: 'soccer', maxMinutes: 30, ratio: 0.5 },
        { id: 'fitness', label: 'Physical Activity', value: 'fitness', maxMinutes: 30, ratio: 1.0 },
        { id: 'reading', label: 'Reading Time', value: 'reading', maxMinutes: 60, ratio: 0.25 }
      ]);
      setSelectedActivity('soccer');
    }
  };

  // Get activity config for selected activity
  const getSelectedActivityConfig = () => {
    return availableActivities.find(activity => activity.value === selectedActivity) || 
           { maxMinutes: 30, ratio: 0.5, label: 'Activity' };
  };

  // Calculate bonus minutes from activity minutes using Redis ratio
  const calculateBonus = (minutes) => {
    if (!minutes || minutes <= 0) return 0;
    const config = getSelectedActivityConfig();
    return Math.floor(minutes * config.ratio);
  };

  // Get current progress for selected activity
  const getCurrentProgress = () => {
    if (!timeSummary || !selectedActivity) return { earned: 0, activityMinutes: 0, maxPossible: 30 };
    
    const activity = timeSummary.bonusTime[selectedActivity];
    const config = getSelectedActivityConfig();
    
    return {
      earned: activity?.earned || 0,
      activityMinutes: activity?.activityMinutes || 0,
      maxPossible: config.maxMinutes,
    };
  };

  // Calculate remaining potential bonus
  const getRemainingPotential = () => {
    const progress = getCurrentProgress();
    const totalBonusEarned = timeSummary ? timeSummary.bonusTime.totalEarned : 0;
    const maxTotalBonus = timeSummary ? timeSummary.bonusTime.maxTotalPossible : 30;
    
    // Can't exceed individual activity limit
    const activityLimit = Math.max(0, progress.maxPossible - progress.earned);
    
    // Can't exceed total bonus limit
    const totalLimit = Math.max(0, maxTotalBonus - totalBonusEarned);
    
    return Math.min(activityLimit, totalLimit);
  };

  // Get bonus that would be earned from current input
  const getBonusFromInput = () => {
    const inputMinutes = parseInt(activityMinutes) || 0;
    const potentialBonus = calculateBonus(inputMinutes);
    const remainingPotential = getRemainingPotential();
    
    return Math.min(potentialBonus, remainingPotential);
  };

  // Get emoji for activity type
  const getActivityEmoji = (activityType) => {
    const emojiMap = {
      soccer: '⚽',
      fitness: '💪',
      reading: '📚',
      swimming: '🏊',
      running: '🏃',
      cycling: '🚴',
      basketball: '🏀',
      tennis: '🎾'
    };
    return emojiMap[activityType] || '🎯';
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
    const config = getSelectedActivityConfig();
    
    Alert.alert(
      'Log Activity',
      `Log ${minutes} minutes of ${config.label}?\n\nBonus earned: +${bonusEarned} minutes`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Activity',
          onPress: async () => {
            setLoading(true);
            try {
              console.log(`🎯 Logging activity: ${selectedActivity}, ${minutes} minutes`);
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
              console.error('Error logging activity:', error);
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
  const config = getSelectedActivityConfig();

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
              Earn bonus minutes for physical activities and reading
            </Text>

            {/* Activity Selection */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Activity:</Text>
            <View style={styles.activityButtons}>
              {availableActivities.map((activity) => (
                <TouchableOpacity
                  key={activity.value}
                  style={[
                    styles.activityButton,
                    {
                      backgroundColor: selectedActivity === activity.value 
                        ? theme.buttonBackground 
                        : theme.isDark ? '#333' : '#f5f5f5',
                      flex: availableActivities.length === 2 ? 0.48 : 0.31, // Adjust width based on number of activities
                    }
                  ]}
                  onPress={() => setSelectedActivity(activity.value)}
                >
                  <Text style={[
                    styles.activityButtonText,
                    {
                      color: selectedActivity === activity.value 
                        ? theme.buttonText 
                        : theme.text,
                    }
                  ]}>
                    {getActivityEmoji(activity.value)} {activity.label}
                  </Text>
                  <Text style={[
                    styles.activityRatio,
                    {
                      color: selectedActivity === activity.value 
                        ? theme.buttonText 
                        : theme.text,
                      opacity: 0.7
                    }
                  ]}>
                    {activity.ratio === 1 ? '1:1' : activity.ratio === 0.5 ? '2:1' : activity.ratio === 0.25 ? '4:1' : `${1/activity.ratio}:1`} ratio
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Current Progress */}
            <View style={[styles.progressSection, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
              <Text style={[styles.progressTitle, { color: theme.text }]}>
                {config.label} Progress Today
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

              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: theme.text, opacity: 0.7 }]}>
                  Bonus Ratio:
                </Text>
                <Text style={[styles.progressValue, { color: theme.text }]}>
                  {config.ratio === 1 ? '1 min per 1 min' : config.ratio === 0.5 ? '1 min per 2 min' : config.ratio === 0.25 ? '1 min per 4 min' : `${config.ratio} min per 1 min`}
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
              
              {remainingPotential === 0 && (
                <Text style={[styles.remainingText, { color: '#FF9800' }]}>
                  Daily bonus limit reached for {config.label}
                </Text>
              )}
            </View>

            {/* Time Input */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Minutes spent on {config.label.toLowerCase()} today:
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
              {[15, 30, 60, 90].map((time) => {
                const potentialBonus = Math.min(calculateBonus(time), remainingPotential);
                return (
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
                      +{potentialBonus}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  activityButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  activityRatio: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
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