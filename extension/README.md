# Kiro WhatsApp Integration Extension

This VS Code extension enables WhatsApp-based workspace access and management for Kiro IDE.

## Features

- WebSocket server for backend communication
- Workspace file operations (read, list, search)
- Event notifications for builds, errors, and Git operations
- Configurable access control and permissions

## Configuration

Access settings via `Kiro WhatsApp: Open Settings` command or VS Code settings:

- `kiroWhatsapp.websocketPort`: WebSocket server port (default: 3001)
- `kiroWhatsapp.autoStart`: Auto-start server on activation (default: true)
- `kiroWhatsapp.accessibleDirectories`: Restrict access to specific directories
- `kiroWhatsapp.readOnlyMode`: Enable read-only mode (default: true)
- `kiroWhatsapp.enableNotifications`: Enable event notifications (default: true)
- `kiroWhatsapp.notificationTypes`: Types of notifications to send

## Commands

- `Kiro WhatsApp: Open Settings` - Open settings panel
- `Kiro WhatsApp: Start WebSocket Server` - Manually start server
- `Kiro WhatsApp: Stop WebSocket Server` - Stop server
- `Kiro WhatsApp: Show Connection Status` - Display connection status

## Requirements

- VS Code 1.85.0 or higher
- Kiro WhatsApp Backend Service running

## Installation

1. Install the extension
2. Configure backend service URL
3. Start WebSocket server (auto-starts by default)
4. Authenticate via WhatsApp

## License

MIT
