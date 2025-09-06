# NexusFlow - Visual Workflow Builder

A React-based visual workflow builder with drag-and-drop functionality, powered by BullMQ, Redis Streams, and PostgreSQL.

## Features

- 🎨 **Visual Workflow Builder**: Drag-and-drop interface for creating workflows
- 🔄 **Real-time Execution**: Redis-powered job orchestration with BullMQ
- 📊 **Stream Processing**: Redis Streams for high-throughput data exchange  
- 🗃️ **Persistent Storage**: PostgreSQL for workflow definitions and run history
- 🐳 **Docker Ready**: Full Docker Compose development environment

## Architecture

- **Frontend**: Next.js 14 with React Server Components and ReactFlow
- **Backend**: Node.js with TypeScript, BullMQ workers
- **Queue System**: BullMQ with Redis for job orchestration
- **Data Streams**: Redis Streams for inter-job data exchange
- **Database**: PostgreSQL for persistence and state management

## Quick Start with Docker

1. **Start all services**:
   ```bash
   docker-compose up --build
   ```

2. **Access the application**:
   - Frontend: http://localhost:3000
   - Services automatically start: PostgreSQL, Redis, Workers, Next.js

3. **Create workflows**:
   - Drag nodes from sidebar to canvas
   - Connect nodes with edges
   - Save and run workflows

## Local Development

1. **Start infrastructure**:
   ```bash
   cd ec-2/nexusflow
   npm run docker:up
   npm run docker:wait
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run migrations**:
   ```bash
   npm run migrate
   ```

4. **Start development server**:
   ```bash
   npm run dev:full  # Starts both workers and Next.js
   ```

## Available Node Types

- **🔗 Webhook Trigger**: HTTP webhook endpoints
- **⏰ Polling Trigger**: Scheduled polling triggers  
- **⚡ Action Node**: Data processing actions
- **🔀 Merge Node**: Combine multiple data streams
- **📝 Log Node**: Log messages and debug output

## API Endpoints

- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create new workflow
- `POST /api/workflows/run` - Execute workflow

## Scripts

- `npm run dev` - Start Next.js development server
- `npm run workers` - Start background workers  
- `npm run dev:full` - Start both workers and Next.js
- `npm run migrate` - Run database migrations
- `npm run test` - Run test suite
- `npm run e2e` - Full end-to-end test with Docker

## Docker Services

- **nexusflow**: Next.js app with workers (port 3000)
- **postgres**: PostgreSQL database (port 5432)  
- **redis**: Redis for queues and streams (port 6379)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `NODE_ENV`: Environment (development/production)

## Testing

```bash
# Run all tests
npm run test:ci

# Run with Docker services
npm run e2e
```

The test suite includes:
- Unit tests for core functionality
- Integration tests with Redis and PostgreSQL
- Stream processing and merge operation tests
- Workflow lifecycle tests