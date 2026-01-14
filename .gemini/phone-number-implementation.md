# Phone Number with Country Code Implementation

## ✅ Completed Steps

### 1. Backend Implementation

- ✅ Created migration to add `country_code` and `whatsapp` columns to customers table
- ✅ Updated Customer model to include new fields in fillable array
- ✅ Updated CustomerController `store()` method validation and creation logic
- ✅ Updated CustomerController `update()` method validation
- ✅ Default country code set to +60 (Malaysia)

### 2. Frontend Implementation

- ✅ Installed `react-phone-number-input` package
- ✅ Created reusable `PhoneInput` component with:
  - Country code dropdown with flags
  - International phone number formatting
  - Validation support
  - Error handling
  - Custom styling matching app design
- ✅ Updated `CustomerCreate.jsx`:
  - Imported PhoneInput component
  - Replaced phone and WhatsApp inputs with PhoneInput
  - Updated validation to accept E.164 format (+60123456789)
  - Added phone number parsing to extract country code
  - Updated API submission to send country_code separately

### 3. Database Changes

- ✅ Migration executed successfully
- ✅ Schema now includes:
  - `country_code` VARCHAR(5) DEFAULT '+60'
  - `whatsapp` VARCHAR(20) NULLABLE

## 📋 Features Implemented

1. **Country Code Selector**

   - Dropdown with all countries and flags
   - Default: Malaysia (+60)
   - Easy to change for international customers

2. **Phone Number Format**

   - Stores in E.164 international format
   - Example: +60123456789
   - Country code stored separately in database

3. **WhatsApp Number**

   - Separate field with country code support
   - "Same as phone number" checkbox
   - Auto-fills from phone when checked

4. **Validation**

   - Requires country code (+ prefix)
   - Minimum length validation
   - Real-time error feedback

5. **User Experience**
   - Clean, modern UI matching app design
   - Helper text showing format example
   - Disabled state support
   - Responsive design

## 🔄 Remaining Tasks

### CustomerEdit.jsx Update

The CustomerEdit page needs the same phone input updates:

1. Import PhoneInput component
2. Replace phone/WhatsApp inputs
3. Update validation logic
4. Update form submission parsing

### Testing Checklist

- [ ] Create new customer with Malaysian number (+60)
- [ ] Create customer with international number (e.g., +65 Singapore)
- [ ] Verify country code stored correctly in database
- [ ] Test WhatsApp "same as phone" checkbox
- [ ] Edit existing customer phone number
- [ ] Verify validation errors display correctly
- [ ] Test form submission with various country codes

## 📝 Usage Example

```jsx
<PhoneInput
  label="Phone Number"
  value={formData.phone}
  onChange={(value) => setFormData({ ...formData, phone: value })}
  error={errors.phone}
  required
  placeholder="Enter phone number"
  defaultCountry="MY"
  helperText="Include country code (e.g., +60 for Malaysia)"
/>
```

## 🗄️ Database Schema

```sql
ALTER TABLE customers
ADD COLUMN country_code VARCHAR(5) DEFAULT '+60' AFTER phone,
ADD COLUMN whatsapp VARCHAR(20) NULL AFTER country_code;
```

## 📊 Data Format

**Frontend (E.164 format):**

```
+60123456789
```

**Backend Storage:**

```json
{
  "country_code": "+60",
  "phone": "123456789",
  "whatsapp": "123456789"
}
```

## 🎨 Component Styling

The PhoneInput component includes custom CSS that:

- Matches the app's design system
- Uses zinc color palette
- Includes hover and focus states
- Shows error states in red
- Displays country flags
- Responsive and accessible
