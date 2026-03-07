# Auto Bill Aggregation System - Library Structure

This directory contains the core infrastructure for the Automatic Bill Payment Aggregation System.

## Directory Structure

```
lib/
├── models/              # Mongoose data models
│   ├── AutoPaymentConfig.ts    # Auto-payment configuration
│   ├── AutoPaymentRecord.ts    # Payment execution records
│   ├── ConsolidatedBill.ts     # Aggregated bills
│   ├── PaymentCycle.ts         # Payment cycle management
│   └── index.ts                # Model exports
├── services/            # Business logic services (to be implemented)
├── jobs/               # Bull queue job processors (to be implemented)
├── utils/              # Utility functions
├── mongoose.ts         # MongoDB connection with Mongoose
├── mongodb.ts          # MongoDB native client (existing)
├── redis.ts            # Redis client configuration
├── queue.ts            # Bull queue setup
├── logger.ts           # Pino logger configuration
└── auth.ts             # Authentication utilities (existing)
```

## Core Components

### Database Connection
- **mongoose.ts**: Mongoose connection with connection pooling (maxPoolSize: 10, minPoolSize: 5)
- **mongodb.ts**: Native MongoDB client (existing, for backward compatibility)

### Data Models
All models use Mongoose schemas with proper indexing for query performance:
- **AutoPaymentConfig**: Stores user auto-payment preferences
- **AutoPaymentRecord**: Records each automatic payment execution
- **ConsolidatedBill**: Aggregated bills for payment cycles
- **PaymentCycle**: Manages monthly aggregation periods

### Queue System
- **queue.ts**: Bull queues for background job processing
  - `autoPaymentQueue`: Processes automatic payments
  - `consolidatedBillQueue`: Generates consolidated bills
  - `paymentCycleQueue`: Manages payment cycle transitions

### Infrastructure
- **redis.ts**: Redis client for caching and queue backend
- **logger.ts**: Pino logger with pretty printing in development

## Environment Variables

Required environment variables in `.env.local`:

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017/BillSync

# Redis
REDIS_URL=redis://localhost:6379

# BillAPI
BILL_API=http://localhost:3000
API_KEY=your_api_key

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Logging
LOG_LEVEL=info
```

## Next Steps

1. Implement service layer in `lib/services/`
2. Create job processors in `lib/jobs/`
3. Build API routes in `app/api/`
4. Add unit and integration tests
