# RazorShield AI — Workers Quick Start Guide

This guide shows you how to run the production-scale architecture with Kafka workers.

## 🏗️ Architecture Overview

### Before (Synchronous)
```
API Request → Sync Processing → Response (slow under load)
```

### After (Event-Driven)
```
API Request → Kafka Queue → Response (immediate)
                 ↓
         ┌───────┼──────────┐
         ↓       ↓          ↓
    Risk     Analytics   Audit
    Worker   Worker      Worker
         ↓       ↓          ↓
    Redis   PostgreSQL  PostgreSQL
```

## 🚀 Quick Start

### Option 1: Full Production Stack (Recommended)

Start everything with Docker Compose:

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start the full stack (Kafka + Workers)
docker-compose --profile scalable up -d

# 3. Check status
docker-compose ps

# You should see:
# - postgres (running)
# - redis (running)
# - zookeeper (running)
# - kafka (running)
# - api (running)
# - risk-worker (running)
# - analytics-worker (running)
# - audit-worker (running)
# - frontend (running)
# - nginx (running)
```

**What's Running**:
- ✅ PostgreSQL on port 5432
- ✅ Redis on port 6379
- ✅ Kafka on port 9092
- ✅ API (3 replicas) behind NGINX on port 80
- ✅ Risk Worker (consuming payment.events)
- ✅ Analytics Worker (updating baselines)
- ✅ Audit Worker (consuming audit.events)
- ✅ Frontend on port 80

### Option 2: Development (Local Workers)

Run workers locally for debugging:

```bash
# 1. Start infrastructure only
docker-compose up postgres redis zookeeper kafka -d

# 2. Set Kafka enabled in .env
# Edit .env and set:
NO_KAFKA=false
APP_MODE=scalable

# 3. Start API
cd backend
uvicorn backend.app.main:app --reload --port 8000

# 4. Start workers in separate terminals

# Terminal 1: Risk Worker
python -m backend.app.workers.run_risk_worker

# Terminal 2: Analytics Worker
python -m backend.app.workers.run_analytics_worker

# Terminal 3: Audit Worker
python -m backend.app.workers.run_audit_worker
```

---

## 🧪 Test the Real-Time Flow

### 1. Send a Transaction

```bash
curl -X POST http://localhost:8000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{
    "merchant_id": "test_merchant",
    "amount": 5000,
    "currency": "INR",
    "payment_method": "card",
    "customer_id": "cust_123",
    "device_id": "device_456",
    "status": "success"
  }'
```

**Expected Response** (Kafka enabled):
```json
{
  "transaction_id": "tx_abc123",
  "merchant_id": "test_merchant",
  "timestamp": "2026-09-03T10:30:00",
  "status": "queued_for_processing",
  "message": "Transaction queued for async risk assessment"
}
```

### 2. Watch Risk Worker Process It

```bash
docker-compose logs -f risk-worker
```

You should see:
```
[2026-09-03 10:30:00] [INFO] Processing transaction tx_abc123 for merchant test_merchant
[2026-09-03 10:30:00] [INFO] Transaction tx_abc123: ML=0.123, Anomaly=0.234, Risk=0.178 (low)
```

### 3. Simulate a Fraud Spike (850 txn/min)

```bash
curl -X POST http://localhost:8000/api/v1/test/simulate-spike \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{
    "merchant_id": "spike_test_merchant",
    "normal_txn_count": 100,
    "spike_txn_count": 850,
    "spike_duration_minutes": 1,
    "suspicious_ratio": 0.15
  }'
```

### 4. Watch the Alert Generation

```bash
docker-compose logs -f risk-worker | grep "FRAUD SPIKE"
```

You should see:
```
[2026-09-03 10:31:00] [WARNING] ⚠️  FRAUD SPIKE DETECTED — Merchant spike_test_merchant Risk: HIGH
```

### 5. Check Redis Cache

```bash
# Connect to Redis
docker exec -it razorshield-redis-1 redis-cli

# Check velocity counters
KEYS velocity:*

# Check merchant baseline
HGETALL baseline:spike_test_merchant

# Check metrics
HGETALL metrics:alerts:24h
```

### 6. Check Database

```bash
# Connect to PostgreSQL
docker exec -it razorshield-postgres-1 psql -U razorshield

# Check transactions
SELECT COUNT(*) FROM transactions;

# Check risk assessments
SELECT COUNT(*) FROM risk_assessments;

# Check alerts
SELECT id, merchant_id, risk_level, summary FROM alerts ORDER BY created_at DESC LIMIT 5;
```

---

## 📊 Monitor Workers

### View Logs

```bash
# All workers
docker-compose logs -f risk-worker analytics-worker audit-worker

# Specific worker
docker-compose logs -f risk-worker

# Last 100 lines
docker-compose logs --tail=100 risk-worker
```

### Check Kafka Consumer Groups

```bash
# List all consumer groups
docker exec -it razorshield-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 --list

# Check risk worker lag
docker exec -it razorshield-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group risk-worker-group

# Check audit worker lag
docker exec -it razorshield-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group audit-worker-group
```

### Check Kafka Topics

```bash
# List topics
docker exec -it razorshield-kafka-1 kafka-topics \
  --bootstrap-server localhost:9092 --list

# Should see:
# - payment.events
# - fraud.alerts
# - audit.events

# Describe a topic
docker exec -it razorshield-kafka-1 kafka-topics \
  --bootstrap-server localhost:9092 \
  --describe --topic payment.events
```

### Monitor Events (Debug)

```bash
# Consume payment events
docker exec -it razorshield-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic payment.events \
  --from-beginning

# Consume fraud alerts
docker exec -it razorshield-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic fraud.alerts \
  --from-beginning
```

---

## 🔧 Configuration

### Enable/Disable Kafka

**In .env**:
```bash
# Disable Kafka (sync mode)
NO_KAFKA=true

# Enable Kafka (async mode)
NO_KAFKA=false
APP_MODE=scalable
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### Scale Workers

```bash
# Scale risk workers to 3 instances
docker-compose --profile scalable up -d --scale risk-worker=3

# Check replicas
docker-compose ps risk-worker
```

### Worker Resources

**Adjust in docker-compose.yml**:
```yaml
risk-worker:
  # ... existing config
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

---

## 🛠️ Troubleshooting

### Workers Not Starting

**Check dependencies**:
```bash
docker-compose logs postgres redis kafka zookeeper
```

**Restart workers**:
```bash
docker-compose --profile scalable restart risk-worker analytics-worker audit-worker
```

### Kafka Connection Failed

**Check Kafka is running**:
```bash
docker-compose ps kafka

# Should be "Up" and healthy
```

**Check Kafka logs**:
```bash
docker-compose logs kafka | tail -50
```

### Redis Connection Failed

```bash
docker exec -it razorshield-redis-1 redis-cli ping
# Should return: PONG
```

### Events Not Processing

**1. Check if events are being published**:
```bash
# Send a transaction
curl -X POST http://localhost:8000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{"merchant_id":"test","amount":1000,"currency":"INR","payment_method":"card","status":"success"}'

# Check API logs
docker-compose logs api | grep "queued_for_processing"
```

**2. Check Kafka consumer is running**:
```bash
docker-compose logs risk-worker | grep "Kafka consumer started"
```

**3. Manually consume to verify events exist**:
```bash
docker exec -it razorshield-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic payment.events \
  --from-beginning --max-messages 1
```

---

## 📈 Performance Testing

### Load Test with 850 txn/min

```bash
# Install hey (HTTP load testing tool)
# macOS: brew install hey
# Linux: go install github.com/rakyll/hey@latest

# Generate load
hey -n 850 -c 50 -m POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{"merchant_id":"load_test","amount":5000,"currency":"INR","payment_method":"card","status":"success"}' \
  http://localhost:8000/api/v1/transactions

# Watch risk worker handle the load
docker-compose logs -f risk-worker
```

### Monitor Redis During Load

```bash
docker exec -it razorshield-redis-1 redis-cli

# Monitor in real-time
MONITOR

# Or check stats
INFO stats
```

### Check Database Performance

```bash
docker exec -it razorshield-postgres-1 psql -U razorshield -c "
  SELECT 
    schemaname, 
    tablename, 
    n_tup_ins as inserts,
    n_tup_upd as updates
  FROM pg_stat_user_tables 
  ORDER BY n_tup_ins DESC;
"
```

---

## 🎯 Next Steps

1. **Add Investigation Worker**: Automatically trigger LangGraph agent on high-risk alerts
2. **Add Notification Worker**: Send Slack/Email alerts
3. **Configure Monitoring**: Add Prometheus + Grafana dashboards
4. **Add Alerting**: PagerDuty/Opsgenie for worker failures
5. **Add Dead Letter Queue**: Handle failed events gracefully
6. **Configure Auto-scaling**: Scale workers based on Kafka lag

---

## 📚 Additional Resources

- [Workers README](backend/app/workers/README.md) - Detailed worker documentation
- [Architecture Analysis](ARCHITECTURE_ANALYSIS.md) - Full architecture compliance report
- [FastAPI Docs](backend/app/api/routes.py) - API endpoints
- [Kafka Documentation](https://kafka.apache.org/documentation/)

---

## 🆘 Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs <service>`
2. Check health: `curl http://localhost:8000/health`
3. Restart: `docker-compose --profile scalable restart`
4. Full reset: `docker-compose down -v && docker-compose --profile scalable up -d`

---

**You now have a production-scale, event-driven fraud detection system! 🎉**
