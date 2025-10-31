/**
 * Test script for notification flow
 * This script simulates the notification flow from event generation to WhatsApp delivery
 */

import { WorkspaceEvent, WorkspaceEventType } from './src/types/workspace.types';
import { notificationService } from './src/services/notification.service';
import { NotificationPriority } from './src/types/notification.types';

// Mock user data
const TEST_USER_ID = 'test-user-123';
const TEST_PHONE_NUMBER = '+1234567890';

/**
 * Test 1: Send a build complete notification
 */
async function testBuildCompleteNotification() {
  console.log('\n=== Test 1: Build Complete Notification ===');
  
  const event: WorkspaceEvent = {
    type: WorkspaceEventType.BUILD_COMPLETE,
    timestamp: new Date(),
    payload: {
      status: 'success',
      duration: 5000,
      errors: 0,
      warnings: 2,
    },
  };

  try {
    const notificationId = await notificationService.sendNotificationFromEvent(
      TEST_USER_ID,
      TEST_PHONE_NUMBER,
      event
    );

    if (notificationId) {
      console.log(`✅ Notification queued successfully: ${notificationId}`);
    } else {
      console.log('⚠️  Notification was filtered out (user settings)');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Test 2: Send an error notification
 */
async function testErrorNotification() {
  console.log('\n=== Test 2: Error Notification ===');
  
  const event: WorkspaceEvent = {
    type: WorkspaceEventType.ERROR,
    timestamp: new Date(),
    payload: {
      message: 'Syntax error: Unexpected token',
      source: 'TypeScript',
      severity: 'error',
      file: 'src/index.ts',
      line: 42,
      column: 10,
    },
  };

  try {
    const notificationId = await notificationService.sendNotificationFromEvent(
      TEST_USER_ID,
      TEST_PHONE_NUMBER,
      event
    );

    if (notificationId) {
      console.log(`✅ Notification queued successfully: ${notificationId}`);
    } else {
      console.log('⚠️  Notification was filtered out (user settings)');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Test 3: Send a Git operation notification
 */
async function testGitOperationNotification() {
  console.log('\n=== Test 3: Git Operation Notification ===');
  
  const event: WorkspaceEvent = {
    type: WorkspaceEventType.GIT_OPERATION,
    timestamp: new Date(),
    payload: {
      operation: 'commit',
      branch: 'main',
      success: true,
      message: 'feat: Add notification flow',
    },
  };

  try {
    const notificationId = await notificationService.sendNotificationFromEvent(
      TEST_USER_ID,
      TEST_PHONE_NUMBER,
      event
    );

    if (notificationId) {
      console.log(`✅ Notification queued successfully: ${notificationId}`);
    } else {
      console.log('⚠️  Notification was filtered out (user settings)');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Test 4: Send a file changed notification
 */
async function testFileChangedNotification() {
  console.log('\n=== Test 4: File Changed Notification ===');
  
  const event: WorkspaceEvent = {
    type: WorkspaceEventType.FILE_CHANGED,
    timestamp: new Date(),
    payload: {
      filePath: 'src/components/Button.tsx',
      changeType: 'modified',
    },
  };

  try {
    const notificationId = await notificationService.sendNotificationFromEvent(
      TEST_USER_ID,
      TEST_PHONE_NUMBER,
      event
    );

    if (notificationId) {
      console.log(`✅ Notification queued successfully: ${notificationId}`);
    } else {
      console.log('⚠️  Notification was filtered out (user settings)');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Test 5: Send a direct notification (not from event)
 */
async function testDirectNotification() {
  console.log('\n=== Test 5: Direct Notification ===');
  
  try {
    const notificationId = await notificationService.sendNotification(
      TEST_USER_ID,
      TEST_PHONE_NUMBER,
      'BUILD_COMPLETE' as any,
      'Test Notification',
      'This is a test notification sent directly',
      NotificationPriority.MEDIUM,
      { test: true }
    );

    if (notificationId) {
      console.log(`✅ Notification queued successfully: ${notificationId}`);
    } else {
      console.log('⚠️  Notification was filtered out (user settings)');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Test 6: Send multiple notifications to test batching
 */
async function testNotificationBatching() {
  console.log('\n=== Test 6: Notification Batching ===');
  console.log('Sending 3 notifications within 30 seconds to test batching...');
  
  const events: WorkspaceEvent[] = [
    {
      type: WorkspaceEventType.BUILD_COMPLETE,
      timestamp: new Date(),
      payload: { status: 'success', duration: 3000, errors: 0, warnings: 0 },
    },
    {
      type: WorkspaceEventType.ERROR,
      timestamp: new Date(),
      payload: { message: 'Test error 1', source: 'Test', severity: 'error' },
    },
    {
      type: WorkspaceEventType.GIT_OPERATION,
      timestamp: new Date(),
      payload: { operation: 'push', branch: 'main', success: true },
    },
  ];

  try {
    for (let i = 0; i < events.length; i++) {
      const notificationId = await notificationService.sendNotificationFromEvent(
        TEST_USER_ID,
        TEST_PHONE_NUMBER,
        events[i]
      );

      if (notificationId) {
        console.log(`✅ Notification ${i + 1} queued: ${notificationId}`);
      } else {
        console.log(`⚠️  Notification ${i + 1} was filtered out`);
      }

      // Small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📦 All notifications queued. They should be batched and sent together.');
    console.log('⏱️  Wait 30 seconds for batch processing...');
  } catch (error) {
    console.error('❌ Error in batching test:', error);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting Notification Flow Tests');
  console.log('=====================================');
  
  try {
    await testBuildCompleteNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testErrorNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGitOperationNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testFileChangedNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testDirectNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testNotificationBatching();
    
    console.log('\n=====================================');
    console.log('✅ All tests completed!');
    console.log('\nNote: These tests queue notifications but do not actually send them.');
    console.log('To test actual WhatsApp delivery, ensure:');
    console.log('1. Redis is running');
    console.log('2. WhatsApp API credentials are configured');
    console.log('3. User exists in database with valid phone number');
    console.log('4. Notification processor is running');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n👋 Test script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export {
  testBuildCompleteNotification,
  testErrorNotification,
  testGitOperationNotification,
  testFileChangedNotification,
  testDirectNotification,
  testNotificationBatching,
  runAllTests,
};
