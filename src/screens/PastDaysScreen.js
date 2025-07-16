// src/screens/PastDaysScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService from '../services/TimeDataService';

const { width } = Dimensions.get('window');

const PastDaysScreen = ({ onBack }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [historicalData, setHistoricalData] = useState({});
  const [loading, setLoading] = useState(true);

  const tabs = [
    { id: 'calendar', title: 'Calendar', icon: '📅' },
    { id: 'trends', title: 'Trends', icon: '📈' },
    { id: 'stats', title: 'Stats', icon: '📊' },
  ];

  useEffect(() => {
    loadHistoricalData();
  }, []);

  const loadHistoricalData = async () => {
    try {
      setLoading(true);
      const allData = await TimeDataService.getAllData();
      setHistoricalData(allData.historical || {});
    } catch (error) {
      console.error('Error loading historical data:', error);
      Alert.alert('Error', 'Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  const loadDayData = async (dateString) => {
    try {
      const dayData = await TimeDataService.getHistoricalDay(dateString);
      setSelectedDayData(dayData);
      setSelectedDate(dateString);
    } catch (error) {
      console.error('Error loading day data:', error);
      Alert.alert('Error', 'Failed to load day data');
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

  // Get calendar data for current month
  const getCalendarData = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendar = [];
    const current = new Date(startDate);
    
    for (let week = 0; week < 6; week++) {
      const weekData = [];
      for (let day = 0; day < 7; day++) {
        const dateString = current.toISOString().split('T')[0];
        const isCurrentMonth = current.getMonth() === month;
        const isToday = dateString === today.toISOString().split('T')[0];
        const hasData = historicalData[dateString];
        
        weekData.push({
          date: new Date(current),
          dateString,
          isCurrentMonth,
          isToday,
          hasData,
          dayData: hasData || null,
        });
        
        current.setDate(current.getDate() + 1);
      }
      calendar.push(weekData);
    }
    
    return calendar;
  };

  // Get weekly trend data
  const getWeeklyTrends = () => {
    const trends = [];
    const dates = Object.keys(historicalData).sort();
    
    for (let i = 0; i < dates.length; i += 7) {
      const weekDates = dates.slice(i, i + 7);
      let totalUsed = 0;
      let totalBonus = 0;
      
      weekDates.forEach(date => {
        const dayData = historicalData[date];
        if (dayData) {
          totalUsed += dayData.baseTimeUsed + dayData.bonusTime.soccer.used + dayData.bonusTime.fitness.used;
          totalBonus += Math.min(dayData.bonusTime.soccer.earned + dayData.bonusTime.fitness.earned, 30);
        }
      });
      
      trends.push({
        week: `Week ${Math.floor(i / 7) + 1}`,
        averageUsed: Math.round(totalUsed / weekDates.length),
        totalBonus,
        days: weekDates.length,
      });
    }
    
    return trends;
  };

  // Get overall stats
  const getOverallStats = () => {
    const dates = Object.keys(historicalData);
    let totalTimeUsed = 0;
    let totalBonusEarned = 0;
    let totalActivities = 0;
    let bestDay = null;
    let worstDay = null;
    let perfectDays = 0;
    
    dates.forEach(date => {
      const dayData = historicalData[date];
      if (dayData) {
        const dayUsed = dayData.baseTimeUsed + dayData.bonusTime.soccer.used + dayData.bonusTime.fitness.used;
        const dayBonus = Math.min(dayData.bonusTime.soccer.earned + dayData.bonusTime.fitness.earned, 30);
        
        totalTimeUsed += dayUsed;
        totalBonusEarned += dayBonus;
        totalActivities += (dayData.activities ? dayData.activities.length : 0);
        
        if (dayBonus === 30) perfectDays++;
        
        if (!bestDay || dayUsed < bestDay.used) {
          bestDay = { date, used: dayUsed };
        }
        if (!worstDay || dayUsed > worstDay.used) {
          worstDay = { date, used: dayUsed };
        }
      }
    });
    
    return {
      totalDays: dates.length,
      averageTimeUsed: dates.length ? Math.round(totalTimeUsed / dates.length) : 0,
      totalBonusEarned,
      totalActivities,
      bestDay,
      worstDay,
      perfectDays,
    };
  };

  // Render calendar tab
  const renderCalendarTab = () => {
    const calendar = getCalendarData();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={[styles.monthTitle, { color: theme.text }]}>
          {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
        </Text>
        
        {/* Day headers */}
        <View style={styles.dayHeaders}>
          {dayNames.map(day => (
            <Text key={day} style={[styles.dayHeader, { color: theme.text, opacity: 0.6 }]}>
              {day}
            </Text>
          ))}
        </View>
        
        {/* Calendar grid */}
        {calendar.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: day.isToday 
                      ? theme.buttonBackground 
                      : day.hasData 
                        ? theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.8)'
                        : 'transparent',
                    opacity: day.isCurrentMonth ? 1 : 0.3,
                  }
                ]}
                onPress={() => day.hasData && loadDayData(day.dateString)}
                disabled={!day.hasData}
              >
                <Text style={[
                  styles.dayNumber,
                  {
                    color: day.isToday ? theme.buttonText : theme.text,
                    fontWeight: day.isToday ? 'bold' : 'normal',
                  }
                ]}>
                  {day.date.getDate()}
                </Text>
                {day.hasData && (
                  <Text style={[styles.dayData, { color: day.isToday ? theme.buttonText : '#4CAF50' }]}>
                    •
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
        
        {/* Selected day details */}
        {selectedDayData && (
          <View style={[styles.selectedDayCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
            <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            
            <View style={styles.selectedDayStats}>
              <View style={styles.selectedDayStat}>
                <Text style={[styles.selectedDayStatValue, { color: '#F44336' }]}>
                  {formatTime(selectedDayData.baseTimeUsed + selectedDayData.bonusTime.soccer.used + selectedDayData.bonusTime.fitness.used)}
                </Text>
                <Text style={[styles.selectedDayStatLabel, { color: theme.text, opacity: 0.7 }]}>
                  Time Used
                </Text>
              </View>
              
              <View style={styles.selectedDayStat}>
                <Text style={[styles.selectedDayStatValue, { color: '#4CAF50' }]}>
                  {formatTime(Math.min(selectedDayData.bonusTime.soccer.earned + selectedDayData.bonusTime.fitness.earned, 30))}
                </Text>
                <Text style={[styles.selectedDayStatLabel, { color: theme.text, opacity: 0.7 }]}>
                  Bonus Earned
                </Text>
              </View>
              
              <View style={styles.selectedDayStat}>
                <Text style={[styles.selectedDayStatValue, { color: theme.text }]}>
                  {selectedDayData.activities ? selectedDayData.activities.length : 0}
                </Text>
                <Text style={[styles.selectedDayStatLabel, { color: theme.text, opacity: 0.7 }]}>
                  Sessions
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render trends tab
  const renderTrendsTab = () => {
    const trends = getWeeklyTrends();
    
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Weekly Trends</Text>
        
        {trends.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.text, opacity: 0.6 }]}>
              No trend data available yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.text, opacity: 0.4 }]}>
              Use the app for a few days to see trends!
            </Text>
          </View>
        ) : (
          trends.map((trend, index) => (
            <View key={index} style={[styles.trendCard, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
              <Text style={[styles.trendTitle, { color: theme.text }]}>
                {trend.week}
              </Text>
              <View style={styles.trendStats}>
                <View style={styles.trendStat}>
                  <Text style={[styles.trendStatValue, { color: '#F44336' }]}>
                    {formatTime(trend.averageUsed)}
                  </Text>
                  <Text style={[styles.trendStatLabel, { color: theme.text, opacity: 0.7 }]}>
                    Avg Daily Use
                  </Text>
                </View>
                <View style={styles.trendStat}>
                  <Text style={[styles.trendStatValue, { color: '#4CAF50' }]}>
                    {formatTime(trend.totalBonus)}
                  </Text>
                  <Text style={[styles.trendStatLabel, { color: theme.text, opacity: 0.7 }]}>
                    Total Bonus
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // Render stats tab
  const renderStatsTab = () => {
    const stats = getOverallStats();
    
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Overall Statistics</Text>
        
        {stats.totalDays === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.text, opacity: 0.6 }]}>
              No statistics available yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.text, opacity: 0.4 }]}>
              Start tracking your time to see statistics!
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.statsGrid, { backgroundColor: theme.isDark ? '#2A2A2A' : 'rgba(255,255,255,0.9)' }]}>
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
                  {formatTime(stats.totalBonusEarned)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
                  Total Bonus
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {stats.totalActivities}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text, opacity: 0.7 }]}>
                  Total Sessions
                </Text>
              </View>
            </View>

            {/* Best/Worst Days */}
            <View style={styles.achievementsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Records</Text>
              
              {stats.bestDay && (
                <View style={[styles.achievementCard, { backgroundColor: theme.isDark ? '#1A3A1A' : 'rgba(76, 175, 80, 0.1)' }]}>
                  <Text style={[styles.achievementTitle, { color: '#4CAF50' }]}>
                    🏆 Best Day
                  </Text>
                  <Text style={[styles.achievementText, { color: theme.text }]}>
                    {new Date(stats.bestDay.date).toLocaleDateString()} - {formatTime(stats.bestDay.used)} used
                  </Text>
                </View>
              )}
              
              {stats.worstDay && (
                <View style={[styles.achievementCard, { backgroundColor: theme.isDark ? '#3A1A1A' : 'rgba(244, 67, 54, 0.1)' }]}>
                  <Text style={[styles.achievementTitle, { color: '#F44336' }]}>
                    📈 Highest Usage
                  </Text>
                  <Text style={[styles.achievementText, { color: theme.text }]}>
                    {new Date(stats.worstDay.date).toLocaleDateString()} - {formatTime(stats.worstDay.used)} used
                  </Text>
                </View>
              )}
              
              <View style={[styles.achievementCard, { backgroundColor: theme.isDark ? '#1A1A3A' : 'rgba(63, 81, 181, 0.1)' }]}>
                <Text style={[styles.achievementTitle, { color: '#3F51B5' }]}>
                  ⭐ Perfect Days
                </Text>
                <Text style={[styles.achievementText, { color: theme.text }]}>
                  {stats.perfectDays} days with maximum bonus (30m)
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'calendar':
        return renderCalendarTab();
      case 'trends':
        return renderTrendsTab();
      case 'stats':
        return renderStatsTab();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: theme.text }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Past Days</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.text }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Past Days</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.id 
                  ? theme.buttonBackground 
                  : theme.isDark ? '#333' : 'rgba(255,255,255,0.8)',
              }
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[
              styles.tabText,
              {
                color: activeTab === tab.id ? theme.buttonText : theme.text,
              }
            ]}>
              {tab.icon} {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    paddingRight: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-around',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabContent: {
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
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
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
  achievementsSection: {
    marginTop: 20,
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

export default PastDaysScreen;