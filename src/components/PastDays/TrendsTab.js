// src/components/PastDays/TrendsTab.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { DateTime } from 'luxon';

const TrendsTab = ({ historicalData }) => {
  console.log('--- TrendsTab Rendered ---', historicalData);
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

  // REPLACE the getWeeklyTrends function in TrendsTab.js:

  const getWeeklyTrends = () => {
    const trends = [];

    // 🔧 FIX: Filter out invalid dates like "undefined"
    const allDates = Object.keys(historicalData);
    const validDates = allDates.filter(date => {
      // Check if date is valid and not "undefined"
      if (!date || date === 'undefined' || date === 'null') {
        console.log('🗑️ TrendsTab: Filtering out invalid date:', date);
        return false;
      }

      // Check if the date can be parsed as a valid date
      const parsedDate = DateTime.fromISO(date);
      if (!parsedDate.isValid) {
        console.log('🗑️ TrendsTab: Filtering out invalid date format:', date);
        return false;
      }

      // Check if the data object is valid
      const dayData = historicalData[date];
      if (!dayData || typeof dayData !== 'object') {
        console.log(
          '🗑️ TrendsTab: Filtering out date with invalid data:',
          date,
        );
        return false;
      }

      return true;
    });

    console.log('📈 TrendsTab: Processing trends for valid dates:', validDates);

    // Sort valid dates
    const sortedValidDates = validDates.sort();

    for (let i = 0; i < sortedValidDates.length; i += 7) {
      const weekDates = sortedValidDates.slice(i, i + 7);
      let totalUsed = 0;
      let totalBonus = 0;
      let validDaysInWeek = 0; // Track valid days to avoid division by zero

      weekDates.forEach(date => {
        const dayData = historicalData[date];
        if (dayData && typeof dayData === 'object') {
          validDaysInWeek++; // Count this as a valid day

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

          const dayUsed = (dayData.baseTimeUsed || 0) + totalBonusUsed;
          totalUsed += dayUsed;

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
          totalBonus += dayBonus;
        }
      });

      // Only add trend if we have valid days in the week
      if (validDaysInWeek > 0) {
        trends.push({
          week: `Week ${Math.floor(i / 7) + 1}`,
          averageUsed: Math.round(totalUsed / validDaysInWeek), // Use validDaysInWeek instead of weekDates.length
          totalBonus,
          days: validDaysInWeek, // Show actual valid days
        });
      } else {
        console.log(
          `⚠️ TrendsTab: Skipping week ${
            Math.floor(i / 7) + 1
          } - no valid days`,
        );
      }
    }

    return trends;
  };

  const trends = getWeeklyTrends();
  console.log('Weekly Trends:', trends);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Weekly Trends
      </Text>

      {trends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text, opacity: 0.6 }]}>
            No trend data available yet
          </Text>
          <Text
            style={[styles.emptySubtext, { color: theme.text, opacity: 0.4 }]}
          >
            Use the app for a few days to see trends!
          </Text>
        </View>
      ) : (
        trends.map((trend, index) => (
          <View
            key={index}
            style={[
              styles.trendCard,
              {
                backgroundColor: theme.isDark
                  ? '#2A2A2A'
                  : 'rgba(255,255,255,0.9)',
              },
            ]}
          >
            <Text style={[styles.trendTitle, { color: theme.text }]}>
              {trend.week}
            </Text>
            <View style={styles.trendStats}>
              <View style={styles.trendStat}>
                <Text style={[styles.trendStatValue, { color: '#F44336' }]}>
                  {formatTime(trend.averageUsed)}
                </Text>
                <Text
                  style={[
                    styles.trendStatLabel,
                    { color: theme.text, opacity: 0.7 },
                  ]}
                >
                  Avg Daily Use
                </Text>
              </View>
              <View style={styles.trendStat}>
                <Text style={[styles.trendStatValue, { color: '#4CAF50' }]}>
                  {formatTime(trend.totalBonus)}
                </Text>
                <Text
                  style={[
                    styles.trendStatLabel,
                    { color: theme.text, opacity: 0.7 },
                  ]}
                >
                  Total Bonus
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

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
  },
  trendCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  trendStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trendStat: {
    alignItems: 'center',
  },
  trendStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendStatLabel: {
    fontSize: 12,
    marginTop: 4,
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

export default TrendsTab;
