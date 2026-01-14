import { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { closeCamera, setCapturedImage } from "@/features/ui/uiSlice";
import Modal from "./Modal";
import Button from "./Button";
import { Camera } from "lucide-react";

export default function GlobalCameraModal() {
  const dispatch = useAppDispatch();
  const { isOpen } = useAppSelector((state) => state.ui.camera);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  // Start camera when modal opens
  useEffect(() => {
    let mediaStream = null;

    const startCamera = async () => {
      if (isOpen) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          setStream(mediaStream);
        } catch (err) {
          console.error("Error accessing camera:", err);
        }
      }
    };

    startCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
    };
  }, [isOpen]);

  // Attach stream to video
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleClose = () => {
    dispatch(closeCamera());
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0);
      const photoDataUrl = canvas.toDataURL("image/jpeg");

      dispatch(setCapturedImage(photoDataUrl));
    }
  };

  // Even if not open, we might want to keep it mounted or unmounted.
  // With Modal component, we usually pass isOpen.
  // If we return null when !isOpen, the Modal unmounts.
  // If the Modal handles "isOpen" for animation, we should let it render.
  // But our Modal logic usually uses AnimatePresence or returns null if !isOpen.
  // We'll let the Modal handle it or return null here.
  // The Modal component likely handles internal state.
  // However, `getUserMedia` logic relies on this component being mounted/updated.

  // If we return null when !isOpen, then the useEffect runs when it mounts (becomes true).
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Take Photo" size="md">
      <div className="flex flex-col">
        <div className="relative bg-black aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4 flex justify-center gap-4 bg-white border-t border-zinc-100">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleCapture} leftIcon={Camera}>
            Capture Photo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
