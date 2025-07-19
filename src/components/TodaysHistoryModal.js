// src/components/TodaysHistoryModal.js
import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
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
import TimeDataService, {
  ELECTRONIC_LABELS,
} from '../services/TimeDataService';
import EditSessionModal from './EditSessionModal';

const TodaysHistoryModal = ({
  visible,
  onClose,
  selectedDate = null,
  dayData = null,
  onHistoryUpdate = null,
}) => {
  const { theme } = useTheme();
  const [timeSummary, setTimeSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  useEffect(() => {
    if (visible) {
      if (selectedDate && dayData) {
        // Use provided historical data
        setTimeSummary(dayData);
        setLoading(false);
      } else {
        // Load today's data
        loadTimeSummary();
      }
    }
  }, [visible, selectedDate, dayData]);

  const loadTimeSummary = async () => {
    try {
      const data = await TimeDataService.getTodayData();
      setTimeSummary(data);
    } catch (error) {
      console.error("Error loading today's data:", error);
      Alert.alert('Error', "Failed to load today's history");
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button press
  const handleEditPress = activity => {
    setEditingActivity(activity);
    setEditModalVisible(true);
  };

  // Handle successful edit completion
  const handleEditComplete = async () => {
    await loadTimeSummary(); // Refresh the data
    setEditModalVisible(false);
    setEditingActivity(null);

    // Notify parent component to refresh its data
    if (onHistoryUpdate) {
      onHistoryUpdate();
    }
  };

  // Handle edit modal close
  const handleEditClose = () => {
    setEditModalVisible(false);
    setEditingActivity(null);
  };

  // Format time for display
  const formatTime = minutes => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format timestamp for display
  const formatTimestamp = timestamp => {
    // 🔧 FIX: Use Luxon for timezone-aware time formatting
    const date = DateTime.fromISO(timestamp);
    return date.toFormat('h:mm a');
  };

  // Get all activities sorted by timestamp
  const getAllActivities = () => {
    if (!timeSummary) return [];

    const activities = [];

    // Add electronic usage sessions AND parent actions
    if (timeSummary.activities && timeSummary.activities.length > 0) {
      timeSummary.activities.forEach(activity => {
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
        } else if (activity.type === 'parent_action') {
          // 🔧 ADD: Handle parent actions (punishments/bonuses)
          activities.push({
            type: 'parent_action',
            action: activity.action,
            minutes: activity.minutes,
            reason: activity.reason,
            appliedBy: activity.appliedBy,
            timestamp: activity.timestamp,
          });
        }
      });
    }

    // 🔧 FIX: Add ALL bonus activities dynamically from timeSummary.bonusTime
    if (timeSummary.bonusTime) {
      Object.keys(timeSummary.bonusTime).forEach(activityType => {
        // Skip the aggregate totals (they start with 'total' or 'max')
        if (
          activityType.startsWith('total') ||
          activityType.startsWith('max')
        ) {
          return;
        }

        const bonusData = timeSummary.bonusTime[activityType];
        if (bonusData && bonusData.activityMinutes > 0) {
          activities.push({
            type: 'bonus',
            category: activityType,
            activityMinutes: bonusData.activityMinutes,
            bonusEarned: bonusData.earned,
            ratio: bonusData.ratio || 0.5, // Default ratio if not provided
            label: bonusData.label || activityType, // Use label if available
            timestamp: timeSummary.updatedAt,
          });
        }
      });
    }

    // Sort by timestamp (newest first)
    return activities.sort(
      (a, b) => DateTime.fromISO(b.timestamp).toMillis() - DateTime.fromISO(a.timestamp).toMillis(),
    );
  };

  // Render electronic usage activity
  const renderElectronicActivity = activity => {
    const deviceName = ELECTRONIC_LABELS[activity.category];
    const isOverTime = activity.actualMinutes > activity.estimatedMinutes;
    const timeDifference = activity.actualMinutes - activity.estimatedMinutes;

    return (
      <View
        style={[
          styles.activityCard,
          {
            backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              📱 {deviceName} Session
            </Text>
            <Text
              style={[styles.activityTime, { color: theme.text, opacity: 0.6 }]}
            >
              {formatTimestamp(activity.startTime)} -{' '}
              {formatTimestamp(activity.endTime)}
            </Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={[styles.timeUsed, { color: '#F44336' }]}>
              -{formatTime(activity.actualMinutes)}
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPress(activity)}
            >
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <Text
            style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}
          >
            Estimated: {formatTime(activity.estimatedMinutes)}
          </Text>
          <Text
            style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}
          >
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

  // Render parent action (punishment/bonus)
  const renderParentAction = activity => {
    const isPunishment = activity.action === 'punishment';
    const isBonus = activity.action === 'bonus';
    
    const getActionInfo = () => {
      if (isPunishment) {
        return {
          emoji: '⚠️',
          title: 'Punishment',
          color: '#F44336',
          sign: '-',
        };
      } else if (isBonus) {
        return {
          emoji: '🎁',
          title: 'Bonus Time',
          color: '#4CAF50',
          sign: '+',
        };
      } else {
        return {
          emoji: '👨‍👩‍👧‍👦',
          title: 'Parent Action',
          color: '#2196F3',
          sign: '',
        };
      }
    };

    const { emoji, title, color, sign } = getActionInfo();

    return (
      <View
        style={[
          styles.activityCard,
          {
            backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)',
            borderLeftWidth: 4,
            borderLeftColor: color,
          },
        ]}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              {emoji} {title}
            </Text>
            <Text
              style={[styles.activityTime, { color: theme.text, opacity: 0.6 }]}
            >
              {formatTimestamp(activity.timestamp)} • Applied by {activity.appliedBy}
            </Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={[styles.timeUsed, { color }]}>
              {sign}{formatTime(Math.abs(activity.minutes))}
            </Text>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <Text
            style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}
          >
            Reason: {activity.reason}
          </Text>
          {isPunishment && (
            <Text style={[styles.detailText, { color: '#F44336' }]}>
              Time deducted from available balance
            </Text>
          )}
          {isBonus && (
            <Text style={[styles.detailText, { color: '#4CAF50' }]}>
              Bonus time added to available balance
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render bonus activity
  const renderBonusActivity = activity => {
    // Get emoji and name for activity type
    const getActivityInfo = activityType => {
      const emojiMap = {
        soccer: { emoji: '⚽', name: 'Soccer' },
        fitness: { emoji: '💪', name: 'Fitness' },
        reading: { emoji: '📚', name: 'Reading' },
        swimming: { emoji: '🏊', name: 'Swimming' },
        running: { emoji: '🏃', name: 'Running' },
        cycling: { emoji: '🚴', name: 'Cycling' },
        basketball: { emoji: '🏀', name: 'Basketball' },
        tennis: { emoji: '🎾', name: 'Tennis' },
      };

      const info = emojiMap[activityType];
      if (info) return info;

      // Fallback for unknown activity types
      return {
        emoji: '🎯',
        name:
          activity.label ||
          activityType.charAt(0).toUpperCase() + activityType.slice(1),
      };
    };

    const { emoji, name } = getActivityInfo(activity.category);

    // Calculate ratio display
    const getRatioDisplay = ratio => {
      if (ratio === 1) return '1:1 ratio';
      if (ratio === 0.5) return '2:1 ratio';
      if (ratio === 0.25) return '4:1 ratio';
      return `${Math.round(1 / ratio)}:1 ratio`;
    };

    return (
      <View
        style={[
          styles.activityCard,
          {
            backgroundColor: theme.isDark
              ? '#1A3A1A'
              : 'rgba(76, 175, 80, 0.1)',
          },
        ]}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              {emoji} {name} Activity
            </Text>
            <Text
              style={[styles.activityTime, { color: theme.text, opacity: 0.6 }]}
            >
              {formatTimestamp(activity.timestamp)}
            </Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={[styles.timeEarned, { color: '#4CAF50' }]}>
              +{formatTime(activity.bonusEarned)}
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPress(activity)}
            >
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.activityDetails}>
          <Text
            style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}
          >
            Activity time: {formatTime(activity.activityMinutes)}
          </Text>
          <Text
            style={[styles.detailText, { color: theme.text, opacity: 0.7 }]}
          >
            Bonus earned: {formatTime(activity.bonusEarned)} (capped at daily
            limit)
          </Text>
          <Text style={[styles.detailText, { color: '#4CAF50' }]}>
            {getRatioDisplay(activity.ratio)}
          </Text>
        </View>
      </View>
    );
  };

  // Calculate daily totals
  const getDailyTotals = () => {
    if (!timeSummary) return { timeUsed: 0, bonusEarned: 0, activities: 0 };

    // Calculate total time used from base + all bonus used
    let totalBonusUsed = 0;
    let totalBonusEarned = 0;
    let bonusActivitiesCount = 0;

    if (timeSummary.bonusTime) {
      Object.keys(timeSummary.bonusTime).forEach(activityType => {
        // Skip aggregate totals
        if (
          activityType.startsWith('total') ||
          activityType.startsWith('max')
        ) {
          return;
        }

        const bonusData = timeSummary.bonusTime[activityType];
        if (bonusData) {
          totalBonusUsed += bonusData.used || 0;
          totalBonusEarned += bonusData.earned || 0;
          if (bonusData.activityMinutes > 0) {
            bonusActivitiesCount++;
          }
        }
      });
    }

    const timeUsed = timeSummary.baseTimeUsed + totalBonusUsed;

    // Use the total from timeSummary if available, otherwise calculate manually
    const bonusEarned = timeSummary.bonusTime?.totalEarned || totalBonusEarned;

    const activities =
      (timeSummary.activities ? timeSummary.activities.length : 0) +
      bonusActivitiesCount;

    return { timeUsed, bonusEarned, activities };
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.menuBackground },
            ]}
          >
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  const activities = getAllActivities();
  const totals = getDailyTotals();

  return (
    <>
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
                {selectedDate
                  ? DateTime.fromISO(selectedDate).toLocaleString({
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : "Today's History"}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.closeButton, { color: theme.text }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Daily Summary */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.isDark
                    ? '#333'
                    : 'rgba(255,255,255,0.8)',
                },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                Daily Summary
              </Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                    {formatTime(totals.timeUsed)}
                  </Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.text, opacity: 0.7 },
                    ]}
                  >
                    Time Used
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                    {formatTime(totals.bonusEarned)}
                  </Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.text, opacity: 0.7 },
                    ]}
                  >
                    Bonus Earned
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {totals.activities}
                  </Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.text, opacity: 0.7 },
                    ]}
                  >
                    Activities
                  </Text>
                </View>
              </View>
            </View>

            {/* Activities List */}
            <ScrollView
              style={styles.activitiesList}
              showsVerticalScrollIndicator={false}
            >
              {activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.text, opacity: 0.6 },
                    ]}
                  >
                    No activities logged today
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtext,
                      { color: theme.text, opacity: 0.4 },
                    ]}
                  >
                    Start a session or log some activities to see your history
                    here!
                  </Text>
                </View>
              ) : (
                activities.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    {activity.type === 'electronic'
                      ? renderElectronicActivity(activity)
                      : activity.type === 'parent_action'
                      ? renderParentAction(activity)
                      : renderBonusActivity(activity)}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={[
                styles.closeButtonLarge,
                { backgroundColor: theme.buttonBackground },
              ]}
              onPress={onClose}
            >
              <Text
                style={[styles.closeButtonText, { color: theme.buttonText }]}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Session Modal */}
      <EditSessionModal
        visible={editModalVisible}
        activity={editingActivity}
        onClose={handleEditClose}
        onSave={handleEditComplete}
      />
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
    flexDirection: 'row',
    gap: 10,
  },
  timeUsed: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeEarned: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  editButtonText: {
    fontSize: 14,
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