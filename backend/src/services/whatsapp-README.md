# WhatsApp Integration Services

This directory contains the WhatsApp Business API integration for the Kiro IDE.

## Overview

The WhatsApp integration allows users to interact with their Kiro IDE workspace through WhatsApp messages. Users can execute commands, receive notifications, and access workspace information directly from WhatsApp.

## Components

### 1. WhatsApp Client Service (`whatsapp-client.service.ts`)

Low-level client for interacting with the WhatsApp Business API.

**Features:**
- Webhook signature verification
- Webhook token verification (for initial setup)
- Send text messages via WhatsApp API
- Configuration management

**Usage:**
```typescript
import { whatsappClient } from './whatsapp-client.service';

// Send a message
await whatsappClient.sendMessage('1234567890', 'Hello from Kiro!');

// Verify webhook signature
const isValid = whatsappClient.verifyWebhookSignature(signature, body);
```

### 2. WhatsApp Handler Service (`whatsapp-handler.service.ts`)

Processes incoming WhatsApp messages and routes them to appropriate handlers.

**Features:**
- Parse incoming webhook payloads
- Authenticate users and validate sessions
- Route messages to command processor
- Audit logging for all messages
- Error handling and user feedback

**Flow:**
1. Receive webhook payload
2. Extract message and sender information
3. Validate user authentication and session
4. Process command via command service
5. Send response back to user
6. Log audit entry

### 3. WhatsApp Sender Service (`whatsapp-sender.service.ts`)

High-level service for sending messages with advanced features.

**Features:**
- Automatic message chunking (for messages > 4096 characters)
- Retry logic with exponential backoff (max 3 attempts)
- Error message formatting
- Success message formatting
- Notification message formatting

**Usage:**
```typescript
import { whatsappSender } from './whatsapp-sender.service';

// Send a regular message
await whatsappSender.sendMessage('1234567890', 'Your message here');

// Send an error message
await whatsappSender.sendErrorMessage('1234567890', 'Something went wrong');

// Send a success message
await whatsappSender.sendSuccessMessage('1234567890', 'Operation completed');

// Send a notification
await whatsappSender.sendNotification('1234567890', 'Build Complete', 'Your build finished successfully');
```

### 4. WhatsApp Routes (`../routes/whatsapp.routes.ts`)

Express routes for WhatsApp webhook endpoints.

**Endpoints:**

- `GET /api/whatsapp/webhook` - Webhook verification endpoint
  - Used by WhatsApp to verify the webhook URL during setup
  - Validates the verify token

- `POST /api/whatsapp/webhook` - Incoming message webhook
  - Receives incoming messages from WhatsApp
  - Validates webhook signature
  - Processes messages asynchronously
  - Rate limited (60 requests per minute per user)

### 5. Rate Limit Middleware (`../middleware/rate-limit.middleware.ts`)

Redis-based rate limiting middleware.

**Features:**
- 60 requests per minute per user (configurable)
- Uses Redis for distributed rate limiting
- Adds rate limit headers to responses
- Extracts user identifier from various sources

## Configuration

Required environment variables (add to `.env`):

```env
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_TOKEN=your_whatsapp_api_token
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

## Setup Instructions

### 1. WhatsApp Business API Setup

1. Create a Meta (Facebook) Developer account
2. Create a new app and add WhatsApp Business API
3. Get your API token and phone number ID
4. Configure webhook URL: `https://your-domain.com/api/whatsapp/webhook`
5. Set webhook verify token (use a secure random string)
6. Subscribe to `messages` webhook field

### 2. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your WhatsApp API credentials
3. Generate a secure webhook secret for signature verification

### 3. Webhook Verification

When you configure the webhook URL in Meta Developer Console:
- WhatsApp will send a GET request to verify the endpoint
- The verify token must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- The endpoint will respond with the challenge parameter

## Message Flow

### Incoming Message Flow

```
WhatsApp User
    ↓
WhatsApp Business API
    ↓
POST /api/whatsapp/webhook (with signature)
    ↓
Rate Limit Middleware
    ↓
Signature Verification
    ↓
WhatsApp Handler Service
    ↓
User Authentication & Session Validation
    ↓
Command Service (parse & validate)
    ↓
[Future: Workspace Manager via WebSocket]
    ↓
WhatsApp Sender Service
    ↓
WhatsApp Business API
    ↓
WhatsApp User
```

### Outgoing Message Flow

```
Workspace Event / Command Response
    ↓
WhatsApp Sender Service
    ↓
Message Chunking (if needed)
    ↓
Retry Logic (max 3 attempts)
    ↓
WhatsApp Client Service
    ↓
WhatsApp Business API
    ↓
WhatsApp User
```

## Security Features

1. **Webhook Signature Verification**: All incoming webhooks are verified using HMAC-SHA256
2. **User Authentication**: Users must authenticate via Kiro IDE before using WhatsApp commands
3. **Session Management**: JWT-based sessions with 30-day expiration
4. **Rate Limiting**: 60 requests per minute per user to prevent abuse
5. **Audit Logging**: All commands and messages are logged to the database

## Error Handling

The integration includes comprehensive error handling:

- **Authentication Errors**: User-friendly messages for unauthenticated or expired sessions
- **Command Errors**: Validation errors with helpful feedback
- **System Errors**: Graceful degradation with retry logic
- **Rate Limit Errors**: Clear messaging about rate limits

## Message Chunking

Messages exceeding 4096 characters are automatically chunked:

- Splits at natural boundaries (newlines, spaces)
- Adds part indicators: `[Part 1/3]`
- Sends chunks sequentially with small delays
- Notifies user if delivery is incomplete

## Future Enhancements

- WebSocket integration with Kiro IDE extension (Task 6)
- Notification service for workspace events (Task 7)
- File operations (read, list, search)
- Workspace status queries
- Settings management

## Testing

To test the WhatsApp integration:

1. Set up a test WhatsApp Business account
2. Configure webhook URL (use ngrok for local testing)
3. Send test messages to your WhatsApp Business number
4. Check logs for webhook delivery and processing
5. Verify responses are received in WhatsApp

## Troubleshooting

### Webhook not receiving messages
- Verify webhook URL is publicly accessible
- Check webhook signature verification
- Ensure webhook is subscribed to `messages` field
- Check Meta Developer Console for webhook delivery logs

### Messages not sending
- Verify API token is valid
- Check phone number ID is correct
- Ensure recipient phone number is in correct format (no + sign)
- Check rate limits haven't been exceeded

### Rate limiting issues
- Verify Redis is running and accessible
- Check `RATE_LIMIT_PER_MINUTE` configuration
- Review rate limit logs in Redis

## Related Files

- Types: `../types/whatsapp.types.ts`
- Config: `../config/whatsapp.config.ts`
- Routes: `../routes/whatsapp.routes.ts`
- Middleware: `../middleware/rate-limit.middleware.ts`
