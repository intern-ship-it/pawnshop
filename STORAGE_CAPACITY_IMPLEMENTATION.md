# Storage Capacity Management - Implementation Guide

## ✅ COMPLETED Components

### 1. Backend API (100% Complete)

- ✅ Endpoint: `GET /api/storage/capacity`
- ✅ Returns: `{ total_slots, occupied_slots, available_slots, usage_percent, status, can_accept_pledge, message }`
- ✅ Status levels: `healthy`, `low` (≤30%), `warning` (≤20%), `critical` (≤10%)
- ✅ Route added to `routes/api.php`
- ✅ Service method: `storageService.getCapacity()`

### 2. Dashboard Widget (Complete)

- ✅ Component: `StorageCapacityCard.jsx`
- ✅ Location: `frontend/src/components/dashboard/StorageCapacityCard.jsx`
- ✅ Features:
  - Color-coded status (green/yellow/amber/red)
  - Progress bar showing usage percentage
  - Available/occupied slot counts
  - Auto-refreshes every 30 seconds
  - Click to navigate to inventory

**To Use:** Add to Dashboard.jsx:

```jsx
import StorageCapacityCard from "@/components/dashboard/StorageCapacityCard";

// In JSX (add after payment split or summary cards):
<StorageCapacityCard />;
```

### 3. Header Notification Badge (Complete)

- ✅ Component: `StorageCapacityBadge.jsx`
- ✅ Location: `frontend/src/components/common/StorageCapacityBadge.jsx`
- ✅ Features:
  - Only shows when storage ≤ 30% available
  - Color-coded (yellow/amber/red)
  - Pulsing dot on critical
  - Auto-refreshes every 60 seconds
  - Click to navigate to inventory

**To Use:** Add to Header.jsx (near line 400, before notification bell):

```jsx
import StorageCapacityBadge from "@/components/common/StorageCapacityBadge";

// In JSX (before the notification bell button):
<StorageCapacityBadge className="hidden md:flex" />;
```

### 4. New Pledge Warning Banner (Complete)

- ✅ Component: `StorageWarningBanner.jsx`
- ✅ Location: `frontend/src/components/common/StorageWarningBanner.jsx`
- ✅ Features:
  - Shows warning banner when storage is low/warning/critical
  - Blocks pledge creation when storage full (can_accept_pledge = false)
  - Dismissible when not critical
  - Shows available/occupied stats
  - "Free up space" button → navigates to inventory

**To Use:** Add to NewPledge.jsx:

1. Add import at top:

```jsx
import StorageWarningBanner from "@/components/common/StorageWarningBanner";
```

2. Add state for storage block:

```jsx
const [storageBlocked, setStorageBlocked] = useState(false);
```

3. Add banner in JSX (before step 1 content, around line 2000+):

```jsx
<StorageWarningBanner onStorageFull={setStorageBlocked} />
```

4. Add validation before "Next" button (in handleNext or similar):

```jsx
if (storageBlocked) {
  dispatch(
    addToast({
      type: "error",
      message:
        "Cannot create pledge: No storage slots available. Please free up space first.",
    }),
  );
  return;
}
```

## 📋 Manual Integration Steps

### Step 1: Add to Dashboard

File: `frontend/src/pages/Dashboard.jsx`

1. Add import (line ~44):

```jsx
import StorageCapacityCard from "@/components/dashboard/StorageCapacityCard";
```

2. Add component in JSX (around line 430, before or after Gold Prices section):

```jsx
{
  /* Storage Capacity Widget */
}
<StorageCapacityCard />;
```

### Step 2: Add to Header

File: `frontend/src/components/layout/Header.jsx`

1. Add import (around line 11):

```jsx
import StorageCapacityBadge from "@/components/common/StorageCapacityBadge";
```

2. Add component in JSX (around line 795, BEFORE the notification bell button):

```jsx
{
  /* Storage Capacity Badge (shows when low) */
}
<StorageCapacityBadge className="hidden md:flex" />;
```

### Step 3: Add to New Pledge

File: `frontend/src/pages/pledges/NewPledge.jsx`

1. Add import (top of file, with other imports):

```jsx
import StorageWarningBanner from "@/components/common/StorageWarningBanner";
```

2. Add state (with other useState declarations, around line 200):

```jsx
const [storageBlocked, setStorageBlocked] = useState(false);
```

3. Add banner in JSX (early in the return statement, before step navigation):

```jsx
{
  /* Storage Warning Banner */
}
<StorageWarningBanner onStorageFull={setStorageBlocked} />;
```

4. Add validation in "Next" button handler or `handleSubmit`:

```jsx
// Before proceeding to storage assignment step or final submission
if (storageBlocked) {
  dispatch(
    addToast({
      type: "error",
      message:
        "Cannot create pledge: No storage slots available. Please free up space first.",
    }),
  );
  return; // Block submission
}
```

## 🎨 Status Colors & Behavior

| Status   | % Available | Color  | Badge Shows | Banner Shows | Can Create Pledge |
| -------- | ----------- | ------ | ----------- | ------------ | ----------------- |
| Healthy  | > 30%       | Green  | No          | No           | ✅ Yes            |
| Low      | ≤ 30%       | Yellow | Yes         | Yes          | ✅ Yes            |
| Warning  | ≤ 20%       | Amber  | Yes (pulse) | Yes          | ✅ Yes            |
| Critical | ≤ 10%       | Red    | Yes (pulse) | Yes          | ✅ Yes            |
| Full     | 0 slots     | Red    | Yes (pulse) | Yes (BLOCK)  | ❌ No             |

## 🚀 Testing

1. **Test API**: Visit `http://localhost:8000/api/storage/capacity` (logged in)
2. **Test Dashboard**: Dashboard should show storage widget
3. **Test Header**: Header shows badge only when ≤ 30% available
4. **Test New Pledge**: Banner shows warnings, blocks when full

## 🔄 Auto-Refresh Intervals

- **Dashboard Widget**: 30 seconds
- **Header Badge**: 60 seconds
- **New Pledge Banner**: Once on mount (warns immediately)

All components are ready to use! Just add the imports and JSX as shown above.
