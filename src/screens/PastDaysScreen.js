// src/screens/PastDaysScreen.js
import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimeDataService from '../services/TimeDataService';
import TodaysHistoryModal from '../components/TodaysHistoryModal';
import CalendarTab from '../components/PastDays/CalendarTab';
import TrendsTab from '../components/PastDays/TrendsTab';
import StatsTab from '../components/PastDays/StatsTab';

const { width } = require('react-native').Dimensions.get('window');

const PastDaysScreen = ({ onBack }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [historicalData, setHistoricalData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDayHistoryModal, setShowDayHistoryModal] = useState(false);

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
      let combinedData = allData.historical || {};
      
      // INCLUDE TODAY'S DATA: Add today's data to historical data for calendar display
      if (allData.currentDay && allData.currentDay.date) {
        const todayDate = allData.currentDay.date;
        combinedData[todayDate] = allData.currentDay;
      }
      
      setHistoricalData(combinedData);
    } catch (error) {
      console.error('Error loading historical data:', error);
      Alert.alert('Error', 'Failed to load historical data');
    } finally {
      setLoading(false);
    }
  };

  const loadDayData = async (dateString) => {
    try {
      console.log('Loading data for date:', dateString); // Debug log
      
      // Always set the selected date first
      setSelectedDate(dateString);
      
      // Check if this is today's date
      const todayString = DateTime.local().toISODate();
      let dayData = null;
      
      if (dateString === todayString) {
        // For today, get current day data
        dayData = await TimeDataService.getTodayData();
      } else {
        // For other days, get historical data
        dayData = await TimeDataService.getHistoricalDay(dateString);
      }
      
      console.log('Day data loaded:', dayData ? 'has data' : 'no data'); // Debug log
      setSelectedDayData(dayData); // This could be null if no data exists
    } catch (error) {
      console.error('Error loading day data:', error);
      // Even on error, keep the selected date but clear the data
      setSelectedDayData(null);
    }
  };

  const handleViewDayDetails = () => {
    // Only open modal if there's actually data to show
    if (selectedDayData) {
      setShowDayHistoryModal(true);
    }
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'calendar':
        return (
          <CalendarTab
            historicalData={historicalData}
            selectedDate={selectedDate}
            selectedDayData={selectedDayData}
            onDateSelect={loadDayData}
            onViewDayDetails={handleViewDayDetails}
          />
        );
      case 'trends':
        return <TrendsTab historicalData={historicalData} />;
      case 'stats':
        return <StatsTab historicalData={historicalData} />;
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

      {/* Day History Modal */}
      {selectedDayData && (
        <TodaysHistoryModal
          visible={showDayHistoryModal}
          onClose={() => setShowDayHistoryModal(false)}
          selectedDate={selectedDate}
          dayData={selectedDayData}
        />
      )}
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
});

export default PastDaysScreen;