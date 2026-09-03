# RazorShield AI — Background Workers

This directory contains the three background workers that enable the production-scale, event-driven architecture.

## Architecture

```
Payment Event → FastAPI → Kafka → Workers → Redis/PostgreSQL
                                   ↓
                         ┌─────────┼─────────┐
                         ↓         ↓         ↓
                    Risk Worker  Analytics  Audit
                                 Worker     Worker
```

## Workers

### 1. Risk Worker (`risk_worker.py`)

**Purpose**: Real-time fraud detection pipeline

**Flow**:
1. Consumes payment events from Kafka (`payment.events` topic)
2. Updates Redis with transaction metadata for velocity tracking
3. Fetches merchant baseline from Redis/PostgreSQL
4. Computes real-time features (velocity, device, amount)
5. Runs XGBoost ML inference
6. Runs statistical anomaly detection
7. Aggregates risk scores
8. Stores risk assessment in PostgreSQL
9. Generates alert if risk is HIGH/CRITICAL
10. Publishes alert to `fraud.alerts` topic

**Key Features**:
- Handles high-throughput payment streams (850+ txn/min)
- Real-time feature computation using Redis
- Graceful degradation on failures
- Horizontal scalability (multiple instances)

**Consumer Group**: `risk-worker-group`

**Topics**:
- Consumes: `payment.events`
- Produces: `fraud.alerts`

**Run**:
```bash
python -m backend.app.workers.run_risk_worker
```

---

### 2. Analytics Worker (`analytics_worker.py`)

**Purpose**: Metric aggregation and baseline updates

**Jobs** (periodic):
- **Update merchant baselines** (every 5 minutes)
  - Computes rolling averages for transaction rate, amount, failure rate
  - Updates PostgreSQL merchant table
  - Caches in Redis for fast lookups
  
- **Aggregate risk metrics** (every 1 minute)
  - Alert counts by risk level
  - Average risk scores
  - Transaction volume
  - Caches in Redis for dashboards

- **Compute model performance** (every 15 minutes)
  - Prediction distribution
  - Model drift indicators
  - Performance metrics

**Key Features**:
- Keeps merchant baselines up-to-date
- Powers real-time dashboards
- No Kafka dependency (scheduler-based)
- Low resource footprint

**Run**:
```bash
python -m backend.app.workers.run_analytics_worker
```

---

### 3. Audit Worker (`audit_worker.py`)

**Purpose**: Asynchronous audit log persistence

**Flow**:
1. Consumes audit events from Kafka (`audit.events` topic)
2. Validates event schema
3. Writes to `audit_logs` table in PostgreSQL
4. Commits Kafka offset only after successful DB write
5. Ensures no audit records are lost

**Key Features**:
- **Compliance-critical**: Never loses audit records
- Manual offset commit (at-least-once semantics)
- Handles investigation, alert, and policy audit events
- Dead letter queue support (for retries)

**Consumer Group**: `audit-worker-group`

**Topics**:
- Consumes: `audit.events`

**Run**:
```bash
python -m backend.app.workers.run_audit_worker
```

---

## Configuration

Workers are configured via environment variables (same as main API):

```bash
# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
NO_KAFKA=false  # Set to false to enable Kafka

# Redis
REDIS_URL=redis://localhost:6379/0

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://razorshield:razorshield@localhost:5432/razorshield

# App Mode
APP_MODE=scalable  # Required for workers
```

---

## Running Workers

### Development (Local)

**Prerequisites**:
1. Start PostgreSQL, Redis, and Kafka:
   ```bash
   docker-compose up postgres redis zookeeper kafka -d
   ```

2. Create Kafka topics (auto-created by default):
   ```bash
   # If needed manually:
   docker exec -it razorshield-kafka-1 kafka-topics --create \
     --bootstrap-server localhost:9092 \
     --topic payment.events --partitions 3 --replication-factor 1
   
   docker exec -it razorshield-kafka-1 kafka-topics --create \
     --bootstrap-server localhost:9092 \
     --topic fraud.alerts --partitions 1 --replication-factor 1
   
   docker exec -it razorshield-kafka-1 kafka-topics --create \
     --bootstrap-server localhost:9092 \
     --topic audit.events --partitions 1 --replication-factor 1
   ```

3. Start workers in separate terminals:
   ```bash
   # Terminal 1
   python -m backend.app.workers.run_risk_worker
   
   # Terminal 2
   python -m backend.app.workers.run_analytics_worker
   
   # Terminal 3
   python -m backend.app.workers.run_audit_worker
   ```

### Production (Docker)

Start the full scalable stack:

```bash
docker-compose --profile scalable up -d
```

This starts:
- PostgreSQL
- Redis
- Kafka + Zookeeper
- FastAPI (3 replicas by default)
- NGINX load balancer
- Risk Worker
- Analytics Worker
- Audit Worker
- Frontend

**Scale workers**:
```bash
docker-compose --profile scalable up -d --scale risk-worker=3
```

---

## Monitoring

### Worker Logs

```bash
# Docker
docker-compose --profile scalable logs -f risk-worker
docker-compose --profile scalable logs -f analytics-worker
docker-compose --profile scalable logs -f audit-worker

# Local
# Check terminal output
```

### Redis Metrics

```bash
redis-cli

# Check velocity counters
KEYS velocity:*

# Check baselines
KEYS baseline:*

# Check metrics
HGETALL metrics:alerts:24h
HGETALL metrics:risk:1h
HGETALL metrics:model:24h
```

### Kafka Consumer Groups

```bash
docker exec -it razorshield-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group risk-worker-group

docker exec -it razorshield-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group audit-worker-group
```

---

## Testing the Real-Time Flow

### 1. Start Everything

```bash
docker-compose --profile scalable up -d
```

### 2. Send Test Transaction

```bash
curl -X POST http://localhost:8000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{
    "merchant_id": "merchant_123",
    "amount": 10000,
    "currency": "INR",
    "payment_method": "card",
    "customer_id": "cust_456",
    "device_id": "device_789",
    "status": "success"
  }'
```

### 3. Check Worker Logs

```bash
# Should see in risk worker:
# "Processing transaction tx_xxx for merchant merchant_123"
# "Transaction tx_xxx: ML=0.xxx, Anomaly=0.xxx, Risk=0.xxx (medium)"

docker-compose logs -f risk-worker
```

### 4. Simulate Fraud Spike

```bash
curl -X POST http://localhost:8000/api/v1/test/simulate-spike \
  -H "Content-Type: application/json" \
  -H "X-API-Key: razorshield-dev-key" \
  -d '{
    "merchant_id": "merchant_spike_test",
    "normal_txn_count": 100,
    "spike_txn_count": 850,
    "spike_duration_minutes": 1,
    "suspicious_ratio": 0.15
  }'
```

### 5. Watch Alert Generation

```bash
# Risk worker should generate alert
# Alert should be published to fraud.alerts topic
# Investigation can be triggered manually or by another consumer

docker-compose logs -f risk-worker | grep "FRAUD SPIKE DETECTED"
```

---

## Troubleshooting

### Worker Not Starting

1. **Check Kafka connection**:
   ```bash
   docker-compose logs kafka
   ```

2. **Check Redis connection**:
   ```bash
   redis-cli ping
   ```

3. **Check PostgreSQL**:
   ```bash
   psql -h localhost -U razorshield -d razorshield -c "SELECT 1"
   ```

### Events Not Processing

1. **Check Kafka topics exist**:
   ```bash
   docker exec -it razorshield-kafka-1 kafka-topics --list --bootstrap-server localhost:9092
   ```

2. **Check consumer lag**:
   ```bash
   docker exec -it razorshield-kafka-1 kafka-consumer-groups \
     --bootstrap-server localhost:9092 --describe --all-groups
   ```

3. **Manually consume events** (debug):
   ```bash
   docker exec -it razorshield-kafka-1 kafka-console-consumer \
     --bootstrap-server localhost:9092 \
     --topic payment.events --from-beginning
   ```

### High Memory Usage

- Risk worker caches ML model (can use ~500MB)
- Reduce `max_poll_records` in consumer config
- Scale horizontally instead of vertically

---

## Performance Tuning

### Risk Worker

- **Throughput**: ~1000 events/sec per instance (depends on ML model)
- **Latency**: 10-50ms per event
- **Scaling**: Add more instances (Kafka partitioning)
- **Redis**: Use connection pooling
- **PostgreSQL**: Batch inserts if needed

### Analytics Worker

- **CPU**: Low (mostly I/O bound)
- **Memory**: ~100MB
- **Frequency**: Adjust intervals based on load

### Audit Worker

- **Throughput**: ~2000 events/sec per instance
- **Latency**: <5ms per event
- **Scaling**: Usually single instance is sufficient

---

## Production Checklist

- [ ] Kafka has multiple brokers (HA)
- [ ] Workers have health checks
- [ ] Dead letter queue configured for failed events
- [ ] Redis persistence enabled
- [ ] PostgreSQL connection pooling configured
- [ ] Worker logs shipped to centralized logging
- [ ] Metrics exported to Prometheus/Grafana
- [ ] Auto-scaling configured based on consumer lag
- [ ] Alerting on worker failures
- [ ] Backup strategy for Kafka topics

---

## Next Steps

1. **Add investigation worker**: Consumes `fraud.alerts` and triggers LangGraph agent
2. **Add notification worker**: Sends alerts to Slack/Email
3. **Add model retraining pipeline**: Periodic model updates
4. **Add data warehouse sync**: Export to Snowflake/BigQuery
