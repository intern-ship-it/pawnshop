# Camera Capture Integration - Fixed! ✅

## Issue

The "Take Photo with Camera" button was opening the file upload dialog instead of the camera.

## Solution

Integrated the existing `GlobalCameraModal` component with the IC photo upload functionality.

## Changes Made

### 1. Import Camera Actions

```javascript
import { addToast, openCamera, closeCamera } from "@/features/ui/uiSlice";
```

### 2. Added State Management

```javascript
const [currentCaptureType, setCurrentCaptureType] = useState(null); // 'icFront', 'icBack', or 'profile'
const { capturedImage } = useAppSelector((state) => state.ui.camera);
```

### 3. Created Camera Handler

```javascript
const handleCameraCapture = (type) => {
  setCurrentCaptureType(type);
  dispatch(openCamera({ contextId: type }));
};
```

### 4. Process Captured Images

```javascript
useEffect(() => {
  if (capturedImage && currentCaptureType) {
    // Convert base64 to File object
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `${currentCaptureType}.jpg`, {
          type: "image/jpeg",
        });

        // Set the image based on type
        switch (currentCaptureType) {
          case "icFront":
            setIcFrontImage(capturedImage);
            setIcFrontFile(file);
            setErrors((prev) => ({ ...prev, icFront: null }));
            break;
          case "icBack":
            setIcBackImage(capturedImage);
            setIcBackFile(file);
            setErrors((prev) => ({ ...prev, icBack: null }));
            break;
          case "profile":
            setProfilePhoto(capturedImage);
            setProfilePhotoFile(file);
            break;
        }

        dispatch(
          addToast({
            type: "success",
            title: "Photo Captured",
            message: `Photo captured successfully`,
          })
        );

        setCurrentCaptureType(null);
      });
  }
}, [capturedImage, currentCaptureType, dispatch]);
```

### 5. Updated Button Handlers

**Before:**

```jsx
<button onClick={() => icFrontRef.current?.click()}>
  Take Photo with Camera
</button>
```

**After:**

```jsx
<button onClick={() => handleCameraCapture("icFront")}>
  Take Photo with Camera
</button>
```

## How It Works

1. **User clicks "Take Photo with Camera"**

   - Calls `handleCameraCapture("icFront")` or `handleCameraCapture("icBack")`
   - Sets `currentCaptureType` to track which photo is being taken
   - Dispatches `openCamera` action

2. **GlobalCameraModal Opens**

   - Shows live camera feed
   - User can see themselves/IC in real-time
   - Uses rear camera on mobile (`facingMode: "environment"`)

3. **User Captures Photo**

   - Clicks "Capture Photo" button
   - Modal dispatches `setCapturedImage` with base64 data
   - Modal closes automatically

4. **Image Processing**

   - `useEffect` detects new `capturedImage`
   - Converts base64 to File object for upload
   - Sets appropriate state based on `currentCaptureType`
   - Shows success toast
   - Resets `currentCaptureType`

5. **Form Submission**
   - File object is ready for API upload
   - Works exactly like file upload

## User Experience

### Desktop:

- Click "Take Photo with Camera"
- Camera modal opens with webcam feed
- Click "Capture Photo"
- Photo appears in preview

### Mobile:

- Click "Take Photo with Camera"
- Camera modal opens with rear camera
- Point at IC card
- Click "Capture Photo"
- Photo appears in preview

## Features

✅ **Live Camera Preview** - See what you're capturing
✅ **Rear Camera on Mobile** - Perfect for IC photos
✅ **Base64 to File Conversion** - Compatible with API
✅ **Error Clearing** - Removes validation errors on capture
✅ **Success Feedback** - Toast notification on capture
✅ **Multiple Photos** - Works for IC Front, IC Back, and Profile
✅ **Cancel Support** - User can close modal without capturing

## Testing

### Test IC Front Capture:

1. Go to `/customers/create`
2. Scroll to "IC Copy (KPKT Requirement)"
3. Click "Take Photo with Camera" under IC Front
4. Camera modal opens
5. Click "Capture Photo"
6. Photo appears in IC Front preview ✅

### Test IC Back Capture:

1. Click "Take Photo with Camera" under IC Back
2. Camera modal opens
3. Click "Capture Photo"
4. Photo appears in IC Back preview ✅

### Test Form Submission:

1. Fill all required fields
2. Capture IC Front and Back using camera
3. Submit form
4. Photos upload successfully ✅

## Technical Details

### Camera Modal (GlobalCameraModal)

- Located: `src/components/common/GlobalCameraModal.jsx`
- Rendered in: `MainLayout.jsx` (globally available)
- Uses: `navigator.mediaDevices.getUserMedia()`
- Rear camera: `facingMode: "environment"`

### State Management (Redux)

- Slice: `features/ui/uiSlice.js`
- Actions: `openCamera`, `closeCamera`, `setCapturedImage`
- State: `camera: { isOpen, contextId, capturedImage }`

### File Conversion

```javascript
fetch(base64Image)
  .then((res) => res.blob())
  .then((blob) => new File([blob], "filename.jpg", { type: "image/jpeg" }));
```

## Benefits

1. **Better UX** - Real camera instead of file picker
2. **Mobile Optimized** - Uses rear camera automatically
3. **Instant Preview** - See photo before submitting
4. **No Extra Libraries** - Uses existing GlobalCameraModal
5. **Consistent API** - Same File object as file upload

## Fixed! 🎉

The camera now works correctly for IC photo capture on both desktop and mobile devices!
