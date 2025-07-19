// src/components/PastDays/CalendarTab.js
import React from 'react';
import { DateTime } from 'luxon';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const CalendarTab = ({
  historicalData,
  selectedDate,
  selectedDayData,
  onDateSelect,
  onViewDayDetails,
}) => {
  const { theme } = useTheme();

  const calculateTotalTimeUsed = dayData => {
    if (!dayData) return 0;

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

    return dayData.baseTimeUsed + totalBonusUsed;
  };

  const calculateTotalBonusEarned = dayData => {
    if (!dayData) return 0;

    // Use totalEarned if available, otherwise calculate manually
    if (dayData.bonusTime?.totalEarned) {
      return dayData.bonusTime.totalEarned;
    }

    let totalBonusEarned = 0;
    if (dayData.bonusTime) {
      Object.keys(dayData.bonusTime).forEach(activityType => {
        if (
          !activityType.startsWith('total') &&
          !activityType.startsWith('max')
        ) {
          const bonusData = dayData.bonusTime[activityType];
          if (bonusData) {
            totalBonusEarned += bonusData.earned || 0;
          }
        }
      });
    }

    return totalBonusEarned;
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

  // Get calendar data for current month
  const getCalendarData = () => {
    // 🔧 FIX: Use Luxon for local timezone instead of UTC
    const today = DateTime.local();
    const year = today.year;
    const month = today.month; // Luxon months are 1-12, not 0-11
  
    const firstDay = DateTime.local(year, month, 1);
    const lastDay = firstDay.endOf('month');
    
    // 🔧 FIX: Use startOf('week') but ensure Sunday = 0 alignment
    // Luxon's startOf('week') defaults to Monday as first day
    // We need Sunday as first day to match your header: ['Sun', 'Mon', 'Tue', ...]
    const startDate = firstDay.minus({ days: firstDay.weekday % 7 }); // Force Sunday start
  
    const calendar = [];
    let current = startDate;
    const todayString = today.toISODate(); // Local date string
  
    for (let week = 0; week < 6; week++) {
      const weekData = [];
      for (let day = 0; day < 7; day++) {
        const dateString = current.toISODate(); // Local date string
        const isCurrentMonth = current.month === month;
        const isToday = dateString === todayString;
        const isSelected = dateString === selectedDate;
        const hasData = historicalData[dateString];
  
        weekData.push({
          date: current.toJSDate(), // Convert to JS Date for display
          dateString,
          isCurrentMonth,
          isToday,
          isSelected,
          hasData,
          dayData: hasData || null,
        });
  
        current = current.plus({ days: 1 }); // Move to next day
      }
      calendar.push(weekData);
    }
  
    return calendar;
  };

  const calendar = getCalendarData();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.monthTitle, { color: theme.text }]}>
        {monthNames[DateTime.local().month - 1]} {DateTime.local().year}
      </Text>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {dayNames.map(day => (
          <Text
            key={day}
            style={[styles.dayHeader, { color: theme.text, opacity: 0.6 }]}
          >
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      {calendar.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            // Determine background color based on selection and today status
            let backgroundColor = 'transparent';
            let borderColor = 'transparent';
            let borderWidth = 0;

            if (day.isSelected) {
              // Selected day gets solid background
              backgroundColor = theme.buttonBackground;
            } else if (day.isToday) {
              // Today gets outline when not selected
              borderColor = theme.buttonBackground;
              borderWidth = 2;
              backgroundColor = day.hasData
                ? theme.isDark
                  ? '#2A2A2A'
                  : 'rgba(255,255,255,0.8)'
                : 'transparent';
            } else if (day.hasData) {
              // Days with data get subtle background
              backgroundColor = theme.isDark
                ? '#2A2A2A'
                : 'rgba(255,255,255,0.8)';
            }

            return (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor,
                    borderColor,
                    borderWidth,
                    opacity: day.isCurrentMonth ? 1 : 0.3,
                  },
                ]}
                onPress={() => onDateSelect(day.dateString)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: day.isSelected ? theme.buttonText : theme.text,
                      fontWeight: day.isToday ? 'bold' : 'normal',
                    },
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                {day.hasData && (
                  <Text
                    style={[
                      styles.dayData,
                      {
                        color: day.isSelected ? theme.buttonText : '#4CAF50',
                      },
                    ]}
                  >
                    •
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selected day details - always show if a date is selected */}
      {selectedDate && (
        <TouchableOpacity
          style={[
            styles.selectedDayCard,
            {
              backgroundColor: selectedDayData
                ? theme.isDark
                  ? '#2A2A2A'
                  : 'rgba(255,255,255,0.9)'
                : theme.isDark
                ? '#1A1A1A'
                : 'rgba(128,128,128,0.1)',
              borderWidth: 2,
              borderColor: selectedDayData ? theme.buttonBackground : '#999',
            },
          ]}
          onPress={selectedDayData ? onViewDayDetails : undefined}
          activeOpacity={selectedDayData ? 0.8 : 1}
          disabled={!selectedDayData}
        >
          <View style={styles.selectedDayHeader}>
            <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
              {DateTime.fromISO(selectedDate).toLocaleString({
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            {selectedDayData && (
              <Text
                style={[
                  styles.tapToViewText,
                  { color: theme.buttonBackground },
                ]}
              >
                Tap to view details →
              </Text>
            )}
          </View>

          {selectedDayData ? (
            <View style={styles.selectedDayStats}>
              <View style={styles.selectedDayStat}>
                <Text
                  style={[styles.selectedDayStatValue, { color: '#F44336' }]}
                >
                  {formatTime(calculateTotalTimeUsed(selectedDayData))}
                </Text>
                <Text
                  style={[
                    styles.selectedDayStatLabel,
                    { color: theme.text, opacity: 0.7 },
                  ]}
                >
                  Time Used
                </Text>
              </View>

              <View style={styles.selectedDayStat}>
                <Text
                  style={[styles.selectedDayStatValue, { color: '#4CAF50' }]}
                >
                  {formatTime(calculateTotalBonusEarned(selectedDayData))}
                </Text>
                <Text
                  style={[
                    styles.selectedDayStatLabel,
                    { color: theme.text, opacity: 0.7 },
                  ]}
                >
                  Bonus Earned
                </Text>
              </View>

              <View style={styles.selectedDayStat}>
                <Text
                  style={[styles.selectedDayStatValue, { color: theme.text }]}
                >
                  {selectedDayData.activities
                    ? selectedDayData.activities.length
                    : 0}
                </Text>
                <Text
                  style={[
                    styles.selectedDayStatLabel,
                    { color: theme.text, opacity: 0.7 },
                  ]}
                >
                  Sessions
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text
                style={[styles.noDataText, { color: theme.text, opacity: 0.6 }]}
              >
                📭 No data for this day
              </Text>
              <Text
                style={[
                  styles.noDataSubtext,
                  { color: theme.text, opacity: 0.4 },
                ]}
              >
                {selectedDate === DateTime.local().toISODate()
                  ? 'Start using the app today to see your data here!'
                  : 'No activities were logged on this day.'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  dayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: (width - 40) / 7,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayCell: {
    width: (width - 40) / 7 - 4,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '500',
  },
  dayData: {
    fontSize: 18,
    position: 'absolute',
    bottom: 2,
  },
  selectedDayCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  tapToViewText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedDayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  selectedDayStat: {
    alignItems: 'center',
  },
  selectedDayStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedDayStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default CalendarTab;
