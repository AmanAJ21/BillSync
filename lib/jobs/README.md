# Background Jobs

This directory contains the background job processors for the Automatic Bill Payment Aggregation System.

## Overview

The system uses Bull (backed by Redis) to manage three scheduled background jobs:

1. **Automatic Payment Processor** - Processes scheduled payments for bills due within 24 hours
2. **Consolidated Bill Generator** - Generates consolidated bills at the end of each payment cycle
3. **Payment Cycle Manager** - Manages payment cycle transitions

## Jobs

### 1. Automatic Payment Processor

**File:** `autoPaymentProcessor.ts`

**Schedule:** Every 6 hours (cron: `0 */6 * * *`)

**Purpose:** Executes automatic payments for bills that are due within the next 24 hours.

**Process:**
- Queries all bills with auto-payment enabled
- Filters bills due within 24 hours
- Checks for duplicate payments in current cycle
- Detects significant amount changes (>50% increase)
- Executes payments through BillAPI
- Handles retries (up to 3 attempts with 2-hour intervals)
- Sends notifications to users

**Validates:** Requirements 2.1, 2.2

### 2. Consolidated Bill Generator

**File:** `consolidatedBillGenerator.ts`

**Schedule:** Last day of each month at 11:59 PM (cron: `59 23 28-31 * *`)

**Purpose:** Generates consolidated bills for all users at the end of each payment cycle.

**Process:**
- Finds all active payment cycles ending today
- Generates consolidated bill for each cycle
- Aggregates all auto-payment records
- Calculates total amount
- Creates itemized bill
- Sends notifications to users

**Validates:** Requirements 4.1, 5.1, 7.3

### 3. Payment Cycle Manager

**File:** `paymentCycleManager.ts`

**Schedule:** First day of each month at 12:00 AM (cron: `0 0 1 * *`)

**Purpose:** Manages payment cycle transitions by closing previous cycles and initializing new ones.

**Process:**
- Finds all active payment cycles that have ended
- Closes each cycle (status: active → completed)
- Initializes new payment cycle for next month
- Ensures only one active cycle per user

**Validates:** Requirements 7.3, 7.4

## Usage

### Registering Jobs

To register all background jobs when your application starts, call the `registerAllJobs()` function:

```typescript
import { registerAllJobs } from './lib/jobs';

// In your application startup code (e.g., server.ts or app.ts)
registerAllJobs();
```

This will:
1. Set up job processors for each queue
2. Schedule recurring jobs with their cron expressions
3. Log registration status

### Manual Job Execution

You can also manually trigger jobs for testing or administrative purposes:

```typescript
import { autoPaymentQueue, consolidatedBillQueue, paymentCycleQueue } from './lib/queue';

// Manually trigger automatic payment processing
await autoPaymentQueue.add('process-payments', { timestamp: new Date() });

// Manually trigger consolidated bill generation
await consolidatedBillQueue.add('generate-bills', { timestamp: new Date() });

// Manually trigger payment cycle management
await paymentCycleQueue.add('manage-cycles', { timestamp: new Date() });
```

## Configuration

### Environment Variables

Ensure the following environment variables are set in your `.env.local` file:

```env
REDIS_URL=redis://localhost:6379
BILL_API=http://localhost:3000
API_KEY=your-api-key
```

### Redis Connection

The jobs use the Redis connection configured in `lib/redis.ts`. Make sure Redis is running before starting the application.

### Queue Configuration

Queue settings are defined in `lib/queue.ts`:

- **Retry attempts:** 3 for auto-payment, 2 for others
- **Backoff strategy:** Exponential for auto-payment, fixed for others
- **Job retention:** 100 completed jobs, 500 failed jobs

## Monitoring

### Logs

All jobs log their execution status using the Pino logger:

- Job start/completion
- Success/failure counts
- Individual processing results
- Errors and warnings

### Queue Events

The queues emit events that are logged:

- `completed` - Job completed successfully
- `failed` - Job failed after all retries

## Testing

Integration tests are located in `__tests__/` directory:

- `autoPaymentProcessor.test.ts` - Tests for automatic payment processing
- `consolidatedBillGenerator.test.ts` - Tests for consolidated bill generation
- `paymentCycleManager.test.ts` - Tests for payment cycle management

Run tests with:

```bash
npm test -- lib/jobs/__tests__
```

## Error Handling

### Job Failures

- Jobs automatically retry based on queue configuration
- Failed jobs are logged with error details
- Critical failures are logged for manual investigation

### Service Errors

- BillAPI unavailability triggers retries
- Payment failures trigger retry logic (up to 3 attempts)
- Database errors are logged and jobs fail gracefully

## Cron Expressions

| Job | Cron Expression | Description |
|-----|----------------|-------------|
| Auto Payment Processor | `0 */6 * * *` | Every 6 hours at minute 0 |
| Consolidated Bill Generator | `59 23 28-31 * *` | Days 28-31 at 11:59 PM |
| Payment Cycle Manager | `0 0 1 * *` | First day of month at midnight |

## Dependencies

- **Bull** - Job queue management
- **Redis** - Queue storage and job persistence
- **Mongoose** - Database operations
- **Pino** - Logging

## Architecture

```
lib/jobs/
├── index.ts                          # Main entry point, exports registerAllJobs()
├── autoPaymentProcessor.ts           # Automatic payment processing job
├── consolidatedBillGenerator.ts      # Consolidated bill generation job
├── paymentCycleManager.ts            # Payment cycle management job
├── README.md                         # This file
└── __tests__/                        # Integration tests
    ├── autoPaymentProcessor.test.ts
    ├── consolidatedBillGenerator.test.ts
    └── paymentCycleManager.test.ts
```

## Future Enhancements

- Add job monitoring dashboard
- Implement job priority levels
- Add job cancellation support
- Implement job result persistence
- Add metrics and analytics
