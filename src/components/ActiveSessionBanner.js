// src/components/ActiveSessionBanner.js
import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ELECTRONIC_LABELS } from '../services/TimeDataService';

const ActiveSessionBanner = ({ activeSession, onEndSession }) => {
  const { theme } = useTheme();
  const [sessionElapsed, setSessionElapsed] = useState(0);

  // Live timer for active session
  useEffect(() => {
    let interval;

    if (activeSession) {
      // Update session elapsed time every second
      interval = setInterval(() => {
        // 🔧 FIX: Use Luxon for timezone-aware time calculations
        const startTime = DateTime.fromISO(activeSession.startTime);
        const now = DateTime.local();
        const elapsed = Math.floor(now.diff(startTime, 'seconds').seconds);
        setSessionElapsed(elapsed);
      }, 1000); // Update every second
    } else {
      setSessionElapsed(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeSession]);

  // Convert seconds to minutes and seconds display
  const formatTimeSeconds = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeSession) return null;

  // Get session time status
  const sessionStatus = {
    elapsedSeconds: sessionElapsed,
    elapsedMinutes: Math.floor(sessionElapsed / 60),
    estimatedSeconds: activeSession.estimatedMinutes * 60,
    remainingSeconds: Math.max(
      0,
      activeSession.estimatedMinutes * 60 - sessionElapsed,
    ),
    isOverTime: sessionElapsed > activeSession.estimatedMinutes * 60,
    estimated: activeSession.estimatedMinutes,
    overTimeSeconds: Math.max(
      0,
      sessionElapsed - activeSession.estimatedMinutes * 60,
    ),
  };

  // Get session progress percentage
  const sessionProgressPercentage = Math.min(
    (sessionStatus.elapsedSeconds / sessionStatus.estimatedSeconds) * 100,
    100,
  );

  return (
    <TouchableOpacity
      style={[
        styles.activeSessionAlert,
        {
          backgroundColor: sessionStatus.isOverTime
            ? theme.isDark
              ? '#3A1A1A'
              : 'rgba(244, 67, 54, 0.1)'
            : theme.isDark
            ? '#1A3A1A'
            : 'rgba(76, 175, 80, 0.1)',
          borderColor: sessionStatus.isOverTime ? '#F44336' : '#4CAF50',
        },
      ]}
      onPress={onEndSession}
      activeOpacity={0.8}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Text
            style={[
              styles.activeSessionTitle,
              { color: sessionStatus.isOverTime ? '#F44336' : '#4CAF50' },
            ]}
          >
            📱 Active Session {sessionStatus.isOverTime ? '(Over Time!)' : ''}
          </Text>
          <Text style={[styles.activeSessionText, { color: theme.text }]}>
            {ELECTRONIC_LABELS[activeSession.category]} • Started at{' '}
            {DateTime.fromISO(activeSession.startTime).toFormat('h:mm a')}
          </Text>
        </View>
        <View style={styles.sessionTimerContainer}>
          <Text
            style={[
              styles.sessionTimer,
              { color: sessionStatus.isOverTime ? '#F44336' : '#4CAF50' },
            ]}
          >
            {sessionStatus.isOverTime
              ? `+${formatTimeSeconds(sessionStatus.overTimeSeconds)}`
              : formatTimeSeconds(sessionStatus.remainingSeconds)}
          </Text>
          <Text
            style={[styles.tapToEndText, { color: theme.text, opacity: 0.6 }]}
          >
            {sessionStatus.isOverTime ? 'Over Time!' : 'Remaining'} • Tap to End
          </Text>
        </View>
      </View>

      {/* Session Progress Bar */}
      <View
        style={[
          styles.sessionProgressContainer,
          { backgroundColor: theme.isDark ? '#333' : '#E0E0E0' },
        ]}
      >
        <View
          style={[
            styles.sessionProgressBar,
            {
              backgroundColor: sessionStatus.isOverTime ? '#F44336' : '#4CAF50',
              width: `${sessionProgressPercentage}%`,
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.activeSessionSubtext,
          { color: theme.text, opacity: 0.7 },
        ]}
      >
        {sessionStatus.isOverTime
          ? `${formatTimeSeconds(
              sessionStatus.overTimeSeconds,
            )} over estimated ${sessionStatus.estimated}m`
          : `${formatTimeSeconds(
              sessionStatus.remainingSeconds,
            )} remaining of ${sessionStatus.estimated}m`}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  activeSessionAlert: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTimerContainer: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  activeSessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionTimer: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  tapToEndText: {
    fontSize: 10,
    marginTop: 2,
  },
  activeSessionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionProgressContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  sessionProgressBar: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  activeSessionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default ActiveSessionBanner;
