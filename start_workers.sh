#!/bin/bash
# RazorShield AI — Quick Start Script for Workers

set -e

echo "=========================================="
echo "RazorShield AI — Production Stack Startup"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set:"
    echo "   - NO_KAFKA=false"
    echo "   - OPENAI_API_KEY=your_key (for LangGraph agent)"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

echo "Starting production stack..."
echo ""

# Start with scalable profile
echo "🚀 Starting services..."
docker-compose --profile scalable up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "=========================================="
echo "✅ RazorShield AI is ready!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  • API: http://localhost:8000"
echo "  • Frontend: http://localhost:80"
echo "  • PostgreSQL: localhost:5432"
echo "  • Redis: localhost:6379"
echo "  • Kafka: localhost:9092"
echo ""
echo "Workers running:"
echo "  • Risk Worker (fraud detection)"
echo "  • Analytics Worker (metrics)"
echo "  • Audit Worker (compliance)"
echo ""
echo "📝 Quick Commands:"
echo ""
echo "  # View worker logs"
echo "  docker-compose logs -f risk-worker"
echo ""
echo "  # Test transaction"
echo "  curl -X POST http://localhost:8000/api/v1/transactions \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-API-Key: razorshield-dev-key' \\"
echo "    -d '{\"merchant_id\":\"test\",\"amount\":5000,\"currency\":\"INR\",\"payment_method\":\"card\",\"status\":\"success\"}'"
echo ""
echo "  # Simulate fraud spike"
echo "  curl -X POST http://localhost:8000/api/v1/test/simulate-spike \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-API-Key: razorshield-dev-key' \\"
echo "    -d '{\"merchant_id\":\"spike_test\",\"normal_txn_count\":100,\"spike_txn_count\":850,\"spike_duration_minutes\":1,\"suspicious_ratio\":0.15}'"
echo ""
echo "  # Stop everything"
echo "  docker-compose --profile scalable down"
echo ""
echo "📚 Documentation:"
echo "  • WORKERS_QUICKSTART.md - Quick start guide"
echo "  • IMPLEMENTATION_SUMMARY.md - What was built"
echo "  • backend/app/workers/README.md - Detailed docs"
echo ""
