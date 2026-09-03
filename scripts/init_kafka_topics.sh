#!/bin/bash
# RazorShield AI — Initialize Kafka Topics
# Creates required Kafka topics for the event-driven architecture

set -e

KAFKA_CONTAINER="${KAFKA_CONTAINER:-razorshield-kafka-1}"
BOOTSTRAP_SERVER="${BOOTSTRAP_SERVER:-localhost:9092}"

echo "=========================================="
echo "RazorShield AI — Kafka Topic Initialization"
echo "=========================================="
echo ""

# Check if Kafka container is running
if ! docker ps | grep -q "$KAFKA_CONTAINER"; then
    echo "❌ Kafka container not found: $KAFKA_CONTAINER"
    echo "   Start Kafka with: docker-compose up kafka -d"
    exit 1
fi

echo "✓ Kafka container found: $KAFKA_CONTAINER"
echo ""

# Function to create a topic
create_topic() {
    local topic_name=$1
    local partitions=$2
    local replication=$3

    echo "Creating topic: $topic_name (partitions=$partitions, replication=$replication)"
    
    docker exec "$KAFKA_CONTAINER" kafka-topics \
        --create \
        --if-not-exists \
        --bootstrap-server "$BOOTSTRAP_SERVER" \
        --topic "$topic_name" \
        --partitions "$partitions" \
        --replication-factor "$replication" \
        --config retention.ms=604800000 \
        2>/dev/null || echo "  → Topic already exists"
}

# Create topics
echo "Creating topics..."
echo ""

# payment.events - High throughput, partitioned by merchant_id
create_topic "payment.events" 3 1

# fraud.alerts - Lower throughput, sequential processing
create_topic "fraud.alerts" 1 1

# audit.events - Critical, must not lose data
create_topic "audit.events" 1 1

echo ""
echo "=========================================="
echo "Topics created successfully!"
echo "=========================================="
echo ""

# List all topics
echo "Available topics:"
docker exec "$KAFKA_CONTAINER" kafka-topics \
    --bootstrap-server "$BOOTSTRAP_SERVER" \
    --list

echo ""

# Describe topics
echo "Topic details:"
docker exec "$KAFKA_CONTAINER" kafka-topics \
    --bootstrap-server "$BOOTSTRAP_SERVER" \
    --describe

echo ""
echo "✓ Kafka topics ready for RazorShield AI workers"
