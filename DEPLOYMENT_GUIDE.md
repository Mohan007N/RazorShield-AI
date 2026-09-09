# 🚀 RazorShield AI — Cloud Deployment Guide (Vercel + Render)

This guide walks you through deploying **RazorShield AI** to production with **Frontend on Vercel** and **Backend on Render** in under 5 minutes.

```
┌────────────────────────────────┐         WebSocket / REST         ┌─────────────────────────────────┐
│     Vercel (React Frontend)    │ ◄──────────────────────────────► │     Render (FastAPI Backend)    │
│  https://razorshield.vercel.app│                                  │ https://razorshield.onrender.com│
└────────────────────────────────┘                                  └────────────────┬────────────────┘
                                                                                     │ Webhooks
                                                                    ┌────────────────┴────────────────┐
                                                                    │        Razorpay Dashboard       │
                                                                    │      (Live / Test Webhooks)     │
                                                                    └─────────────────────────────────┘
```

---

## Part 1: Deploy Backend to Render

### Option A: Render Blueprint (Automatic & Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository: `Mohan007N/RazorShield-AI`.
4. Render will detect [`render.yaml`](file:///e:/RazorShield%20AI/render.yaml) and automatically configure the Web Service with Python 3.11, SQLite fallback, and auto port binding.
5. Click **Apply**.

---

### Option B: Manual Web Service Setup
1. On Render, click **New +** → **Web Service**.
2. Select repository `Mohan007N/RazorShield-AI`.
3. Configure the settings:
   - **Name**: `razorshield-backend` (or your preferred name)
   - **Region**: Singapore (or nearest to your users)
   - **Branch**: `main`
   - **Root Directory**: *(leave blank)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: `Free`

4. Add **Environment Variables** under the Environment tab:
   | Key | Value | Description |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.9` | Ensures Python 3.11 compatibility |
   | `APP_MODE` | `demo` | Enables autonomous demo simulations |
   | `DEBUG` | `false` | Production mode |
   | `NO_KAFKA` | `true` | Uses built-in async in-memory queue |
   | `DATABASE_URL` | `sqlite+aiosqlite:///./razorshield.db` | Zero-setup persistent/ephemeral SQLite |
   | `DATABASE_SYNC_URL` | `sqlite:///./razorshield.db` | Sync DB connection string |
   | `SECRET_KEY` | *(generate a random 32-char string)* | JWT and session encryption |
   | `API_KEY` | `razorshield-dev-key` | API authorization key |
   | `CORS_ORIGINS` | `*` | Allows requests from your Vercel URL |
   | `RAZORPAY_KEY_ID` | `rzp_test_...` *(Optional)* | Your Razorpay API Key |
   | `RAZORPAY_KEY_SECRET` | *(Optional)* | Your Razorpay API Secret |
   | `RAZORPAY_WEBHOOK_SECRET` | *(Optional)* | Your Webhook Secret for signature validation |
   | `OPENAI_API_KEY` or `GOOGLE_API_KEY` | *(Optional)* | For live LLM investigation reports |

5. Click **Create Web Service**.
6. Once deployed, copy your backend URL (e.g., `https://razorshield-backend.onrender.com`).
7. Verify health: visit `https://razorshield-backend.onrender.com/health` in your browser.

---

## Part 2: Deploy Frontend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository: `Mohan007N/RazorShield-AI`.
4. In the Project Configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend` (or leave default root, both are supported).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   | Key | Value | Example |
   |---|---|---|
   | `VITE_API_URL` | Your Render Backend URL | `https://razorshield-backend.onrender.com` |

   *(Note: The frontend will automatically convert `https://` to `wss://` for real-time WebSocket telemetry.)*

6. Click **Deploy**.
7. Once deployment finishes, Vercel will give you a live production URL (e.g., `https://razorshield-ai.vercel.app`).

---

## Part 3: Configure Razorpay Webhook (Production)

To stream real transactions from your Razorpay test/live account:

1. Open [Razorpay Dashboard](https://dashboard.razorpay.com/#/access/webhooks).
2. Click **Add New Webhook**.
3. Configure:
   - **Webhook URL**:
     ```
     https://your-backend-name.onrender.com/api/v1/webhooks/razorpay
     ```
   - **Secret**: Enter the same secret set in `RAZORPAY_WEBHOOK_SECRET` on Render (or leave empty if testing with dev bypass).
   - **Active Events**:
     - `payment.authorized`
     - `payment.failed`
     - `payment.captured`
     - `order.paid`
     - `refund.created`
4. Click **Save Webhook**.

---

## Part 4: Verification & Live Testing

### 1. Health Checks
- Backend: `https://your-backend-name.onrender.com/health` → `{"status":"ok"}`
- Frontend: Open your Vercel URL → The login page should load seamlessly with dark/light themes.

### 2. Real-Time Telemetry & Live Activity
1. Sign in (Demo credentials provided on the login page: `admin@razorshield.ai` / `admin123`).
2. Navigate to **Live Activity**:
   - The status indicator at the top right should show **LIVE STREAM CONNECTED (WSS)**.
   - Click **Send Test Webhook** to simulate an instant incoming transaction and verify real-time alert triggers.
3. Open **Fraud Simulator**:
   - Select an attack pattern (e.g. *Card Testing Botnet* or *Velocity Surge*).
   - Click **Start Simulation Attack** and watch live TPS spikes in the overview telemetry stream!
