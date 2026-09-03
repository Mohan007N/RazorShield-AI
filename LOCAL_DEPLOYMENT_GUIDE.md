# 🏠 RazorShield AI - Local Deployment Guide

Complete guide to run RazorShield AI on your local Windows machine.

---

## 📋 Prerequisites

### Required Software

1. **Docker Desktop** (for running services)
   - Download: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop
   - Verify: `docker --version` and `docker-compose --version`

2. **Python 3.11+** (if running workers locally)
   - Download: https://www.python.org/downloads/
   - Verify: `python --version`

3. **Node.js 18+** (for frontend)
   - Download: https://nodejs.org/
   - Verify: `node --version`

4. **ngrok** (for Razorpay webhooks - optional)
   - Download: https://ngrok.com/download
   - Or skip if not using Razorpay webhooks

---

## 🚀 Quick Start (Easiest Method)

### Option 1: Docker Compose (Recommended)

This starts everything with one command!

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/Mohan007N/RazorShield-AI.git
cd RazorShield-AI

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your settings
# (Already done with your Razorpay keys)

# 4. Start everything
docker-compose up -d

# 5. Check status
docker-compose ps

# Should show:
# - postgres (running)
# - redis (running)
# - api (running)
# - frontend (running)
```

**Access the application**:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 🔧 Option 2: Run Services Separately (For Development)

### Step 1: Start Infrastructure (Docker)

```bash
# Start only PostgreSQL and Redis
docker-compose up postgres redis -d

# Verify they're running
docker-compose ps
```

### Step 2: Set Up Backend

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations (if needed)
# alembic upgrade head

# Start the API
uvicorn backend.app.main:app --reload --port 8000
```

**API will be available at**: http://localhost:8000

### Step 3: Set Up Frontend

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend will be available at**: http://localhost:5173

---

## 🎯 Configuration for Local Development

### Your `.env` File (Minimal Setup)

```bash
# ─── Application ───
APP_NAME=RazorShield AI
APP_MODE=dev
DEBUG=true
API_HOST=0.0.0.0
API_PORT=8000
SECRET_KEY=your-secret-key-here

# ─── Database ───
# Using SQLite for simplicity (current setting)
DATABASE_URL=sqlite+aiosqlite:///./razorshield.db
DATABASE_SYNC_URL=sqlite:///./razorshield.db

# OR use PostgreSQL (via Docker)
# DATABASE_URL=postgresql+asyncpg://razorshield:razorshield@localhost:5432/razorshield
# DATABASE_SYNC_URL=postgresql://razorshield:razorshield@localhost:5432/razorshield

# ─── Redis ───
REDIS_URL=redis://localhost:6379/0

# ─── Kafka ───
NO_KAFKA=true  # Disable for simple local testing
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# ─── Razorpay (Test Mode) ───
RAZORPAY_KEY_ID=rzp_test_TXchA0bRMvKFF2
RAZORPAY_KEY_SECRET=A1kqoqF0xzQsLE5H1k21LOfH
RAZORPAY_WEBHOOK_SECRET=  # Add after creating webhook

# ─── LLM (Optional - for investigation agent) ───
LLM_PROVIDER=openai
OPENAI_API_KEY=  # Add your OpenAI API key
LLM_MODEL=gpt-4o-mini  # Use cheaper model for testing
LLM_TEMPERATURE=0.1

# ─── Security ───
API_KEY=razorshield-dev-key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 🧪 Testing the Local Setup

### 1. Health Check

```bash
# Check API is running
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","service":"RazorShield AI","mode":"dev"}
```

### 2. Test Transaction

```bash
curl -X POST http://localhost:8000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d "{\"merchant_id\":\"test_merchant\",\"amount\":5000,\"currency\":\"INR\",\"payment_method\":\"card\",\"status\":\"success\"}"
```

### 3. Simulate Fraud Spike

```bash
curl -X POST http://localhost:8000/api/v1/test/simulate-spike \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d "{\"merchant_id\":\"spike_test\",\"normal_txn_count\":100,\"spike_txn_count\":850,\"spike_duration_minutes\":1,\"suspicious_ratio\":0.15}"
```

### 4. View Dashboard

Open browser: http://localhost:5173

You should see:
- Dashboard with metrics
- Live Activity feed
- Alerts section
- Investigation panel

---

## 🔗 Setting Up Razorpay Webhooks (Local)

Since you're running locally, you need to expose your local server to the internet.

### Using ngrok

```bash
# 1. Install ngrok
# Download from: https://ngrok.com/download

# 2. Start ngrok
ngrok http 8000

# 3. Copy the forwarding URL (e.g., https://abc123.ngrok-free.app)

# 4. In Razorpay Dashboard:
# - Webhook URL: https://abc123.ngrok-free.app/api/v1/webhooks/razorpay
# - Select events: payment.authorized, payment.captured, payment.failed
# - Save and copy the webhook secret

# 5. Update .env
RAZORPAY_WEBHOOK_SECRET=whsec_your_secret_here

# 6. Restart API
# Ctrl+C and run again
uvicorn backend.app.main:app --reload --port 8000
```

### Test Webhook

```bash
# Send a test webhook from Razorpay Dashboard
# Or use their test API to create a payment
```

---

## 🐳 Docker Compose Services Overview

When you run `docker-compose up -d`, you get:

| Service | Port | Purpose |
|---------|------|---------|
| **postgres** | 5432 | Database |
| **redis** | 6379 | Cache & real-time features |
| **api** | 8000 | FastAPI backend |
| **frontend** | 5173 | React dashboard |

### Useful Docker Commands

```bash
# View logs
docker-compose logs -f api

# Restart a service
docker-compose restart api

# Stop everything
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# View resource usage
docker stats
```

---

## 📊 Database Setup

### Using SQLite (Simplest - Current)

Already configured in `.env`:
```bash
DATABASE_URL=sqlite+aiosqlite:///./razorshield.db
```

No setup needed! Database file created automatically.

### Using PostgreSQL (Recommended for Testing)

```bash
# 1. Update .env
DATABASE_URL=postgresql+asyncpg://razorshield:razorshield@localhost:5432/razorshield
DATABASE_SYNC_URL=postgresql://razorshield:razorshield@localhost:5432/razorshield

# 2. Start PostgreSQL
docker-compose up postgres -d

# 3. Run migrations (if needed)
# cd backend
# alembic upgrade head

# 4. Restart API
```

---

## 🔥 With Kafka (Event-Driven Mode)

If you want to test the full production architecture locally:

### 1. Update .env

```bash
NO_KAFKA=false
APP_MODE=scalable
```

### 2. Start Full Stack

```bash
docker-compose --profile scalable up -d
```

This starts:
- PostgreSQL
- Redis
- Kafka + Zookeeper
- API (3 replicas)
- Risk Worker
- Analytics Worker
- Audit Worker
- Frontend
- NGINX (load balancer)

### 3. Access via NGINX

- Frontend: http://localhost:80
- API: http://localhost:80/api

---

## 🛠️ Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process
taskkill /PID <PID> /F
```

### Docker Issues

```bash
# Restart Docker Desktop

# Clean up
docker system prune -a

# Restart services
docker-compose down -v
docker-compose up -d
```

### API Not Starting

```bash
# Check Python version
python --version  # Should be 3.11+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check for port conflicts
netstat -ano | findstr :8000
```

### Frontend Not Loading

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart dev server
npm run dev
```

### Database Connection Error

```bash
# If using PostgreSQL, check it's running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check connection
docker exec -it razorshield-postgres-1 psql -U razorshield -d razorshield
```

---

## 📁 Project Structure

```
RazorShield-AI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── api/routes.py        # API endpoints
│   │   ├── workers/             # Background workers
│   │   ├── risk/                # ML models
│   │   ├── agent/               # LangGraph agent
│   │   └── ...
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # React pages
│   │   └── services/api.ts      # API client
│   └── package.json
├── ml/
│   ├── models/                  # Trained models
│   └── data/                    # Training data
├── docker-compose.yml           # Docker orchestration
├── .env                         # Your configuration
└── LOCAL_DEPLOYMENT_GUIDE.md   # This file
```

---

## ✅ Quick Checklist

- [ ] Docker Desktop installed and running
- [ ] `.env` file configured
- [ ] Razorpay keys added to `.env`
- [ ] Run `docker-compose up -d`
- [ ] Access http://localhost:5173
- [ ] Test transaction endpoint
- [ ] (Optional) Set up ngrok for webhooks
- [ ] (Optional) Add OpenAI API key for agent

---

## 🎯 Common Use Cases

### Just Want to See the Dashboard?

```bash
docker-compose up -d
# Open http://localhost:5173
```

### Want to Test Fraud Detection?

```bash
# 1. Start services
docker-compose up -d

# 2. Send spike simulation
curl -X POST http://localhost:8000/api/v1/test/simulate-spike \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{"merchant_id":"test","normal_txn_count":100,"spike_txn_count":850,"spike_duration_minutes":1,"suspicious_ratio":0.15}'

# 3. Check dashboard for alert
```

### Want to Develop/Debug?

```bash
# 1. Start infrastructure only
docker-compose up postgres redis -d

# 2. Run backend locally
cd backend
venv\Scripts\activate
uvicorn backend.app.main:app --reload

# 3. Run frontend locally
cd frontend
npm run dev

# 4. Make changes and see hot reload
```

---

## 📞 Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Restart services: `docker-compose restart`
3. Clean slate: `docker-compose down -v && docker-compose up -d`
4. Check `.env` configuration
5. Verify all prerequisites installed

---

## 🎉 You're Ready!

Your RazorShield AI is now running locally. Start testing fraud detection! 🚀

**Quick Start**: `docker-compose up -d` → Open http://localhost:5173
