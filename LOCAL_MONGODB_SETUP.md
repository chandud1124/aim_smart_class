# Local MongoDB Setup for IoT Classroom System

## Prerequisites
- MongoDB installed locally (version 4.4+ recommended)
- MongoDB running on default port 27017

## Quick Setup (Windows)

### 1. Install MongoDB Community Edition
Download from: https://www.mongodb.com/try/download/community

### 2. Start MongoDB Service
```bash
# Using MongoDB as a service (recommended)
net start MongoDB

# Or start manually
mongod --dbpath "C:\data\db"
```

### 3. Verify Connection
```bash
mongo
# Should connect to: mongodb://localhost:27017
```

### 4. Create Database
```javascript
// In mongo shell
use iot_classroom
db.createCollection("test")
```

## Configuration Summary

Your system is now configured to use:
- **Backend**: `mongodb://localhost:27017/iot_classroom`
- **MongoDB Exporter**: `mongodb://host.docker.internal:27017/iot_classroom`
- **No authentication** required (local development)

## Docker Services Still Used
- ✅ AI/ML Service (Python/FastAPI)
- ✅ Frontend (React/TypeScript)
- ✅ Backend (Node.js/Express)
- ✅ Monitoring (Prometheus/Grafana)
- ✅ MongoDB Exporter (for monitoring)

## Testing the Setup

```bash
# Start all services (except MongoDB)
docker-compose up -d

# Check MongoDB connection
docker exec iot-backend node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://host.docker.internal:27017/iot_classroom').then(() => console.log('✅ Connected')).catch(err => console.log('❌ Error:', err))"

# Check monitoring
curl http://localhost:9216/metrics | head -10
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
netstat -ano | findstr :27017

# Check MongoDB logs
# Windows: Check Windows Event Viewer
# Or check mongod.log file

# Test connection manually
mongo --eval "db.stats()"
```

### Docker Container Issues
```bash
# Check container logs
docker logs iot-backend
docker logs iot-mongodb-exporter

# Test network connectivity
docker exec iot-backend ping host.docker.internal
```

## Production Notes
For production deployment, consider:
- Enabling MongoDB authentication
- Using MongoDB replica sets
- Configuring proper backup strategies
- Setting up MongoDB on dedicated servers