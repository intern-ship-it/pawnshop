# Multi-Bank Transfer Split (New Pledge Payout)

**Date:** 2026-06-18
**File scope:** `frontend/src/pages/pledges/NewPledge.jsx`, `backend/app/Http/Controllers/Api/PledgeController.php`

## Problem

In the New Pledge wizard (Step 4 — Payout), the **Full Transfer** and **Partial** methods allow only one Bank Name + Account Number. Customers sometimes receive the payout across two or three banks (e.g. RM100,000 to Bank A, RM52,650 to Bank B). The single-bank form cannot record this.

## Goal

Let the operator split the transfer amount across **up to 3** banks, each with its own bank, account number, and amount. The split amounts must sum to the total Transfer Amount. Persist every split.

## Scope decisions (confirmed with client)

- Per-row fields: **Bank + Account Number + Amount**.
- Applies to **Full Transfer and Partial**.
- **Maximum 3 split rows.** Minimum 1.
- Backend saves **one `PledgePayment` row per split** (the `pledge->payments()` hasMany relation already supports this — no migration).
- **Receipts are NOT touched.** The dot-matrix receipt reads `payments->first()` and will print only the first bank. This is an accepted limitation for now.

## Frontend changes (`NewPledge.jsx`)

### State
- Remove single `bankId` / `accountNumber` state.
- Add `transferSplits`: array of `{ bankId: "", accountNumber: "", amount: "" }`, initialized to one empty row.
- Keep `transferAmount` (total) and `referenceNo` (one reference for the whole transfer) unchanged.

### UI (Step 4, currently lines ~3170–3177)
- Render `transferSplits.map(...)` — each row: Bank `Select` (required) + Account `Input` (required) + Amount `Input`.
- **Single row, Full Transfer:** the row's amount auto-mirrors the transfer total and is read-only (preserves today's behaviour). Adding a 2nd row makes all amounts editable.
- **"+ Add Bank"** button appends a row; hidden once 3 rows exist.
- Trash icon removes a row; hidden/disabled when only one row remains.
- Live sum indicator: `Σ splits = RMx / RMtotal`, green when equal (±0.01), red otherwise.

### Validation (`validateStep`, case 4)
- At least one split row.
- Every row must have a bank **and** an account number.
- Sum of split amounts must equal `transferAmount` (±0.01).
- Existing Partial check (cash + transfer = loan amount) stays.

### Submit payload (currently lines ~2190–2206)
- Add `payment.transfer_splits` = `[{ bank_id, account_number, amount }, ...]`.
- Keep top-level `payment.bank_id` / `payment.account_number` = the **first** split (backward compatibility with receipt code reading `payments->first()`).
- `cash_amount`, `transfer_amount`, `reference_no` unchanged.

## Backend changes (`PledgeController.php`)

### Validation (~line 390)
- Add optional rules:
  - `payment.transfer_splits` — `nullable|array|max:3`
  - `payment.transfer_splits.*.bank_id` — `required_with:payment.transfer_splits|exists:banks,id`
  - `payment.transfer_splits.*.account_number` — `nullable|string|max:30`
  - `payment.transfer_splits.*.amount` — `required_with:payment.transfer_splits|numeric|min:0`
- Keep existing single `payment.bank_id` rule as fallback.

### Persistence (~line 704)
- If `transfer_splits` present and non-empty: create one `PledgePayment` per split.
  - **First row:** carries `cash_amount`, `total_amount` (= loan amount), and its own `transfer_amount` + bank/account.
  - **Subsequent rows:** `cash_amount = 0`, `total_amount = 0`, carry only their `transfer_amount` + bank/account.
  - This keeps `payments->sum('cash_amount')` / `sum('transfer_amount')` / any `sum('total_amount')` correct (no double counting), which is how Dashboard / Report / DayEnd / OwnerDashboard aggregate.
- If absent: unchanged single-row behaviour.
- All inside the existing DB transaction.

## Downstream impact (verified)
- **Reports / Dashboard / DayEnd / OwnerDashboard:** use `payments->sum(...)` — correct with multiple rows given the no-double-count rule above.
- **Receipts (DotMatrixPrintController):** use `payments->first()` — show first bank only. Intentionally unchanged.

## Out of scope
- Editing splits after pledge creation.
- Listing all banks on the printed receipt.
- Renewals / redemptions payout (separate flows).
