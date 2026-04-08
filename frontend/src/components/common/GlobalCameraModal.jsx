import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { closeCamera, setCapturedImage } from "@/features/ui/uiSlice";
import {
  Camera,
  X,
  RotateCcw,
  Check,
  AlertTriangle,
  SwitchCamera,
  Flashlight,
  Focus,
  Zap,
} from "lucide-react";

// ─── Blur Detection (Laplacian Variance) ──────────────────────────────
function calculateBlurScore(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;

  // Work on a smaller sample for performance (center crop)
  const sampleSize = Math.min(400, width, height);
  const sx = Math.floor((width - sampleSize) / 2);
  const sy = Math.floor((height - sampleSize) / 2);

  const imageData = ctx.getImageData(sx, sy, sampleSize, sampleSize);
  const data = imageData.data;
  const w = sampleSize;
  const h = sampleSize;

  // Convert to grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Apply Laplacian kernel: [[0,1,0],[1,-4,1],[0,1,0]]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const laplacian =
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] -
        4 * gray[y * w + x];

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return variance;
}

// ─── Crop to Guide Frame ──────────────────────────────────────────────
function cropToGuideFrame(sourceCanvas, videoElement, guideElement) {
  if (!videoElement || !guideElement) return sourceCanvas;
  
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  if (!vw || !vh) return sourceCanvas;
  
  const elementRect = videoElement.getBoundingClientRect();
  const guideRect = guideElement.getBoundingClientRect();

  // object-cover scaling
  const scale = Math.max(elementRect.width / vw, elementRect.height / vh);
  
  const renderedX = elementRect.left + (elementRect.width - vw * scale) / 2;
  const renderedY = elementRect.top + (elementRect.height - vh * scale) / 2;
  
  let cropX = (guideRect.left - renderedX) / scale;
  let cropY = (guideRect.top - renderedY) / scale;
  let cropW = guideRect.width / scale;
  let cropH = guideRect.height / scale;

  // Clamp values
  cropX = Math.max(0, cropX);
  cropY = Math.max(0, cropY);
  cropW = Math.min(vw - cropX, cropW);
  cropH = Math.min(vh - cropY, cropH);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;

  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';
  cropCtx.drawImage(
    sourceCanvas,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );

  return cropCanvas;
}


// ─── Main Component ───────────────────────────────────────────────────
export default function GlobalCameraModal() {
  const dispatch = useAppDispatch();
  const { isOpen, captureMode } = useAppSelector((state) => state.ui.camera);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const analyzeCanvasRef = useRef(null); // Separate canvas for live analysis
  const guideRef = useRef(null); // Guide hole for cropping
  const sharpCountRef = useRef(0); // Track consecutive sharp frames
  const autoCapturePendingRef = useRef(false);

  const [phase, setPhase] = useState("live"); // 'live' | 'countdown' | 'preview'
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [blurScore, setBlurScore] = useState(null);
  const [isBlurry, setIsBlurry] = useState(false);
  const [facingMode, setFacingMode] = useState(
    captureMode === "selfie" ? "user" : "environment"
  );
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [focusIndicator, setFocusIndicator] = useState(null);

  // Auto-capture state
  const [liveBlurScore, setLiveBlurScore] = useState(0);
  const [liveSharpness, setLiveSharpness] = useState("waiting"); // 'waiting' | 'focusing' | 'sharp' | 'capturing'
  const [countdown, setCountdown] = useState(null); // 3, 2, 1, null
  const [autoCapture, setAutoCapture] = useState(true); // Auto-capture toggle

  const isDocument = captureMode === "document";
  const BLUR_THRESHOLD = 80;
  const SHARP_FRAMES_NEEDED = 4; // 4 consecutive sharp checks at 500ms = ~2 seconds of stability

  // ─── Start Camera ─────────────────────────────────────────────────
  const startCamera = useCallback(async (facing) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setCameraReady(false);
    setCameraError(null);

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply advanced constraints (auto-focus, etc.)
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities?.() || {};

        // Try to enable continuous auto-focus
        const advancedConstraints = {};
        if (capabilities.focusMode?.includes("continuous")) {
          advancedConstraints.focusMode = "continuous";
        }
        if (capabilities.exposureMode?.includes("continuous")) {
          advancedConstraints.exposureMode = "continuous";
        }
        if (capabilities.whiteBalanceMode?.includes("continuous")) {
          advancedConstraints.whiteBalanceMode = "continuous";
        }

        if (Object.keys(advancedConstraints).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advancedConstraints] });
          } catch {
            // Some browsers don't support these constraints
          }
        }

        // Check torch support
        setTorchSupported(!!capabilities.torch);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permission."
          : err.name === "NotFoundError"
            ? "No camera found on this device."
            : "Could not access camera. Please try again."
      );
    }
  }, []);

  // ─── Toggle Torch ─────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch {
      // Torch not supported
    }
  }, [torchOn]);

  // ─── Switch Camera ────────────────────────────────────────────────
  const switchCamera = useCallback(() => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    setTorchOn(false);
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  // ─── Capture Photo ────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const fullCanvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = fullCanvas;

    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;

    const ctx = fullCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Auto-crop to guide frame in document mode
    const outputCanvas = isDocument ? cropToGuideFrame(fullCanvas, video, guideRef.current) : fullCanvas;

    const dataUrl = outputCanvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);

    // Blur detection on the cropped area
    const score = calculateBlurScore(outputCanvas);
    setBlurScore(Math.round(score));
    setIsBlurry(score < BLUR_THRESHOLD);

    // Reset auto-capture state
    sharpCountRef.current = 0;
    autoCapturePendingRef.current = false;
    setCountdown(null);
    setLiveSharpness("waiting");

    setPhase("preview");
  }, [BLUR_THRESHOLD, isDocument]);

  // ─── Use Photo ────────────────────────────────────────────────────
  const handleUsePhoto = useCallback(() => {
    if (capturedDataUrl) {
      dispatch(setCapturedImage(capturedDataUrl));
    }
  }, [capturedDataUrl, dispatch]);

  // ─── Retake ───────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedDataUrl(null);
    setBlurScore(null);
    setIsBlurry(false);
    setCountdown(null);
    setLiveSharpness("waiting");
    sharpCountRef.current = 0;
    autoCapturePendingRef.current = false;
    setPhase("live");

    // Re-attach or restart the camera stream
    if (streamRef.current && videoRef.current) {
      // Stream still exists — re-attach to video element
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    } else {
      // Stream was lost — restart camera
      startCamera(facingMode);
    }
  }, [facingMode, startCamera]);

  // ─── Close ────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    dispatch(closeCamera());
  }, [dispatch]);

  // ─── Tap to Focus (mobile) ────────────────────────────────────────
  const handleTapToFocus = useCallback(
    async (e) => {
      if (phase !== "live" || !streamRef.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Show focus indicator
      setFocusIndicator({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setFocusIndicator(null), 1000);

      // Reset auto-capture when user taps to refocus
      sharpCountRef.current = 0;
      autoCapturePendingRef.current = false;
      setCountdown(null);
      setLiveSharpness("focusing");

      // Try to set focus point (ImageCapture API)
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities?.() || {};
      if (capabilities.focusMode?.includes("manual")) {
        try {
          await track.applyConstraints({
            advanced: [
              {
                focusMode: "manual",
                pointsOfInterest: [{ x, y }],
              },
            ],
          });
          // Switch back to continuous after a brief manual focus
          setTimeout(async () => {
            try {
              await track.applyConstraints({
                advanced: [{ focusMode: "continuous" }],
              });
            } catch {
              // ignore
            }
          }, 2000);
        } catch {
          // Tap-to-focus not supported
        }
      }
    },
    [phase]
  );

  // ─── Live Blur Analysis & Auto-Capture ────────────────────────────
  useEffect(() => {
    if (!isOpen || !cameraReady || phase !== "live" || !autoCapture) return;

    const video = videoRef.current;
    if (!video) return;

    // Create analysis canvas (reuse if exists)
    if (!analyzeCanvasRef.current) {
      analyzeCanvasRef.current = document.createElement("canvas");
    }
    const canvas = analyzeCanvasRef.current;

    const intervalId = setInterval(() => {
      // Don't analyze if not in live phase or countdown is running
      if (autoCapturePendingRef.current) return;
      if (!video || video.readyState < 2) return;

      // Use smaller resolution for performance
      const analyzeWidth = Math.min(320, video.videoWidth);
      const analyzeHeight = Math.round(
        analyzeWidth * (video.videoHeight / video.videoWidth)
      );
      canvas.width = analyzeWidth;
      canvas.height = analyzeHeight;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, analyzeWidth, analyzeHeight);

      const score = calculateBlurScore(canvas);
      const roundedScore = Math.round(score);
      setLiveBlurScore(roundedScore);

      if (score >= BLUR_THRESHOLD) {
        sharpCountRef.current += 1;
        setLiveSharpness("sharp");

        // If sharp for enough consecutive frames, start auto-capture countdown
        if (sharpCountRef.current >= SHARP_FRAMES_NEEDED) {
          autoCapturePendingRef.current = true;
          setLiveSharpness("capturing");

          // Start countdown: 3 → 2 → 1 → capture
          setCountdown(3);
          setTimeout(() => setCountdown(2), 600);
          setTimeout(() => setCountdown(1), 1200);
          setTimeout(() => {
            // Final capture
            if (videoRef.current && autoCapturePendingRef.current) {
              const fullCanvas =
                canvasRef.current || document.createElement("canvas");
              canvasRef.current = fullCanvas;
              fullCanvas.width = videoRef.current.videoWidth;
              fullCanvas.height = videoRef.current.videoHeight;
              const captureCtx = fullCanvas.getContext("2d");
              captureCtx.drawImage(videoRef.current, 0, 0);

              // Auto-crop to guide frame in document mode
              const outputCanvas = captureMode === "document" ? cropToGuideFrame(fullCanvas, videoRef.current, guideRef.current) : fullCanvas;

              const dataUrl = outputCanvas.toDataURL("image/jpeg", 0.92);
              setCapturedDataUrl(dataUrl);

              const finalScore = calculateBlurScore(outputCanvas);
              setBlurScore(Math.round(finalScore));
              setIsBlurry(finalScore < BLUR_THRESHOLD);

              setCountdown(null);
              setPhase("preview");
            }
          }, 1800);
        }
      } else {
        // Reset sharp counter if frame is blurry
        sharpCountRef.current = 0;
        setLiveSharpness(score > BLUR_THRESHOLD * 0.6 ? "focusing" : "waiting");
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, cameraReady, phase, autoCapture, BLUR_THRESHOLD, SHARP_FRAMES_NEEDED]);

  // ─── Lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      const initialFacing =
        captureMode === "selfie" ? "user" : "environment";
      setFacingMode(initialFacing);
      setPhase("live");
      setCapturedDataUrl(null);
      setBlurScore(null);
      setIsBlurry(false);
      setTorchOn(false);
      setCountdown(null);
      setLiveBlurScore(0);
      setLiveSharpness("waiting");
      sharpCountRef.current = 0;
      autoCapturePendingRef.current = false;
      setAutoCapture(true);
      startCamera(initialFacing);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, captureMode, startCamera]);

  if (!isOpen) return null;

  // ─── Sharpness indicator config ───────────────────────────────────
  const sharpnessConfig = {
    waiting: { color: "text-zinc-400", bg: "bg-zinc-500/60", label: "Align card & hold steady", icon: "⏳" },
    focusing: { color: "text-amber-400", bg: "bg-amber-500/60", label: "Focusing...", icon: "🔍" },
    sharp: { color: "text-emerald-400", bg: "bg-emerald-500/60", label: `Sharp! Hold steady... (${sharpCountRef.current}/${SHARP_FRAMES_NEEDED})`, icon: "✨" },
    capturing: { color: "text-blue-400", bg: "bg-blue-500/60", label: "Capturing...", icon: "📸" },
  };

  const currentSharpness = sharpnessConfig[liveSharpness] || sharpnessConfig.waiting;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
      {/* ─── Header Bar ──────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-white text-sm font-medium tracking-wide">
          {isDocument ? "📄 Scan IC Card" : "📸 Take Selfie"}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-capture toggle */}
          {phase === "live" && (
            <button
              onClick={() => {
                setAutoCapture(!autoCapture);
                sharpCountRef.current = 0;
                autoCapturePendingRef.current = false;
                setCountdown(null);
                setLiveSharpness("waiting");
              }}
              className={`p-2 rounded-full transition-colors backdrop-blur-sm ${
                autoCapture
                  ? "bg-emerald-500 text-white"
                  : "bg-black/40 text-white hover:bg-black/60"
              }`}
              title={autoCapture ? "Auto-capture ON" : "Auto-capture OFF"}
            >
              <Zap className="w-5 h-5" />
            </button>
          )}

          {/* Torch toggle */}
          {torchSupported && phase === "live" && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full transition-colors backdrop-blur-sm ${
                torchOn
                  ? "bg-amber-500 text-white"
                  : "bg-black/40 text-white hover:bg-black/60"
              }`}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}

          {/* Camera switch */}
          {phase === "live" && (
            <button
              onClick={switchCamera}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Camera Feed / Preview ───────────────────────────── */}
      <div
        className="relative w-full h-full max-w-xl mx-auto flex items-center justify-center overflow-hidden"
        onClick={handleTapToFocus}
      >
        {cameraError ? (
          <div className="text-center text-white p-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
            <p className="text-lg font-medium mb-2">Camera Error</p>
            <p className="text-sm text-zinc-400">{cameraError}</p>
            <button
              onClick={() => startCamera(facingMode)}
              className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : phase === "live" || phase === "countdown" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />

            {/* Loading state */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/70 text-sm">Starting camera...</p>
                </div>
              </div>
            )}

            {/* ─── Card Guide Overlay (Document mode only) ───── */}
            {isDocument && cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
                {/* Guide hole with box shadow for darkening the outside */}
                <div 
                  ref={guideRef}
                  className="relative w-[85%] max-w-[420px] aspect-[1.58/1] rounded-xl"
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                    border: `2px ${liveSharpness === "sharp" || liveSharpness === "capturing" ? "solid" : "dashed"} ${
                      liveSharpness === "sharp" || liveSharpness === "capturing"
                        ? "rgba(52,211,153,0.9)"
                        : liveSharpness === "focusing"
                          ? "rgba(251,191,36,0.8)"
                          : "rgba(255,255,255,0.8)"
                    }`,
                    transition: "border-color 0.3s"
                  }}
                >
                  {/* Corner brackets */}
                  {(() => {
                    const cornerColor =
                      liveSharpness === "sharp" || liveSharpness === "capturing"
                        ? "bg-emerald-400"
                        : liveSharpness === "focusing"
                          ? "bg-amber-400"
                          : "bg-amber-400";
                    return (
                      <>
                        {/* Top-left corner */}
                        <div className="absolute -top-[2px] -left-[2px] w-6 h-6 sm:w-8 sm:h-8">
                          <div className={`absolute top-0 left-0 w-full h-[3px] ${cornerColor} rounded-tl-xl transition-colors duration-300`} />
                          <div className={`absolute top-0 left-0 w-[3px] h-full ${cornerColor} rounded-tl-xl transition-colors duration-300`} />
                        </div>
                        {/* Top-right corner */}
                        <div className="absolute -top-[2px] -right-[2px] w-6 h-6 sm:w-8 sm:h-8">
                          <div className={`absolute top-0 right-0 w-full h-[3px] ${cornerColor} rounded-tr-xl transition-colors duration-300`} />
                          <div className={`absolute top-0 right-0 w-[3px] h-full ${cornerColor} rounded-tr-xl transition-colors duration-300`} />
                        </div>
                        {/* Bottom-left corner */}
                        <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 sm:w-8 sm:h-8">
                          <div className={`absolute bottom-0 left-0 w-full h-[3px] ${cornerColor} rounded-bl-xl transition-colors duration-300`} />
                          <div className={`absolute bottom-0 left-0 w-[3px] h-full ${cornerColor} rounded-bl-xl transition-colors duration-300`} />
                        </div>
                        {/* Bottom-right corner */}
                        <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 sm:w-8 sm:h-8">
                          <div className={`absolute bottom-0 right-0 w-full h-[3px] ${cornerColor} rounded-br-xl transition-colors duration-300`} />
                          <div className={`absolute bottom-0 right-0 w-[3px] h-full ${cornerColor} rounded-br-xl transition-colors duration-300`} />
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Instruction text */}
                <div className="absolute left-0 right-0 flex justify-center" style={{ top: "18%" }}>
                  <div className="px-4 py-1.5 bg-black/60 rounded-full backdrop-blur-sm">
                    <p className="text-white text-xs font-medium tracking-wide flex items-center gap-1.5">
                      <Focus className="w-3.5 h-3.5 text-amber-400" />
                      Align IC card within the frame
                    </p>
                  </div>
                </div>

                {/* Live status indicator */}
                {autoCapture && (
                  <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: "19%" }}>
                    <div className={`px-3 py-1 rounded-full backdrop-blur-sm ${currentSharpness.bg} transition-colors duration-300`}>
                      <p className="text-white text-[11px] font-medium flex items-center gap-1.5">
                        <span>{currentSharpness.icon}</span>
                        {currentSharpness.label}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom hint when auto-capture is off */}
                {!autoCapture && (
                  <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: "19%" }}>
                    <p className="text-white/50 text-[11px]">
                      Hold steady • Auto-focus active
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Non-document mode hint */}
            {!isDocument && cameraReady && autoCapture && (
              <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: "22%" }}>
                <div className={`px-3 py-1 rounded-full backdrop-blur-sm ${currentSharpness.bg} transition-colors duration-300`}>
                  <p className="text-white text-[11px] font-medium flex items-center gap-1.5">
                    <span>{currentSharpness.icon}</span>
                    {currentSharpness.label}
                  </p>
                </div>
              </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <div className="relative">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-white/30 animate-ping" />
                  {/* Number */}
                  <div className="w-28 h-28 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border-2 border-white/50">
                    <span className="text-white text-5xl font-bold">{countdown}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tap to focus indicator */}
            {focusIndicator && (
              <div
                className="absolute w-16 h-16 border-2 border-amber-400 rounded-lg pointer-events-none animate-ping"
                style={{
                  left: focusIndicator.x - 32,
                  top: focusIndicator.y - 32,
                }}
              />
            )}
          </>
        ) : (
          /* ─── Preview Phase ─────────────────────────────────── */
          <div className="w-full h-full flex items-center justify-center bg-black px-4">
            <img
              src={capturedDataUrl}
              alt="Captured"
              className="w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              style={{
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />

            {/* Blur warning overlay */}
            {isBlurry && (
              <div className="absolute top-20 left-0 right-0 flex justify-center">
                <div className="mx-4 px-4 py-3 bg-amber-500/90 rounded-xl backdrop-blur-sm flex items-center gap-3 max-w-sm shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold text-sm">
                      Image appears blurry
                    </p>
                    <p className="text-white/80 text-xs mt-0.5">
                      Consider retaking for a clearer photo
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quality badge */}
            {!isBlurry && blurScore !== null && (
              <div className="absolute top-20 left-0 right-0 flex justify-center">
                <div className="px-4 py-2 bg-emerald-500/90 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-lg">
                  <Check className="w-5 h-5 text-white" />
                  <p className="text-white font-semibold text-sm">
                    Sharp & Clear
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom Controls ─────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent">
        <div className="px-6 pb-8 pt-12">
          {phase === "live" || phase === "countdown" ? (
            /* ─── Live Controls ──────────────────────────────── */
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={handleClose}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Shutter button */}
              <button
                onClick={handleCapture}
                disabled={!cameraReady || countdown !== null}
                className="group relative w-[72px] h-[72px] rounded-full flex items-center justify-center disabled:opacity-40"
              >
                <div className="absolute inset-0 rounded-full border-[3px] border-white" />
                <div className="w-[60px] h-[60px] rounded-full bg-white group-hover:bg-zinc-200 group-active:scale-90 transition-all duration-150" />
              </button>

              {/* Spacer for alignment */}
              <div className="w-12 h-12" />
            </div>
          ) : (
            /* ─── Preview Controls ───────────────────────────── */
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleRetake}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm font-medium text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>

              <button
                onClick={handleUsePhoto}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors shadow-lg ${
                  isBlurry
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                }`}
              >
                <Check className="w-4 h-4" />
                {isBlurry ? "Use Anyway" : "Use Photo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
