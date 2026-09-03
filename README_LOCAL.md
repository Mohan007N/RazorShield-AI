# 🏠 RazorShield AI - Local Deployment

Run the complete fraud detection system on your local machine in minutes!

---

## 🎯 Quick Start (Windows)

### One-Click Start

1. **Double-click** `start_local.bat`
2. **Wait** 30 seconds for services to start
3. **Open** http://localhost:5173
4. **Done!** ✅

That's it! The dashboard will open automatically.

---

## 📋 What You Need

### Essential (Must Have)

1. ✅ **Docker Desktop** - Already installed ✓
   - Running and healthy
   
2. ✅ **Git** - Already have the code ✓
   - Repository cloned

### Optional (For Full Features)

3. ⚠️ **OpenAI API Key** - For AI investigation agent
   - Get from: https://platform.openai.com/api-keys
   - Add to `.env`: `OPENAI_API_KEY=sk-...`

4. ⚠️ **Razorpay Webhook Secret** - For real webhooks
   - Get from: Razorpay Dashboard → Webhooks
   - Add to `.env`: `RAZORPAY_WEBHOOK_SECRET=whsec_...`

---

## 🚀 Deployment Options

### Option 1: Simple Mode (Current Setup)

**What runs**: API + Frontend + PostgreSQL + Redis

**Best for**: Testing, demos, development

**Command**: Already configured!
```bash
start_local.bat
```

**Services**:
- ✅ PostgreSQL (database)
- ✅ Redis (cache)
- ✅ FastAPI (backend)
- ✅ React (frontend)

### Option 2: Full Production Mode

**What runs**: Everything + Kafka + Workers + NGINX

**Best for**: Testing real-time processing at scale

**Command**:
```bash
docker-compose --profile scalable up -d
```

**Additional Services**:
- ✅ Kafka (event streaming)
- ✅ Risk Worker (fraud detection)
- ✅ Analytics Worker (metrics)
- ✅ Audit Worker (compliance)
- ✅ NGINX (load balancer)

---

## 🌐 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:5173 | Main UI |
| **API** | http://localhost:8000 | REST API |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **Health Check** | http://localhost:8000/health | Service status |

---

## 🧪 Testing the System

### 1. Open Dashboard

```
http://localhost:5173
```

### 2. Send Test Transaction

**Windows CMD/PowerShell**:
```powershell
curl -X POST http://localhost:8000/api/v1/transactions `
  -H "Content-Type: application/json" `
  -H "X-API-Key: razorshield-dev-key" `
  -d '{\"merchant_id\":\"test_merchant\",\"amount\":5000,\"currency\":\"INR\",\"payment_method\":\"card\",\"status\":\"success\"}'
```

**Or use the API Docs**: http://localhost:8000/docs

### 3. Simulate Fraud Spike (850 txn/min)

**Via API Docs**:
1. Go to http://localhost:8000/docs
2. Find `POST /api/v1/test/simulate-spike`
3. Click "Try it out"
4. Use this payload:
```json
{
  "merchant_id": "spike_test",
  "normal_txn_count": 100,
  "spike_txn_count": 850,
  "spike_duration_minutes": 1,
  "suspicious_ratio": 0.15
}
```
5. Click "Execute"

### 4. View Results

- Dashboard will show alert
- Click "Investigate" to trigger AI agent
- View evidence and recommendations

---

## 🔧 Configuration

### Your Current `.env` Setup

```bash
# Already configured:
✅ Razorpay Key ID: rzp_test_TXchA0bRMvKFF2
✅ Razorpay Key Secret: (configured)
✅ Database: SQLite (simple)
✅ Redis: localhost:6379
✅ API Key: razorshield-dev-key

# Optional (not required for testing):
⚠️ OpenAI API Key: (add for AI agent)
⚠️ Webhook Secret: (add for real webhooks)
```

### To Add OpenAI (For AI Investigations)

1. Get API key: https://platform.openai.com/api-keys
2. Edit `.env`:
   ```bash
   OPENAI_API_KEY=sk-proj-your-key-here
   ```
3. Restart:
   ```bash
   docker-compose restart api
   ```

---

## 📊 What's Running?

### Check Service Status

```bash
docker-compose ps
```

Should show:
```
NAME                    STATUS
razorshield-postgres-1  Up (healthy)
razorshield-redis-1     Up (healthy)
razorshield-api-1       Up
razorshield-frontend-1  Up
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 50 lines
docker-compose logs --tail=50 api
```

---

## 🛠️ Common Commands

### Start
```bash
start_local.bat
# or
docker-compose up -d
```

### Stop
```bash
docker-compose down
```

### Restart
```bash
docker-compose restart
```

### Clean Restart (fresh start)
```bash
docker-compose down -v
docker-compose up -d
```

### Check Logs
```bash
docker-compose logs -f api
```

---

## 🐛 Troubleshooting

### Problem: Port 5173 already in use

**Solution**:
```bash
# Kill the process
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Restart
docker-compose restart frontend
```

### Problem: Docker not running

**Solution**:
1. Open Docker Desktop
2. Wait for it to start (green indicator)
3. Run `start_local.bat` again

### Problem: API not responding

**Solution**:
```bash
# Check logs
docker-compose logs api

# Restart API
docker-compose restart api

# If still failing, clean restart
docker-compose down -v
docker-compose up -d
```

### Problem: Database error

**Solution**:
```bash
# Clean restart (removes old data)
docker-compose down -v
docker-compose up -d
```

### Problem: Can't access dashboard

**Solution**:
1. Check all services running: `docker-compose ps`
2. Check Docker Desktop is running
3. Try: http://localhost:5173 (not HTTPS)
4. Clear browser cache

---

## 📁 Project Structure

```
E:\RazorShield AI\
├── start_local.bat          ← Double-click to start
├── .env                     ← Your configuration
├── docker-compose.yml       ← Service definitions
├── LOCAL_DEPLOYMENT_GUIDE.md ← Detailed guide
├── README_LOCAL.md          ← This file
│
├── backend/                 ← Python FastAPI
│   ├── app/
│   │   ├── main.py         ← API entry point
│   │   ├── api/routes.py   ← Endpoints
│   │   ├── workers/        ← Background workers
│   │   └── risk/           ← ML models
│   └── requirements.txt
│
├── frontend/                ← React Dashboard
│   ├── src/
│   │   ├── pages/          ← Dashboard pages
│   │   └── services/       ← API client
│   └── package.json
│
└── ml/                      ← Machine Learning
    ├── models/              ← Trained models
    └── data/                ← Training data
```

---

## 🎮 Features You Can Test

### ✅ Available Now (No Extra Setup)

1. **Dashboard** - View metrics and alerts
2. **Fraud Detection** - ML-based risk scoring
3. **Anomaly Detection** - Statistical spike detection
4. **Transaction Simulation** - Generate test data
5. **Alert Management** - View and investigate alerts
6. **Live Activity** - Real-time transaction feed
7. **Model Performance** - View ML metrics

### ⚠️ Requires Additional Setup

8. **AI Investigation Agent** - Needs OpenAI API key
9. **Razorpay Webhooks** - Needs webhook secret + ngrok
10. **Real-time Workers** - Run with `--profile scalable`

---

## 🚀 Next Steps

### For Testing

1. ✅ Start services: `start_local.bat`
2. ✅ Open dashboard: http://localhost:5173
3. ✅ Test fraud simulation (use API docs)
4. ✅ View results in dashboard

### For Development

1. See `LOCAL_DEPLOYMENT_GUIDE.md` for detailed setup
2. Run backend/frontend separately for hot reload
3. Use VS Code with Python + React extensions

### For Production-Like Testing

1. Update `.env`: Set `NO_KAFKA=false`
2. Run: `docker-compose --profile scalable up -d`
3. Test with high load (850 txn/min)

---

## 📞 Quick Help

| Issue | Solution |
|-------|----------|
| Services won't start | Check Docker Desktop is running |
| Port conflict | Kill process using the port |
| API errors | Check logs: `docker-compose logs api` |
| Dashboard blank | Wait 30 sec, refresh browser |
| Database error | Run: `docker-compose down -v && docker-compose up -d` |

---

## ✅ Success Checklist

- [x] Docker Desktop installed and running
- [x] Repository cloned
- [x] `.env` file configured with Razorpay keys
- [ ] Run `start_local.bat`
- [ ] Access http://localhost:5173
- [ ] Test fraud simulation
- [ ] View results in dashboard

---

## 🎉 You're All Set!

**Your RazorShield AI is ready to detect fraud locally!**

Just run:
```bash
start_local.bat
```

And open: **http://localhost:5173**

Enjoy! 🚀
