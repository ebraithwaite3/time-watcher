// src/screens/DashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService from '../services/TimeDataService';
import ElectronicUsageModal from '../components/ElectronicUsageModal';
import EndSessionModal from '../components/EndSessionModal';
import ActiveSessionBanner from '../components/ActiveSessionBanner';
import EarnBonusModal from '../components/EarnBonusModal';
import TodaysHistoryModal from '../components/TodaysHistoryModal';

const DashboardScreen = ({ userName, onNavigateToPastDays }) => {
  const { theme } = useTheme();
  const [timeSummary, setTimeSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showElectronicModal, setShowElectronicModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [showEarnBonusModal, setShowEarnBonusModal] = useState(false);
  const [showTodaysHistoryModal, setShowTodaysHistoryModal] = useState(false);

  useEffect(() => {
    loadTimeSummary();
  }, []);

  const loadTimeSummary = async () => {
    try {
      const summary = await TimeDataService.getTimeSummary();
      setTimeSummary(summary);
    } catch (error) {
      console.error('Error loading time summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleElectronicUsage = () => {
    if (timeSummary?.activeSession) {
      // If there's an active session, show end session modal
      setShowEndSessionModal(true);
    } else {
      // Otherwise show start session modal
      setShowElectronicModal(true);
    }
  };

  const handleSessionUpdate = () => {
    // Reload data when session starts/ends
    loadTimeSummary();
  };

  const handleEarnBonus = () => {
    setShowEarnBonusModal(true);
  };

  const handleBonusEarned = () => {
    // Reload data when bonus is earned
    loadTimeSummary();
  };

  const handleTodayHistory = () => {
    setShowTodaysHistoryModal(true);
  };

  const handlePastDays = () => {
    onNavigateToPastDays();
  };

  // Convert seconds to minutes and seconds display
  const formatTimeSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert minutes to hours and minutes display
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get color based on time remaining
  const getTimeColor = (remaining, total) => {
    const percentage = remaining / total;
    if (percentage > 0.5) return '#4CAF50'; // Green
    if (percentage > 0.2) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  if (!timeSummary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>Error loading data</Text>
      </View>
    );
  }

  // NOW it's safe to define and call these functions that use timeSummary
  const progressPercentage = (timeSummary.totals.used / timeSummary.totals.available) * 100;
  const timeColor = getTimeColor(timeSummary.totals.remaining, timeSummary.totals.available);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      
        {/* Active Session Banner */}
        <ActiveSessionBanner 
            activeSession={timeSummary.activeSession}
            onEndSession={() => setShowEndSessionModal(true)}
        />

        {/* Main Time Display */}
        <View style={styles.timeSection}>
            <Text style={[styles.timeLabel, { color: theme.text }]}>Time Remaining Today</Text>
            <Text style={[styles.timeRemaining, { color: timeColor }]}>
            {formatTime(timeSummary.totals.remaining)}
            </Text>
            <Text style={[styles.timeSubtext, { color: theme.text, opacity: 0.7 }]}>
            of {formatTime(timeSummary.totals.available)} available
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressContainer, { backgroundColor: theme.isDark ? '#333' : '#E0E0E0' }]}>
            <View 
                style={[
                styles.progressBar, 
                { 
                    backgroundColor: timeColor,
                    width: `${Math.min(progressPercentage, 100)}%` 
                }
                ]} 
            />
            </View>
            <Text style={[styles.progressText, { color: theme.text, opacity: 0.6 }]}>
            {formatTime(timeSummary.totals.used)} used today
            </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Summary</Text>
            
            <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>Base Time</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                {formatTime(timeSummary.baseTime.remaining)} left
                </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>Bonus Earned</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                {timeSummary.bonusTime.totalEarned} min
                </Text>
            </View>
            </View>

            <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>Soccer Activity</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                {timeSummary.bonusTime.soccer.activityMinutes} min
                </Text>
                <Text style={[styles.statBonus, { color: '#4CAF50' }]}>
                +{timeSummary.bonusTime.soccer.earned} bonus
                </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)' }]}>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>Fitness Activity</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                {timeSummary.bonusTime.fitness.activityMinutes} min
                </Text>
                <Text style={[styles.statBonus, { color: '#4CAF50' }]}>
                +{timeSummary.bonusTime.fitness.earned} bonus
                </Text>
            </View>
            </View>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
            
            <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: theme.buttonBackground }]}
            onPress={handleElectronicUsage}
            >
            <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>
                {timeSummary.activeSession ? '📱 End Electronic Session' : '📱 Start Electronic Session'}
            </Text>
            </TouchableOpacity>

            <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: theme.buttonBackground }]}
            onPress={handleEarnBonus}
            >
            <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>
                ⚽ Earn Bonus Time
            </Text>
            </TouchableOpacity>

            <View style={styles.secondaryButtonsRow}>
            <TouchableOpacity 
                style={[styles.secondaryButton, { backgroundColor: theme.isDark ? '#333' : 'rgba(255,255,255,0.8)' }]}
                onPress={handleTodayHistory}
            >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                📋 Today's History
                </Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.secondaryButton, { backgroundColor: theme.isDark ? '#333' : 'rgba(255,255,255,0.8)' }]}
                onPress={handlePastDays}
            >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                📅 Past Days
                </Text>
            </TouchableOpacity>
            </View>
        </View>

        {/* Activity Suggestions */}
        {timeSummary.bonusTime.totalEarned < 30 && (
            <View style={styles.suggestionsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>💡 Earn More Time!</Text>
            <View style={[styles.suggestionCard, { backgroundColor: theme.isDark ? '#1A3A1A' : 'rgba(76, 175, 80, 0.1)' }]}>
                <Text style={[styles.suggestionText, { color: theme.text }]}>
                {timeSummary.bonusTime.soccer.earned < 30 
                    ? `🏃 ${(30 - timeSummary.bonusTime.soccer.earned) * 2} min of soccer = +${30 - timeSummary.bonusTime.soccer.earned} min bonus`
                    : `💪 ${(30 - timeSummary.bonusTime.fitness.earned) * 2} min of fitness = +${30 - timeSummary.bonusTime.fitness.earned} min bonus`
                }
                </Text>
            </View>
            </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />

        {/* Modals */}
        <ElectronicUsageModal
            visible={showElectronicModal}
            onClose={() => setShowElectronicModal(false)}
            onSessionUpdate={handleSessionUpdate}
            timeSummary={timeSummary}
        />

        <EndSessionModal
            visible={showEndSessionModal}
            onClose={() => setShowEndSessionModal(false)}
            onSessionUpdate={handleSessionUpdate}
            activeSession={timeSummary?.activeSession}
        />
        <EarnBonusModal
            visible={showEarnBonusModal}
            onClose={() => setShowEarnBonusModal(false)}
            onBonusEarned={handleBonusEarned}
            timeSummary={timeSummary}
        />
        <TodaysHistoryModal
            visible={showTodaysHistoryModal}
            onClose={() => setShowTodaysHistoryModal(false)}
        />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  timeSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  timeLabel: {
    fontSize: 16,
    marginBottom: 8,
    opacity: 0.8,
  },
  timeRemaining: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeSubtext: {
    fontSize: 14,
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 0.48,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statBonus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 0.48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  suggestionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  suggestionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default DashboardScreen;