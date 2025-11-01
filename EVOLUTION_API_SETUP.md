# Evolution API Setup Guide

## Quick Deploy to Railway

### Step 1: Deploy Evolution API

1. Go to https://railway.app
2. Click "New Project"
3. Select "Empty Project"
4. Click "Deploy"
5. Select "Docker Image"
6. Enter: `atendai/evolution-api:latest`

### Step 2: Configure Environment Variables

Click on your service → Variables → Add these:

```env
AUTHENTICATION_API_KEY=generate-a-random-key-here
DATABASE_ENABLED=false
DATABASE_SAVE_DATA_INSTANCE=false
SERVER_URL=https://your-app.up.railway.app
CORS_ORIGIN=*
CORS_CREDENTIALS=true
```

**Generate API Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Get Your Evolution API URL

After deployment, Railway will give you a URL like:
`https://your-evolution-api.up.railway.app`

### Step 4: Test Your Evolution API

```bash
# Health check
curl https://your-evolution-api.up.railway.app

# Should return Evolution API info
```

---

## Alternative: Deploy to Render

### One-Click Deploy

1. Go to https://render.com
2. New → Web Service
3. Select "Deploy an existing image from a registry"
4. Image URL: `atendai/evolution-api:latest`
5. Instance Type: Free
6. Add environment variables (same as above)
7. Create Web Service

---

## Using Evolution API

### Create WhatsApp Instance

```bash
curl -X POST https://your-evolution-api.up.railway.app/instance/create \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "kiro-whatsapp",
    "qrcode": true
  }'
```

### Get QR Code

```bash
curl https://your-evolution-api.up.railway.app/instance/connect/kiro-whatsapp \
  -H "apikey: YOUR_API_KEY"
```

### Send Message

```bash
curl -X POST https://your-evolution-api.up.railway.app/message/sendText/kiro-whatsapp \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "text": "Hello from Kiro!"
  }'
```

---

## Update Your Backend

Once Evolution API is deployed, update your backend `.env`:

```env
# Evolution API Configuration
EVOLUTION_API_URL=https://your-evolution-api.up.railway.app
EVOLUTION_API_KEY=your-api-key-here
EVOLUTION_INSTANCE_NAME=kiro-whatsapp
```

---

## Next Steps

1. Deploy Evolution API (5 minutes)
2. Get your API URL and key
3. Update backend configuration
4. I'll help you integrate it with your backend

---

## Documentation

- Evolution API Docs: https://doc.evolution-api.com
- GitHub: https://github.com/EvolutionAPI/evolution-api
- Swagger UI: https://your-api-url/api-docs
