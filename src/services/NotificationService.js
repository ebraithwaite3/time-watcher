// src/services/NotificationService.js
import { Notifications } from 'react-native-notifications';
import { Platform } from 'react-native';
import { DateTime } from 'luxon';

class NotificationService {
  // Configure notifications when app starts
  static configure() {
    console.log('Configuring notifications...');

    // Request permissions immediately (for iOS)
    if (Platform.OS === 'ios') {
      Notifications.ios
        .checkPermissions()
        .then(currentPermissions => {
          console.log('Current iOS permissions:', currentPermissions);
        })
        .catch(error => {
          console.log('Error checking iOS permissions:', error);
        });
    }

    // Skip event listeners for now - they seem to be causing issues
    console.log('Notification configuration complete (basic mode)');
  }

  // Request notification permissions (call when user signs in)
  static async requestPermissions() {
    try {
      if (Platform.OS === 'ios') {
        const permissions = await Notifications.ios.requestPermissions({
          alert: true,
          badge: true,
          sound: true,
        });
        console.log('iOS notification permissions:', permissions);
        return permissions.alert || permissions.sound;
      } else {
        // Android permissions are handled automatically
        console.log('Android notifications enabled by default');
        return true;
      }
    } catch (error) {
      console.log('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Schedule notification for session end time
  static scheduleSessionEndNotification(sessionId, endTime, deviceType) {
    try {
      // 🔧 FIX: Handle timezone properly for notifications
      let notificationTime;

      // Handle different input types
      if (typeof endTime === 'string') {
        // If it's an ISO string, parse with Luxon to handle timezone correctly
        notificationTime = DateTime.fromISO(endTime);
      } else if (endTime instanceof Date) {
        // If it's a Date object, convert to Luxon DateTime
        notificationTime = DateTime.fromJSDate(endTime);
      } else {
        console.log('❌ Invalid endTime format:', endTime);
        return;
      }

      // Ensure we have a valid DateTime
      if (!notificationTime.isValid) {
        console.log('❌ Invalid notification time:', endTime);
        return;
      }

      const now = DateTime.local();

      console.log(`🔔 Attempting to schedule notification:`);
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Device Type: ${deviceType}`);
      console.log(
        `   End Time: ${notificationTime.toLocaleString(
          DateTime.DATETIME_SHORT,
        )}`,
      );
      console.log(
        `   Current Time: ${now.toLocaleString(DateTime.DATETIME_SHORT)}`,
      );

      // Don't schedule if end time is in the past
      if (notificationTime <= now) {
        console.log('❌ End time is in the past, not scheduling notification');
        return;
      }

      // Calculate delay in milliseconds using Luxon
      const delay = notificationTime.diff(now).milliseconds;
      console.log(`   Delay: ${delay}ms (${Math.round(delay / 1000)} seconds)`);

      const notification = {
        identifier: sessionId,
        title: "Time's Up! ⏰",
        body: `Your ${deviceType} session time has ended. Tap to log your actual usage.`,
        sound: 'default',
        badge: 1,
        payload: {
          sessionId: sessionId,
          deviceType: deviceType,
        },
      };

      // Schedule the notification
      console.log(`🔔 Calling Notifications.postLocalNotification...`);
      Notifications.postLocalNotification(notification, delay);
      console.log(
        `✅ Notification scheduled successfully for ${delay}ms from now`,
      );

      // Also try immediate notification for testing
      if (delay < 10000) {
        // Less than 10 seconds
        console.log(`🧪 Testing immediate notification...`);
        setTimeout(() => {
          Notifications.postLocalNotification(
            {
              ...notification,
              identifier: sessionId + '_test',
              title: '🧪 Test Notification',
              body: 'This is a test notification to verify the system works.',
            },
            0,
          );
        }, 2000); // 2 seconds delay for testing
      }
    } catch (error) {
      console.log('❌ Error scheduling notification:', error);
    }
  }

  // Cancel scheduled notification (if session ends early)
  static cancelSessionNotification(sessionId) {
    try {
      console.log(`Cancelling notification for session ${sessionId}`);
      Notifications.cancelLocalNotification(sessionId);
    } catch (error) {
      console.log('Error cancelling notification:', error);
    }
  }

  // Cancel all scheduled notifications
  static cancelAllNotifications() {
    try {
      console.log('Cancelling all notifications');
      Notifications.cancelAllLocalNotifications();
    } catch (error) {
      console.log('Error cancelling all notifications:', error);
    }
  }

  // Check if notifications are enabled
  static async checkPermissions() {
    try {
      if (Platform.OS === 'ios') {
        const permissions = await Notifications.ios.checkPermissions();
        console.log('Current iOS notification permissions:', permissions);
        return permissions;
      } else {
        // Android notifications are enabled by default
        return { alert: true, sound: true, badge: true };
      }
    } catch (error) {
      console.log('Error checking notification permissions:', error);
      return { alert: false, sound: false, badge: false };
    }
  }
}

export default NotificationService;
