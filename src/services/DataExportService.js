// src/services/DataExportService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { DateTime } from 'luxon';
import TimeDataService from './TimeDataService';

class DataExportService {
  // Get username for export filename
  static async getUserName() {
    try {
      const userName = await AsyncStorage.getItem('userName');
      return userName || 'Child';
    } catch (error) {
      console.error('Error getting username:', error);
      return 'Child';
    }
  }

  // Get date range for export
  static getDateRange(period) {
    const today = DateTime.local();
    const todayString = today.toISODate();

    switch (period) {
      case 'today':
        return {
          startDate: todayString,
          endDate: todayString,
          label: 'Today',
        };

      case 'week':
        // Get this week (Sunday to Saturday)
        const startOfWeek = today.startOf('week');
        const endOfWeek = today.endOf('week');

        return {
          startDate: startOfWeek.toISODate(),
          endDate: endOfWeek.toISODate(),
          label: 'Week',
        };

      case 'month':
        // Get this month
        const startOfMonth = today.startOf('month');
        const endOfMonth = today.endOf('month');

        return {
          startDate: startOfMonth.toISODate(),
          endDate: endOfMonth.toISODate(),
          label: 'Month',
        };

      default:
        return {
          startDate: todayString,
          endDate: todayString,
          label: 'Today',
        };
    }
  }

  // Collect all data for export
  static async collectExportData(period = 'today') {
    try {
      const userName = await this.getUserName();
      const dateRange = this.getDateRange(period);

      // Get today's data (always include current day)
      const todayData = await TimeDataService.getTodayData();

      // Get historical data
      const allData = await TimeDataService.getAllData();
      const historicalData = allData.historical || {};

      // Filter historical data by date range
      const filteredHistorical = {};
      Object.keys(historicalData).forEach(date => {
        if (date >= dateRange.startDate && date <= dateRange.endDate) {
          filteredHistorical[date] = historicalData[date];
        }
      });

      // Create export package
      const exportData = {
        exportInfo: {
          childName: userName,
          exportDate: DateTime.local().toISO(),
          period: period,
          dateRange: dateRange,
          appVersion: '1.0.0',
        },
        todayData: todayData,
        historicalData: filteredHistorical,
        summary: {
          totalDays:
            Object.keys(filteredHistorical).length + (todayData ? 1 : 0),
          dateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
        },
      };

      return {
        success: true,
        data: exportData,
        filename: this.generateFilename(userName, period, dateRange),
      };
    } catch (error) {
      console.error('Error collecting export data:', error);
      return {
        success: false,
        error: 'Failed to collect data for export',
      };
    }
  }

  // Generate filename for export
  static generateFilename(userName, period, dateRange) {
    const today = DateTime.local();
    const dateString = today.toISODate().replace(/-/g, '');

    // Clean username (remove spaces, special chars)
    const cleanName = userName.replace(/[^a-zA-Z0-9]/g, '');

    switch (period) {
      case 'today':
        return `${cleanName}_TimeTracker_${dateString}.json`;
      case 'week':
        return `${cleanName}_TimeTracker_Week_${dateString}.json`;
      case 'month':
        const monthYear = today.toFormat('yyyyMM');
        return `${cleanName}_TimeTracker_${monthYear}.json`;
      default:
        return `${cleanName}_TimeTracker_${dateString}.json`;
    }
  }

  // Share data via native share sheet
  static async shareData(period = 'today') {
    try {
      // Collect data
      const result = await this.collectExportData(period);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Convert to JSON string
      const jsonString = JSON.stringify(result.data, null, 2);

      const htmlBody = `
        <p><strong>📊 ${result.data.exportInfo.childName}'s Time Tracker Export</strong></p>
        <p><em>Period:</em> ${result.data.exportInfo.dateRange.label} (${result.data.summary.dateRange})<br/>
        <em>Total Days:</em> ${result.data.summary.totalDays}</p>

        <p>📋 <strong>Tap and hold to copy:</strong></p>

        <pre style="font-family: monospace; background: #f4f4f4; padding: 12px; border-radius: 8px; font-size: 14px; white-space: pre-wrap;">
        ${jsonString}
        </pre>

        <p style="font-size: 12px; color: #666;">You can paste this into the parent TimeTracker app to import the data.</p>
        `;

      const shareContent = {
        title: `${result.data.exportInfo.childName}'s Time Tracker Data`,
        message: htmlBody,
        subject: `${result.data.exportInfo.childName}'s Time Tracker Export`,
      };

      // Show share sheet
      const shareResult = await Share.share(shareContent);

      console.log('Share result:', shareResult);

      return {
        success: true,
        shareResult: shareResult,
        filename: result.filename,
        dataSize: jsonString.length,
      };
    } catch (error) {
      console.error('Error sharing data:', error);
      return {
        success: false,
        error: 'Failed to share data',
      };
    }
  }

  // Preview export data (for debugging)
  static async previewExport(period = 'today') {
    const result = await this.collectExportData(period);

    if (result.success) {
      console.log('Export Preview:', {
        filename: result.filename,
        childName: result.data.exportInfo.childName,
        period: result.data.exportInfo.period,
        dateRange: result.data.exportInfo.dateRange,
        totalDays: result.data.summary.totalDays,
        dataSize: JSON.stringify(result.data).length,
        historicalDays: Object.keys(result.data.historicalData).length,
        hasTodayData: !!result.data.todayData,
      });
    }

    return result;
  }
}

export default DataExportService;
