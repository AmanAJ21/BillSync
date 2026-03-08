# Background Jobs

This directory contains the core job logic for the Automatic Bill Payment Aggregation System.

## Overview

The system includes three main task processors that handle automated billing operations:

1. **Automatic Payment Processor** - Processes scheduled payments for bills due within 24 hours
2. **Consolidated Bill Generator** - Generates consolidated bills at the end of each payment cycle
3. **Payment Cycle Manager** - Manages payment cycle transitions

## Jobs

### 1. Automatic Payment Processor

**File:** `autoPaymentProcessor.ts`

**Purpose:** Executes automatic payments for bills that are due within the next 24 hours.

**Process:**
- Queries all bills with auto-payment enabled
- Filters bills due within 24 hours
- Checks for duplicate payments in current cycle
- Detects significant amount changes (>50% increase)
- Executes payments through BillAPI
- Sends notifications to users

**Validates:** Requirements 2.1, 2.2

### 2. Consolidated Bill Generator

**File:** `consolidatedBillGenerator.ts`

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

**Purpose:** Manages payment cycle transitions by closing previous cycles and initializing new ones.

**Process:**
- Finds all active payment cycles that have ended
- Closes each cycle (status: active → completed)
- Initializes new payment cycle for next month
- Ensures only one active cycle per user

**Validates:** Requirements 7.3, 7.4

## Usage

### Execution

These jobs are standalone functions that can be called from API routes, serverless functions, or scheduled tasks:

```typescript
import { processAutoPayments, generateConsolidatedBills, managePaymentCycles } from './lib/jobs';

// Execute automatic payment processing
await processAutoPayments();

// Execute consolidated bill generation
await generateConsolidatedBills();

// Execute payment cycle management
await managePaymentCycles();
```

## Monitoring

### Logs

All jobs log their execution status using the Pino logger:

- Job start/completion
- Success/failure counts
- Individual processing results
- Errors and warnings

## Testing

Integration tests are located in the `__tests__/` directory:

```bash
npm test -- lib/jobs/__tests__
```

## Error Handling

- Failed operations are logged with error details.
- Database errors are logged and processes fail gracefully.
- Service unavailability is handled via internal error reporting.

## Dependencies

- **Mongoose** - Database operations
- **Pino** - Logging

## Architecture

```
lib/jobs/
├── index.ts                          # Main entry point for job functions
├── autoPaymentProcessor.ts           # Automatic payment processing
├── consolidatedBillGenerator.ts      # Consolidated bill generation
├── paymentCycleManager.ts            # Payment cycle management
├── README.md                         # This file
└── __tests__/                        # Integration tests
```
