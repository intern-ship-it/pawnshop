# PawnSys API Services

This folder contains all API service modules for connecting the React frontend to the Laravel backend.

## Setup

1. Copy `.env.example` to `.env` in the root folder:
   ```bash
   cp .env.example .env
   ```

2. Update `VITE_API_URL` to point to your Laravel backend:
   ```
   VITE_API_URL=http://localhost:8000/api
   ```

3. Make sure Laravel backend is running with CORS configured for your frontend domain.

## Services Overview

| Service | Description |
|---------|-------------|
| `api.js` | Axios instance with interceptors, token management |
| `authService.js` | Login, logout, token refresh, passkey verification |
| `customerService.js` | Customer CRUD, search by IC |
| `pledgeService.js` | Pledge creation, calculation, storage assignment |
| `renewalService.js` | Renewal calculation and processing |
| `redemptionService.js` | Redemption calculation and processing |
| `dashboardService.js` | Dashboard stats, gold prices, alerts |
| `inventoryService.js` | Inventory items, location tracking |
| `storageService.js` | Vaults, boxes, slots management |
| `settingsService.js` | System settings, categories, purities, banks |
| `reportService.js` | All reports with export functionality |
| `dayEndService.js` | Day-end reconciliation workflow |

## Usage Example

```javascript
import { authService, customerService } from '@/services'

// Login
const handleLogin = async (email, password) => {
  try {
    const response = await authService.login(email, password)
    console.log('Logged in:', response.data.user)
  } catch (error) {
    console.error('Login failed:', error.message)
  }
}

// Search customer by IC
const searchCustomer = async (icNumber) => {
  try {
    const response = await customerService.searchByIC(icNumber)
    return response.data
  } catch (error) {
    console.error('Customer not found:', error.message)
  }
}
```

## With Redux Thunks

```javascript
import { createAsyncThunk } from '@reduxjs/toolkit'
import { customerService } from '@/services'

export const fetchCustomers = createAsyncThunk(
  'customers/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const response = await customerService.getAll(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)
```

## Authentication Flow

1. User logs in via `authService.login(email, password)`
2. Token is stored in localStorage as `pawnsys_token`
3. All subsequent requests include `Authorization: Bearer <token>` header
4. On 401 response, interceptor attempts token refresh
5. If refresh fails, user is redirected to login

## Error Handling

All services return standardized error objects:

```javascript
{
  message: 'Error description',
  status: 422,
  errors: {
    field_name: ['Validation error message']
  }
}
```
