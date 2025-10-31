import { SettingsService } from './settings.service';
import { SettingsChangeEvent } from '../types/settings.types';
import { WorkspaceManagerService } from './workspace-manager-wrapper.service';
import { WorkspaceEventType } from '../types/workspace.types';

/**
 * Settings broadcaster service
 * Broadcasts settings changes to connected extensions
 */
export class SettingsBroadcasterService {
  private settingsService: SettingsService;
  private workspaceManager: WorkspaceManagerService;

  constructor(
    settingsService: SettingsService,
    workspaceManager: WorkspaceManagerService
  ) {
    this.settingsService = settingsService;
    this.workspaceManager = workspaceManager;

    // Listen for settings changes
    this.settingsService.on('settingsChanged', (event: SettingsChangeEvent) => {
      this.broadcastSettingsChange(event);
    });
  }

  /**
   * Broadcast settings change to connected extension
   */
  private async broadcastSettingsChange(
    event: SettingsChangeEvent
  ): Promise<void> {
    try {
      console.log(
        `Broadcasting settings change for user ${event.userId}:`,
        event.changedFields
      );

      // Send settings update event to extension via WebSocket
      await this.workspaceManager.sendEvent(event.userId, {
        type: WorkspaceEventType.SETTINGS_UPDATED,
        timestamp: event.timestamp,
        payload: {
          settings: event.newSettings,
          changedFields: event.changedFields,
        },
      });

      console.log('Settings change broadcasted successfully');
    } catch (error) {
      console.error('Error broadcasting settings change:', error);
    }
  }

  /**
   * Broadcast settings to extension on connection
   */
  async broadcastSettingsOnConnect(userId: string): Promise<void> {
    try {
      const settings = await this.settingsService.getOrCreateSettings(userId);

      await this.workspaceManager.sendEvent(userId, {
        type: WorkspaceEventType.SETTINGS_LOADED,
        timestamp: new Date(),
        payload: {
          settings,
        },
      });

      console.log(`Settings broadcasted to user ${userId} on connection`);
    } catch (error) {
      console.error('Error broadcasting settings on connect:', error);
    }
  }
}
