# 🚀 RazorShield AI - Setup Instructions

## ⚠️ Important: Docker Not Detected

Docker is not installed on your system. You have two options:

---

## Option 1: Install Docker (Recommended)

### Why Docker?
- **Easiest setup** - Everything works out of the box
- **All features available** - PostgreSQL, Redis, Kafka
- **Production-like** - Same environment everywhere
- **One command start** - `docker-compose up -d`

### How to Install Docker

1. **Download Docker Desktop**
   - Go to: https://www.docker.com/products/docker-desktop
   - Download for Windows
   - File size: ~500MB

2. **Install**
   - Run the installer
   - Follow the wizard
   - Restart your computer if prompted

3. **Verify**
   ```bash
   docker --version
   docker-compose --version
   ```

4. **Start RazorShield**
   ```bash
   # Just double-click
   start_local.bat
   ```

**Time needed**: 15 minutes (including download)

---

## Option 2: Run Without Docker (Currently Running)

### What's Happening Now

Your system is installing Python dependencies. This will take **3-5 minutes**.

The script `start_without_docker.bat` is running and will:
1. ✅ Install Python dependencies (IN PROGRESS)
2. Install Node.js dependencies
3. Start the backend API
4. Start the frontend dashboard

### Wait for It to Complete

The installation is downloading and installing:
- FastAPI and web framework
- Machine Learning libraries (scikit-learn, XGBoost, pandas)
- LangChain and OpenAI integration
- Database and caching libraries

### What to Expect

After installation completes, you'll see:
- Two command windows open
- Backend API running on port 8000
- Frontend dashboard on port 5173
- Browser will open automatically

### Limitations (Without Docker)

Without Docker, you'll have:
- ✅ Full UI dashboard
- ✅ API endpoints
- ✅ Fraud detection ML
- ✅ AI investigation agent
- ✅ Test/simulation features
- ❌ No PostgreSQL (uses SQLite instead - still works!)
- ❌ No Redis (not needed for basic testing)
- ❌ No Kafka (sync mode - still works!)

**All fraud detection features work, just in simpler mode!**

---

## What You Can Do While Waiting

1. **Keep the installation running** - Don't close the window
2. **Read the documentation**:
   - `README_LOCAL.md` - Quick reference
   - `LOCAL_DEPLOYMENT_GUIDE.md` - Detailed guide
3. **Check your `.env` file** - Already configured with your keys

---

## After Installation Completes

### You'll See Two Windows

1. **Backend API Window**
   - Shows FastAPI logs
   - Port 8000
   - Don't close this!

2. **Frontend Dashboard Window**
   - Shows React dev server
   - Port 5173
   - Don't close this!

### Access the Application

- Dashboard: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Test It

1. Go to http://localhost:8000/docs
2. Find `POST /api/v1/test/simulate-spike`
3. Click "Try it out"
4. Click "Execute"
5. View results in dashboard

---

## Troubleshooting

### If Installation Fails

```bash
# Try running manually
cd backend
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### If Ports Are Busy

```bash
# Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Find and kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Still Having Issues?

Install Docker - it's much simpler! 😊

---

## Next Steps

1. **Wait for installation** (~3-5 minutes remaining)
2. **Dashboard will open automatically**
3. **Test fraud detection**
4. **Have fun detecting fraud!** 🎉

---

## Quick Reference

| What | Where |
|------|-------|
| Dashboard | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Stop Everything | Close both command windows |
| Restart | Run `start_without_docker.bat` again |

---

**Recommendation**: Install Docker for the best experience! But the current setup will work perfectly for testing and development.
