# Kiro WhatsApp Integration

A bridge application that enables developers to interact with their Kiro IDE workspace through WhatsApp messaging.

## Project Structure

```
.
├── backend/              # Backend service (Node.js/Express)
│   ├── src/             # Source code
│   ├── prisma/          # Database schema and migrations
│   ├── Dockerfile       # Docker configuration
│   └── package.json     # Dependencies and scripts
│
└── extension/           # Kiro IDE extension (VS Code)
    ├── src/            # Extension source code
    └── package.json    # Extension manifest and dependencies
```

## Getting Started

### Backend Service

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   copy .env.example .env
   ```

4. Configure your `.env` file with appropriate values

5. Run in development mode:
   ```bash
   npm run dev
   ```

6. Build for production:
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment

1. Start all services with Docker Compose:
   ```bash
   cd backend
   docker-compose up -d
   ```

2. Stop services:
   ```bash
   docker-compose down
   ```

### Kiro IDE Extension

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Open in VS Code and press F5 to run in debug mode

## Features

- **Authentication**: Secure verification code-based authentication
- **File Operations**: Read files, list directories, search workspace
- **Notifications**: Real-time updates for builds, errors, and Git operations
- **Settings Management**: Configurable access control and preferences
- **Security**: Rate limiting, audit logging, and directory-level permissions

## Requirements

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- VS Code 1.85.0+
- WhatsApp Business API account

## Documentation

See individual README files in `backend/` and `extension/` directories for detailed documentation.

## License

MIT
