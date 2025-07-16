// src/components/TodaysHistoryModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService, { ELECTRONIC_LABELS } from '../services/TimeDataService';

const TodaysHistoryModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadTodaysData();
    }
  }, [visible]);

  const loadTodaysData = async () => {
    try {
      setLoading(true);
      const data = await TimeDataService.getTodayData();
      setDayData(data);
    } catch (error) {
      console.error('Error loading today\'s data:', error);
      Alert.alert('Error', 'Failed to load today\'s history');
    } finally {
      setLoading(false);
    }
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

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get all activities sorted by timestamp
  const getAllActivities = () => {
    if (!dayData) return [];

    const activities = [];

    // Add electronic usage sessions
    if (dayData.activities && dayData.activities.length > 0) {
      dayData.activities.forEach(activity => {
        if (activity.type === 'electronic') {
          activities.push({
            type: 'electronic',
            category: activity.category,
            startTime: activity.startTime,
            endTime: activity.endTime,
            estimatedMinutes: activity.estimatedMinutes,
            actualMinutes: activity.actualMinutes,
            timestamp: activity.timestamp,
            timeDeducted: activity.actualMinutes,
          });
        }
      });
    }

    // Add bonus activities (we'll need to track these separately)
    // For now, we'll create them from the current totals
    if (dayData.bonusTime.soccer.activityMinutes > 0) {
      activities.push({
        type: 'bonus',
        category: 'soccer',
        activityMinutes: dayData.bonusTime.soccer.activityMinutes,
        bonusEarned: dayData.bonusTime.soccer.earned, // Use actual earned, not calculated
        timestamp: dayData.updatedAt, // Approximate timestamp
      });
    }

    if (dayData.bonusTime.fitness.activityMinutes > 0) {
      activities.push({
        type: 'bonus',
        category: 'fitness',
        activityMinutes: dayData.bonusTime.fitness.activityMinutes,
        bonusEarned: dayData.bonusTime.fitness.earned, // Use actual earned, not calculated
        timestamp: dayData.updatedAt, // Approximate timestamp
      });
    }

    // Sort by timestamp (newest first)
    return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  // Render electronic usage activity
  const renderElectronicActivity = (activity) => {
    const deviceName = ELECTRONIC_LABELS[activity.category];
    const isOverTime = activity.actualMinutes > activity.estimatedMinutes;
    const timeDifference = activity.actualMinutes - activity.estimatedMinutes;

    return (
      <View style={[styles.activityCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              📱 {deviceName} Session
            </Text>
            <Text style={[styles.activityTime, { color: theme.text, opacity: 0.6 }]}>
              {formatTimestamp(activity.startTime)} - {formatTimestamp(activity.endTime)}
            </Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={[styles.timeUsed, { color: '#F44336' }]}>
              -{formatTime(activity.actualMinutes)}
            </Text>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <Text style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}>
            Estimated: {formatTime(activity.estimatedMinutes)}
          </Text>
          <Text style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}>
            Actual: {formatTime(activity.actualMinutes)}
          </Text>
          {isOverTime && (
            <Text style={[styles.detailText, { color: '#FF9800' }]}>
              {formatTime(timeDifference)} over estimate
            </Text>
          )}
          {!isOverTime && timeDifference < 0 && (
            <Text style={[styles.detailText, { color: '#4CAF50' }]}>
              {formatTime(Math.abs(timeDifference))} under estimate
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render bonus activity
  const renderBonusActivity = (activity) => {
    const activityName = activity.category === 'soccer' ? 'Soccer' : 'Fitness';
    const emoji = activity.category === 'soccer' ? '⚽' : '💪';

    return (
      <View style={[styles.activityCard, { backgroundColor: theme.isDark ? '#1A3A1A' : 'rgba(76, 175, 80, 0.1)' }]}>
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              {emoji} {activityName} Activity
            </Text>
            <Text style={[styles.activityTime, { color: theme.text, opacity: 0.6 }]}>
              {formatTimestamp(activity.timestamp)}
            </Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={[styles.timeEarned, { color: '#4CAF50' }]}>
              +{formatTime(activity.bonusEarned)}
            </Text>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <Text style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}>
            Activity time: {formatTime(activity.activityMinutes)}
          </Text>
          <Text style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}>
            Bonus earned: {formatTime(activity.bonusEarned)} (capped at daily limit)
          </Text>
          <Text style={[styles.detailText, { color: '#4CAF50' }]}>
            Ratio: 1 min bonus per 2 min activity
          </Text>
        </View>
      </View>
    );
  };

  // Calculate daily totals
  const getDailyTotals = () => {
    if (!dayData) return { timeUsed: 0, bonusEarned: 0, activities: 0 };

    const timeUsed = dayData.baseTimeUsed + 
                    dayData.bonusTime.soccer.used + 
                    dayData.bonusTime.fitness.used;
    
    // Calculate total bonus but cap at 30 minutes (daily limit)
    const totalBonusEarned = dayData.bonusTime.soccer.earned + 
                           dayData.bonusTime.fitness.earned;
    const bonusEarned = Math.min(totalBonusEarned, 30);

    const activities = (dayData.activities ? dayData.activities.length : 0) +
                      (dayData.bonusTime.soccer.activityMinutes > 0 ? 1 : 0) +
                      (dayData.bonusTime.fitness.activityMinutes > 0 ? 1 : 0);

    return { timeUsed, bonusEarned, activities };
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.menuBackground }]}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const activities = getAllActivities();
  const totals = getDailyTotals();

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
          <View style={styles.header}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Today's History
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Daily Summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.isDark ? '#333' : 'rgba(255,255,255,0.8)' }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Daily Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                  {formatTime(totals.timeUsed)}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text, opacity: 0.7 }]}>
                  Time Used
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatTime(totals.bonusEarned)}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text, opacity: 0.7 }]}>
                  Bonus Earned
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {totals.activities}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text, opacity: 0.7 }]}>
                  Activities
                </Text>
              </View>
            </View>
          </View>

          {/* Activities List */}
          <ScrollView style={styles.activitiesList} showsVerticalScrollIndicator={false}>
            {activities.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.text, opacity: 0.6 }]}>
                  No activities logged today
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.text, opacity: 0.4 }]}>
                  Start a session or log some activities to see your history here!
                </Text>
              </View>
            ) : (
              activities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  {activity.type === 'electronic' 
                    ? renderElectronicActivity(activity)
                    : renderBonusActivity(activity)
                  }
                </View>
              ))
            )}
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity 
            style={[styles.closeButtonLarge, { backgroundColor: theme.buttonBackground }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.buttonText }]}>
              Close
            </Text>
          </TouchableOpacity>

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
    width: '95%',
    maxWidth: 500,
    height: '90%',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 5,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  activitiesList: {
    flex: 1,
    marginBottom: 20,
  },
  activityItem: {
    marginBottom: 12,
  },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
  },
  activityStats: {
    alignItems: 'flex-end',
  },
  timeUsed: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeEarned: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  activityDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 12,
    marginBottom: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  closeButtonLarge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TodaysHistoryModal;