# Postcode Auto-Fill Implementation

## ✅ Feature Added: Postcode Auto-Fill from IC State

### How It Works:

When a user enters their IC number, the system:

1. Extracts the state code (digits 7-8)
2. Maps to the state name
3. **Auto-fills a representative postcode** for that state

| **Sarawak** | 13, 50-53 | **93000** | Kuching |
| **Kuala Lumpur** | 14, 54-57 | **50000** | KL City Centre |
| **Labuan** | 15, 58 | **87000** | Labuan |
| **Putrajaya** | 16 | **62000** | Putrajaya |

### Example Auto-Fill Flow:

#### Test Case 1: Johor

```
IC: 990101-01-1234
├─ State Code: 01
├─ State: Johor
└─ Postcode: 80000 ✅
```

#### Test Case 2: Selangor

```
IC: 990101-10-1234
├─ State Code: 10
├─ State: Selangor
└─ Postcode: 40000 ✅
```

#### Test Case 3: Kuala Lumpur

```
IC: 990101-14-1234
├─ State Code: 14
├─ State: Kuala Lumpur
└─ Postcode: 50000 ✅
```

### UI Enhancement:

- Postcode field shows: **"Auto-filled from IC state"** helper text
- User can still manually edit if needed
- Postcode updates when IC state code changes

### Code Implementation:

```javascript
// Postcode mapping by state
const statePostcodeMap = {
  Johor: "80000",
  Kedah: "05000",
  Kelantan: "15000",
  Melaka: "75000",
  "Negeri Sembilan": "70000",
  Pahang: "25000",
  "Pulau Pinang": "10000",
  Perak: "30000",
  Perlis: "01000",
  Selangor: "40000",
  Terengganu: "20000",
  Sabah: "88000",
  Sarawak: "93000",
  "Kuala Lumpur": "50000",
  Labuan: "87000",
  Putrajaya: "62000",
};

// Auto-fill postcode when state is extracted
if (state) {
  const postcode = statePostcodeMap[state];
  setFormData((prev) => ({
    ...prev,
    state,
    postcode: postcode || prev.postcode,
  }));
}
```

### User Experience:

1. **User enters IC:** `990101011234`
2. **System formats:** `990101-01-1234`
3. **System auto-fills:**
   - ✅ DOB: `1999-01-01`
   - ✅ Gender: `Female`
   - ✅ State: `Johor`
   - ✅ **Postcode: `80000`** ← NEW!
4. **User can edit** postcode if needed (e.g., specific area)

### Notes:

- Postcodes are **representative** of the state capital or main city
- Users can manually change to their specific postcode
- Postcode is a 5-digit number in Malaysia
- Field has `maxLength={5}` validation

### Testing:

```bash
# Test different states
IC: 990101-01-1234 → Johor → 80000
IC: 990101-10-1234 → Selangor → 40000
IC: 990101-14-1234 → KL → 50000
IC: 990101-12-1234 → Sabah → 88000
IC: 990101-13-1234 → Sarawak → 93000
```

## Complete Auto-Fill Summary:

From a single IC number (`990101-01-1234`), the system now auto-fills:

1. ✅ **IC Format:** `990101-01-1234` (with dashes)
2. ✅ **DOB:** `1999-01-01` (from YYMMDD)
3. ✅ **Gender:** `Female` (from last digit - even)
4. ✅ **State:** `Johor` (from code 01)
5. ✅ **City:** `Johor Bahru` (from state mapping) ← **NEW!**
6. ✅ **Postcode:** `80000` (from state mapping)

**6 fields auto-filled from 1 input!** 🎉
