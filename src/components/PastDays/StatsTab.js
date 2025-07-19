// src/components/PastDays/StatsTab.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ELECTRONIC_LABELS } from '../../services/TimeDataService';
import { DateTime } from 'luxon';

const StatsTab = ({ historicalData }) => {
  console.log('--- StatsTab Rendered ---', historicalData);
  const { theme } = useTheme();

  // Format time for display
  const formatTime = minutes => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get overall stats
  const getOverallStats = () => {
    // 🔧 FIX: Filter out invalid dates like "undefined"
    const allDates = Object.keys(historicalData);
    const validDates = allDates.filter(date => {
      // Check if date is valid and not "undefined"
      if (!date || date === 'undefined' || date === 'null') {
        console.log('🗑️ Filtering out invalid date:', date);
        return false;
      }

      // Check if the date can be parsed as a valid date
      const parsedDate = DateTime.fromISO(date);
      if (!parsedDate.isValid) {
        console.log('🗑️ Filtering out invalid date format:', date);
        return false;
      }

      // Check if the data object is valid
      const dayData = historicalData[date];
      if (!dayData || typeof dayData !== 'object') {
        console.log('🗑️ Filtering out date with invalid data:', date);
        return false;
      }

      return true;
    });

    console.log('📊 Processing stats for valid dates:', validDates);

    let totalTimeUsed = 0;
    let totalBonusEarned = 0;
    let totalActivities = 0;
    let bestDay = null;
    let worstDay = null;
    let perfectDays = 0;
    let underBudgetDays = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    let totalTimeSaved = 0;
    let deviceUsage = {
      tablet: 0,
      phone: 0,
      playstation: 0,
      switch: 0,
      tv_movie: 0,
      computer: 0, // Add computer if needed
    };

    // Sort valid dates to calculate streaks properly
    const sortedDates = validDates.sort();

    sortedDates.forEach((date, index) => {
      const dayData = historicalData[date];
      if (dayData && typeof dayData === 'object') {
        // 🔧 FIX: Calculate time used dynamically
        let totalBonusUsed = 0;
        if (dayData.bonusTime) {
          Object.keys(dayData.bonusTime).forEach(activityType => {
            if (
              !activityType.startsWith('total') &&
              !activityType.startsWith('max')
            ) {
              const bonusData = dayData.bonusTime[activityType];
              if (bonusData) {
                totalBonusUsed += bonusData.used || 0;
              }
            }
          });
        }
        const dayUsed = dayData.baseTimeUsed + totalBonusUsed;

        // 🔧 FIX: Calculate bonus earned dynamically
        let dayBonus = 0;
        if (dayData.bonusTime?.totalEarned) {
          dayBonus = dayData.bonusTime.totalEarned;
        } else if (dayData.bonusTime) {
          Object.keys(dayData.bonusTime).forEach(activityType => {
            if (
              !activityType.startsWith('total') &&
              !activityType.startsWith('max')
            ) {
              const bonusData = dayData.bonusTime[activityType];
              if (bonusData) {
                dayBonus += bonusData.earned || 0;
              }
            }
          });
        }

        const dayAvailable = 120 + dayBonus; // Base time + bonus earned

        totalTimeUsed += dayUsed;
        totalBonusEarned += dayBonus;
        totalActivities += dayData.activities ? dayData.activities.length : 0;

        // Perfect days (check if reached max total bonus instead of hardcoded 30)
        const maxTotalBonus = dayData.bonusTime?.maxTotalPossible || 30;
        if (dayBonus === maxTotalBonus) perfectDays++;

        // Under budget days (used less than available)
        if (dayUsed < dayAvailable) {
          underBudgetDays++;
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
          totalTimeSaved += dayAvailable - dayUsed;
        } else {
          currentStreak = 0;
        }

        // FIXED: Calculate device usage from activities array (more accurate)
        if (dayData.activities && Array.isArray(dayData.activities)) {
          dayData.activities.forEach(activity => {
            if (activity.type === 'electronic' && activity.actualMinutes) {
              const device = activity.category;
              if (deviceUsage[device] !== undefined) {
                deviceUsage[device] += activity.actualMinutes;
              }
            }
          });
        } else if (dayData.electronicUsage) {
          // Fallback to electronicUsage if no activities array
          deviceUsage.tablet += dayData.electronicUsage.tablet || 0;
          deviceUsage.phone += dayData.electronicUsage.phone || 0;
          deviceUsage.playstation += dayData.electronicUsage.playstation || 0;
          deviceUsage.switch += dayData.electronicUsage.switch || 0;
          deviceUsage.tv_movie += dayData.electronicUsage.tv_movie || 0;
          deviceUsage.computer += dayData.electronicUsage.computer || 0;
        }

        // Best/worst days
        if (!bestDay || dayUsed < bestDay.used) {
          bestDay = { date, used: dayUsed };
        }
        if (!worstDay || dayUsed > worstDay.used) {
          worstDay = { date, used: dayUsed };
        }
      }
    });

    // Find favorite device
    const favoriteDevice = Object.entries(deviceUsage).reduce(
      (max, [device, usage]) => (usage > max.usage ? { device, usage } : max),
      { device: 'tablet', usage: 0 },
    );

    // Use validDates.length instead of allDates.length for calculations
    const totalDays = validDates.length || 1; // Avoid division by zero

    return {
      totalDays: validDates.length,
      averageTimeUsed: validDates.length
        ? Math.round(totalTimeUsed / validDates.length)
        : 0,
      totalBonusEarned,
      averageBonusEarned: validDates.length
        ? Math.round(totalBonusEarned / validDates.length)
        : 0,
      totalActivities,
      averageActivities: validDates.length
        ? Math.round((totalActivities / validDates.length) * 10) / 10
        : 0, // One decimal place
      bestDay,
      worstDay,
      perfectDays,
      underBudgetDays,
      longestStreak,
      totalTimeSaved,
      averageTimeSaved: validDates.length
        ? Math.round(totalTimeSaved / validDates.length)
        : 0,
      favoriteDevice,
      deviceUsage,
      averageDeviceUsage: {
        tablet: validDates.length
          ? Math.round(deviceUsage.tablet / validDates.length)
          : 0,
        phone: validDates.length
          ? Math.round(deviceUsage.phone / validDates.length)
          : 0,
        playstation: validDates.length
          ? Math.round(deviceUsage.playstation / validDates.length)
          : 0,
        switch: validDates.length
          ? Math.round(deviceUsage.switch / validDates.length)
          : 0,
        tv_movie: validDates.length
          ? Math.round(deviceUsage.tv_movie / validDates.length)
          : 0,
        computer: validDates.length
          ? Math.round(deviceUsage.computer / validDates.length)
          : 0,
      },
    };
  };

  const stats = getOverallStats();

  if (stats.totalDays === 0) {
    return (
      <ScrollView style={styles.container}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Overall Statistics
        </Text>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text, opacity: 0.6 }]}>
            No statistics available yet
          </Text>
          <Text
            style={[styles.emptySubtext, { color: theme.text, opacity: 0.4 }]}
          >
            Start tracking your time to see statistics!
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Overall Statistics
      </Text>

      {/* Main Stats Grid */}
      <View
        style={[
          styles.statsGrid,
          {
            backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.totalDays}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
            Days Tracked
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
            {formatTime(stats.averageTimeUsed)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
            Avg Daily Use
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {formatTime(stats.averageBonusEarned)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
            Avg Daily Bonus
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.averageActivities}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
            Avg Daily Sessions
          </Text>
        </View>
      </View>

      {/* New Stats Section */}
      <View style={styles.newStatsSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Time Management
        </Text>

        <View style={styles.newStatsGrid}>
          <View
            style={[
              styles.newStatCard,
              {
                backgroundColor: theme.isDark
                  ? '#1A3A1A'
                  : 'rgba(76, 175, 80, 0.1)',
              },
            ]}
          >
            <Text style={[styles.newStatValue, { color: '#4CAF50' }]}>
              {stats.underBudgetDays}
            </Text>
            <Text style={[styles.newStatLabel, { color: theme.text }]}>
              Under Budget Days
            </Text>
            <Text
              style={[
                styles.newStatSubtext,
                { color: theme.text, opacity: 0.6 },
              ]}
            >
              Used less than daily allowance
            </Text>
          </View>

          <View
            style={[
              styles.newStatCard,
              {
                backgroundColor: theme.isDark
                  ? '#3A1A3A'
                  : 'rgba(156, 39, 176, 0.1)',
              },
            ]}
          >
            <Text style={[styles.newStatValue, { color: '#9C27B0' }]}>
              {stats.longestStreak}
            </Text>
            <Text style={[styles.newStatLabel, { color: theme.text }]}>
              Longest Streak
            </Text>
            <Text
              style={[
                styles.newStatSubtext,
                { color: theme.text, opacity: 0.6 },
              ]}
            >
              Consecutive under-budget days
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.timeSavedCard,
            {
              backgroundColor: theme.isDark
                ? '#1A1A3A'
                : 'rgba(63, 81, 181, 0.1)',
            },
          ]}
        >
          <Text style={[styles.timeSavedValue, { color: '#3F51B5' }]}>
            {formatTime(stats.averageTimeSaved)}
          </Text>
          <Text style={[styles.timeSavedLabel, { color: theme.text }]}>
            Avg Daily Time Saved
          </Text>
          <Text
            style={[
              styles.timeSavedSubtext,
              { color: theme.text, opacity: 0.6 },
            ]}
          >
            Average unused allowance per day • Total:{' '}
            {formatTime(stats.totalTimeSaved)}
          </Text>
        </View>
      </View>

      {/* Device Usage Section */}
      <View style={styles.deviceSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Device Usage
        </Text>

        <View
          style={[
            styles.favoriteDeviceCard,
            {
              backgroundColor: theme.isDark
                ? '#3A2A1A'
                : 'rgba(255, 152, 0, 0.1)',
            },
          ]}
        >
          <Text style={[styles.favoriteDeviceTitle, { color: '#FF9800' }]}>
            📱 Favorite Device
          </Text>
          <Text style={[styles.favoriteDeviceValue, { color: theme.text }]}>
            {ELECTRONIC_LABELS[stats.favoriteDevice.device]}
          </Text>
          <Text style={[styles.favoriteDeviceTime, { color: '#FF9800' }]}>
            {formatTime(stats.favoriteDevice.usage)} total
          </Text>
        </View>

        <View style={styles.deviceBreakdown}>
          {Object.entries(stats.deviceUsage).map(([device, usage]) => (
            <View
              key={device}
              style={[
                styles.deviceCard,
                {
                  backgroundColor: theme.isDark
                    ? '#2A2A2A'
                    : 'rgba(255,255,255,0.9)',
                },
              ]}
            >
              <Text style={[styles.deviceName, { color: theme.text }]}>
                {ELECTRONIC_LABELS[device]}
              </Text>
              <Text
                style={[
                  styles.deviceTime,
                  { color: usage > 0 ? '#FF9800' : theme.text },
                ]}
              >
                {formatTime(stats.averageDeviceUsage[device])}/day
              </Text>
              <Text
                style={[
                  styles.deviceSubtext,
                  { color: theme.text, opacity: 0.6 },
                ]}
              >
                {usage > 0 ? `${formatTime(usage)} total` : 'no usage'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Records Section */}
      <View style={styles.achievementsSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Records
        </Text>

        {stats.bestDay && (
          <View
            style={[
              styles.achievementCard,
              {
                backgroundColor: theme.isDark
                  ? '#1A3A1A'
                  : 'rgba(76, 175, 80, 0.1)',
              },
            ]}
          >
            <Text style={[styles.achievementTitle, { color: '#4CAF50' }]}>
              🏆 Best Day
            </Text>
            <Text style={[styles.achievementText, { color: theme.text }]}>
              {DateTime.fromISO(stats.bestDay.date).toLocaleString(
                DateTime.DATE_SHORT,
              )}{' '}
              - {formatTime(stats.bestDay.used)} used
            </Text>
          </View>
        )}

        {stats.worstDay && (
          <View
            style={[
              styles.achievementCard,
              {
                backgroundColor: theme.isDark
                  ? '#3A1A1A'
                  : 'rgba(244, 67, 54, 0.1)',
              },
            ]}
          >
            <Text style={[styles.achievementTitle, { color: '#F44336' }]}>
              📈 Highest Usage
            </Text>
            <Text style={[styles.achievementText, { color: theme.text }]}>
              {DateTime.fromISO(stats.worstDay.date).toLocaleString(
                DateTime.DATE_SHORT,
              )}{' '}
              - {formatTime(stats.worstDay.used)} used
            </Text>
          </View>
        )}

        <View
          style={[
            styles.achievementCard,
            {
              backgroundColor: theme.isDark
                ? '#1A1A3A'
                : 'rgba(63, 81, 181, 0.1)',
            },
          ]}
        >
          <Text style={[styles.achievementTitle, { color: '#3F51B5' }]}>
            ⭐ Perfect Days
          </Text>
          <Text style={[styles.achievementText, { color: theme.text }]}>
            {stats.perfectDays} days with maximum bonus (30m)
          </Text>
        </View>
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  newStatsSection: {
    marginBottom: 20,
  },
  newStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  newStatCard: {
    flex: 0.48,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  newStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  newStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  newStatSubtext: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  timeSavedCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeSavedValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  timeSavedLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  timeSavedSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  deviceSection: {
    marginBottom: 20,
  },
  favoriteDeviceCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  favoriteDeviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  favoriteDeviceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  favoriteDeviceTime: {
    fontSize: 14,
    marginTop: 2,
  },
  deviceBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  deviceCard: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  deviceTime: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  deviceSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  achievementsSection: {
    marginBottom: 20,
  },
  achievementCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementText: {
    fontSize: 14,
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
});

export default StatsTab;
