import { useState, useEffect, useRef } from "react";
import { useAppDispatch } from "@/app/hooks";
import { verifyPasskey } from "@/features/auth/authSlice";
import { addToast } from "@/features/ui/uiSlice";
import { Modal, Button } from "@/components/common";
import { ShieldCheck, Key, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PasskeyModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Enter Passkey",
  message = "This action requires passkey verification",
  userId = null, // Optional: for manager approval (verify another user's passkey)
}) {
  const dispatch = useAppDispatch();
  const inputRef = useRef(null);

  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPasskey("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (passkey.length !== 6) {
      setError("Passkey must be 6 digits");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await dispatch(verifyPasskey(passkey)).unwrap();

      if (result) {
        dispatch(
          addToast({
            type: "success",
            title: "Verified",
            message: "Passkey verified successfully",
          })
        );
        onSuccess?.();
        handleClose();
      }
    } catch (err) {
      setError(err || "Invalid passkey");
      setPasskey("");
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPasskey("");
    setError("");
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && passkey.length === 6) {
      handleVerify();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPasskey(value);
    setError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <div className="p-6">
        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-amber-600" />
          </div>
        </div>

        {/* Message */}
        <p className="text-center text-zinc-600 mb-6">{message}</p>

        {/* Passkey Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">
            6-Digit Passkey
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Key className="h-5 w-5 text-zinc-400" />
            </div>
            <input
              ref={inputRef}
              type="password"
              value={passkey}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="• • • • • •"
              maxLength={6}
              className={cn(
                "block w-full pl-10 pr-4 py-3 border rounded-lg text-center text-2xl tracking-[0.5em] font-mono",
                "bg-white placeholder-zinc-300",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                error ? "border-red-300" : "border-zinc-300"
              )}
              autoComplete="off"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            fullWidth
            onClick={handleClose}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            fullWidth
            onClick={handleVerify}
            loading={isVerifying}
            disabled={passkey.length !== 6}
          >
            Verify
          </Button>
        </div>

        {/* Hint */}
        <p className="text-xs text-zinc-400 text-center mt-4">
          Enter your 6-digit passkey to continue
        </p>
      </div>
    </Modal>
  );
}
