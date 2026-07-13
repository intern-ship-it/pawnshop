import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ImageOff,
  Loader2,
  Lock,
  Upload,
  CheckCircle2,
  KeyRound,
  ChevronRight,
  Package,
  AlertTriangle,
  Scale,
  X,
  Fingerprint,
  Trash2,
  Search,
} from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Badge from "@/components/common/Badge";
import { apiGet, apiPost } from "@/services/api";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import {
  isWebauthnSupported,
  hasPlatformAuthenticator,
  registerDevice,
  authenticateDevice,
  listDevices,
  removeDevice,
} from "./webauthn";

/**
 * Hidden developer tool: fill in the pledge items that have no photo.
 *
 * Not in the sidebar; reachable only by typing the URL. The API 404s for
 * anyone who is not the developer, and re-checks the passkey on every upload —
 * the prompt below is convenience, not the security boundary.
 */

// Same compression NewPledge.jsx applies, so backfilled photos match the
// existing ones in size and format (~110KB rather than multi-MB).
const compressImage = (dataUrl, maxWidth = 800, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function MissingImages() {
  const { role } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";
  const isDeveloper = roleSlug === "developer";

  const [passkey, setPasskey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  // A counter, not a boolean: re-keying the animation on each rejection is what
  // makes a SECOND wrong attempt shake again. A flag would not change, so
  // framer-motion would see no new state and sit still.
  const [rejections, setRejections] = useState(0);

  // One row per pledge that has at least one item without a photo.
  const [pledges, setPledges] = useState([]);
  const [meta, setMeta] = useState({ total_items: 0, total_pledges: 0 });
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [doneCount, setDoneCount] = useState(0);

  // Picking a file does NOT write it. It stages the photo here for confirmation
  // first — this writes to a live pledge record, so a misclick must not be able
  // to commit one. { pledgeId, item, photo } while staged, null otherwise.
  const [pending, setPending] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");

  // Filtered in the browser: the whole list is already loaded (one row per
  // pledge, no photos), so a server round-trip would buy nothing.
  const [query, setQuery] = useState("");

  // Items are fetched per pledge, on expand, because the photo column is ~110KB
  // of base64 per row — fetching them for every pledge at once exhausts memory.
  const [expandedId, setExpandedId] = useState(null);
  const [itemsByPledge, setItemsByPledge] = useState({});
  const [loadingItems, setLoadingItems] = useState(null);
  const [preview, setPreview] = useState(null);

  // Change-credentials panel. Password and passkey are separate actions —
  // each is authorized by the current passkey, and the password additionally
  // by the current password.
  const [showCreds, setShowCreds] = useState(false);
  const [credsTab, setCredsTab] = useState("passkey"); // "passkey" | "password"
  const [creds, setCreds] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
    new_passkey: "",
    new_passkey_confirmation: "",
  });
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsError, setCredsError] = useState("");
  const [credsOk, setCredsOk] = useState("");

  // Fingerprint (WebAuthn) — a SECOND factor on top of the passkey, enforced only
  // on devices where one is registered, so you can never lock yourself out.
  // Nothing here is a security boundary: the server re-decides every ceremony.
  const [devices, setDevices] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [regLabel, setRegLabel] = useState("");
  const [fpMsg, setFpMsg] = useState("");
  const [fpError, setFpError] = useState("");

  // Whether this device really has a fingerprint reader / Windows Hello / Face ID.
  // The browser exposing the WebAuthn API is NOT the same thing — a desktop with no
  // biometric hardware still exposes it. null = still asking the platform.
  const [canFingerprint, setCanFingerprint] = useState(null);

  useEffect(() => {
    let alive = true;
    hasPlatformAuthenticator().then((ok) => {
      if (alive) setCanFingerprint(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const resetCredsForm = () => {
    setCreds({
      current_password: "",
      new_password: "",
      new_password_confirmation: "",
      new_passkey: "",
      new_passkey_confirmation: "",
    });
    setCredsError("");
    setCredsOk("");
  };

  const loadPledges = useCallback(async () => {
    setLoading(true);
    try {
      // The axios response interceptor already unwraps to the JSON body,
      // so this IS { success, data, meta } — not an axios envelope.
      const res = await apiGet("/dev/missing-images");
      setPledges(res.data || []);
      setMeta(res.meta || { total_items: 0, total_pledges: 0 });
    } catch {
      setError("Could not load the list.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Expand a pledge, fetching its full item list (photos included) once. */
  const togglePledge = async (pledge) => {
    const id = pledge.pledge_id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (itemsByPledge[id]) return; // already fetched

    setLoadingItems(id);
    setError("");
    try {
      const res = await apiGet(`/dev/pledges/${id}/items`);
      setItemsByPledge((prev) => ({ ...prev, [id]: res.data.items || [] }));
    } catch {
      setError(`Could not load items for ${pledge.pledge_no}.`);
      setExpandedId(null);
    } finally {
      setLoadingItems(null);
    }
  };

  const unlock = async (e) => {
    e.preventDefault();
    setUnlocking(true);
    setError("");
    try {
      // Factor 1 — knowledge. (The interceptor already unwraps to the JSON body.)
      const res = await apiPost("/dev/verify", { passkey });

      // Factor 2 — possession, but only where a device is actually registered for
      // this origin. On an unregistered device the passkey alone suffices, which is
      // why you can never lock yourself out.
      if (res.webauthn_required) {
        if (!isWebauthnSupported()) {
          setError(
            "This account requires a fingerprint, but this browser cannot provide one. Use the device you registered.",
          );
          setRejections((n) => n + 1);
          return;
        }
        await authenticateDevice();
      }

      setUnlocked(true);
      await loadPledges();
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Fingerprint cancelled or timed out. Try again."
          : err?.message || "Invalid passkey.",
      );
      setRejections((n) => n + 1);
      setPasskey(""); // clear the bad entry so the next attempt starts fresh
    } finally {
      setUnlocking(false);
    }
  };

  /** True when the item being filled is the pledge's only remaining gap. */
  const isLastGap = (pledgeId, itemId) => {
    const gaps = (itemsByPledge[pledgeId] || []).filter((i) => !i.has_photo);
    return gaps.length === 1 && gaps[0].item_id === itemId;
  };

  /**
   * Step 1 of 2: stage the chosen photo for review. Nothing is written yet.
   * Compression happens here so what you approve is byte-for-byte what gets saved.
   */
  const stagePhoto = async (pledgeId, item, file) => {
    if (!file) return;
    setError("");
    setSavedMsg("");
    try {
      const compressed = await compressImage(await readFile(file));
      setPending({ pledgeId, item, photo: compressed });
    } catch {
      setError(`Could not read that image for item ${item.item_no}.`);
    }
  };

  /** Step 2 of 2: commit the staged photo. This is the only place that writes. */
  const confirmUpload = async () => {
    if (!pending) return;
    const { pledgeId, item, photo: compressed } = pending;

    setUploadingId(item.item_id);
    setError("");
    try {
      await apiPost(`/dev/missing-images/${item.item_id}/photo`, {
        passkey,
        photo: compressed,
      });
      setPending(null);
      setSavedMsg(
        `Saved. Photo attached to item ${item.item_no} on pledge ${item.pledge_no ?? ""}`.trim(),
      );
      setDoneCount((prev) => prev + 1);

      // Show the new photo in place rather than re-fetching the pledge —
      // the compressed data URI we just sent is exactly what was stored.
      setItemsByPledge((prev) => ({
        ...prev,
        [pledgeId]: (prev[pledgeId] || []).map((i) =>
          i.item_id === item.item_id
            ? { ...i, photo: compressed, has_photo: true }
            : i,
        ),
      }));

      // Decrement the pledge's missing count, and drop the pledge entirely once
      // it has none left — it no longer belongs on a "missing images" list.
      setPledges((prev) =>
        prev
          .map((p) =>
            p.pledge_id === pledgeId
              ? { ...p, missing_items: Math.max(0, p.missing_items - 1) }
              : p,
          )
          .filter((p) => p.missing_items > 0 || p.pledge_id === expandedId),
      );
      setMeta((prev) => ({
        total_items: Math.max(0, prev.total_items - 1),
        // The pledge stops counting the moment its last gap is filled, even
        // though its row stays on screen while you are looking at it.
        total_pledges: Math.max(
          0,
          prev.total_pledges - (isLastGap(pledgeId, item.item_id) ? 1 : 0),
        ),
      }));
    } catch (err) {
      // The axios interceptor already unwrapped the body, so the server's
      // message (409 "already has a photo", 422 bad image, 401 bad passkey)
      // arrives as err.message.
      setError(err?.message || `Upload failed for item ${item.item_no}.`);
    } finally {
      setUploadingId(null);
    }
  };

  const loadDevices = useCallback(async () => {
    if (!isWebauthnSupported()) return;
    try {
      setDevices(await listDevices());
    } catch {
      // Non-fatal: the fingerprint section simply shows nothing registered.
    }
  }, []);

  const handleRegisterDevice = async () => {
    setRegistering(true);
    setFpMsg("");
    setFpError("");
    try {
      await registerDevice(regLabel || "This device");
      setFpMsg(
        "Device registered. Unlocking from this browser will now ask for your fingerprint as well as the passkey.",
      );
      setRegLabel("");
      await loadDevices();
    } catch (err) {
      setFpError(
        err?.name === "NotAllowedError"
          ? "Registration cancelled."
          : err?.message || "Could not register this device.",
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveDevice = async (id) => {
    setFpMsg("");
    setFpError("");
    try {
      await removeDevice(id);
      setFpMsg("Device removed.");
      await loadDevices();
    } catch (err) {
      setFpError(err?.message || "Could not remove that device.");
    }
  };

  const saveCredentials = async (e) => {
    e.preventDefault();
    setCredsError("");
    setCredsOk("");

    const changingPasskey = credsTab === "passkey";

    // Catch a mistyped passkey here rather than after it is hashed — the passkey
    // is what authorizes future changes, so a typo would lock the tool.
    if (changingPasskey && creds.new_passkey !== creds.new_passkey_confirmation) {
      setCredsError("The two passkeys do not match.");
      return;
    }

    setSavingCreds(true);
    try {
      const payload = { current_passkey: passkey };
      if (changingPasskey) {
        payload.new_passkey = creds.new_passkey;
      } else {
        payload.current_password = creds.current_password;
        payload.new_password = creds.new_password;
        payload.new_password_confirmation = creds.new_password_confirmation;
      }

      const res = await apiPost("/dev/credentials", payload);

      // The unlocked session holds the current passkey to authorize uploads.
      // If it just changed, keep the session in step or the next upload 401s.
      if (changingPasskey) setPasskey(creds.new_passkey);

      resetCredsForm();
      setCredsOk(res.message || "Updated.");
    } catch (err) {
      setCredsError(err?.message || "Could not update credentials.");
    } finally {
      setSavingCreds(false);
    }
  };

  // Belt-and-braces: the API 404s anyway, but never render the tool's chrome
  // to a non-developer who somehow reaches the route.
  useEffect(() => {
    if (!isDeveloper) setUnlocked(false);
  }, [isDeveloper]);

  if (!isDeveloper) return null;

  // Match on the things you would actually have to hand: the pledge number, the
  // customer's name, their IC, or the receipt number.
  //
  // A plain "contains" is wrong here. Every pledge is PLG-HQ-2026-XXXX, so typing
  // "202" — meaning sequence 0202 — is also a substring of the YEAR 2026 and would
  // match every single pledge. For a purely numeric query we therefore compare
  // against the trailing sequence number, which is the part that actually
  // distinguishes one pledge from another. Text queries still match anywhere.
  const q = query.trim().toLowerCase();

  const tail = (ref) => String(ref || "").split("-").pop() || ""; // "PLG-HQ-2026-0202" -> "0202"

  const anywhere = (p) =>
    [p.pledge_no, p.customer_name, p.customer_ic, p.receipt_no]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));

  const bySequence = (p) => {
    const stripped = q.replace(/^0+/, "");
    return (
      tail(p.pledge_no).replace(/^0+/, "").startsWith(stripped) ||
      tail(p.receipt_no).replace(/^0+/, "").startsWith(stripped) ||
      String(p.customer_ic || "").includes(q)
    );
  };

  let visiblePledges = pledges;
  if (q) {
    if (/^\d+$/.test(q)) {
      visiblePledges = pledges.filter(bySequence);
      // A numeric query that matches no sequence is probably the year, or part of
      // an IC — fall back to a plain contains rather than showing nothing at all.
      if (visiblePledges.length === 0) {
        visiblePledges = pledges.filter(anywhere);
      }
    } else {
      visiblePledges = pledges.filter(anywhere);
    }
  }

  if (!unlocked) {
    // Red while an error is showing — it clears as soon as they start retyping,
    // so the card does not stay angry forever after one bad attempt. The shake
    // itself is keyed on `rejections` so each new rejection replays it.
    const rejected = Boolean(error);

    return (
      <PageWrapper title="Restricted">
        <motion.div
          // Keyed on the rejection count so a SECOND wrong passkey shakes again.
          key={rejections}
          className="max-w-sm mx-auto"
          animate={
            rejected
              ? {
                  x: [0, -10, 9, -7, 5, -3, 0],
                  // Red glow that blooms on rejection and fades back out.
                  boxShadow: [
                    "0 0 0 0 rgba(239,68,68,0)",
                    "0 0 0 4px rgba(239,68,68,0.35)",
                    "0 0 0 0 rgba(239,68,68,0)",
                  ],
                }
              : {}
          }
          transition={{
            x: { duration: 0.45, ease: "easeInOut" },
            boxShadow: { duration: 1.1, ease: "easeOut" },
          }}
          style={{ borderRadius: "0.75rem" }}
        >
          <Card
            className={cn(
              "p-6 transition-colors duration-500",
              rejected && "border-red-300",
            )}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock
                className={cn(
                  "w-5 h-5 transition-colors",
                  rejected ? "text-red-500" : "text-zinc-500",
                )}
              />
              <h2 className="font-semibold">Enter passkey</h2>
            </div>
            <form onSubmit={unlock} className="space-y-4">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={passkey}
                onChange={(e) => {
                  setPasskey(e.target.value);
                  if (error) setError(""); // clear the red state as they retype
                }}
                placeholder="6-digit passkey"
                autoFocus
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 text-sm text-red-600"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button
                type="submit"
                disabled={passkey.length !== 6 || unlocking}
                className="w-full"
              >
                {unlocking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Unlock"
                )}
              </Button>
            </form>
          </Card>
        </motion.div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Missing item images"
      subtitle={`${meta.total_items} item(s) across ${meta.total_pledges} pledge(s) have no photo`}
      actions={
        <Button
          variant="secondary"
          leftIcon={KeyRound}
          onClick={() => {
            resetCredsForm();
            setFpMsg("");
            setFpError("");
            if (!showCreds) loadDevices();
            setShowCreds((v) => !v);
          }}
        >
          Change passkey / password
        </Button>
      }
    >
      {showCreds && (
        <Card className="mb-4 p-6">
          <div className="mb-4 flex gap-2 border-b border-zinc-200">
            {[
              { id: "passkey", label: "Change passkey", icon: KeyRound },
              { id: "password", label: "Change password", icon: Lock },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  resetCredsForm();
                  setCredsTab(tab.id);
                }}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                  credsTab === tab.id
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={saveCredentials} className="space-y-4">
            {credsTab === "passkey" ? (
              <>
                <p className="text-sm text-zinc-500">
                  The passkey is the 6-digit code that unlocks this page and
                  authorizes each upload. Your current passkey authorizes the
                  change.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="New passkey"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    value={creds.new_passkey}
                    onChange={(e) =>
                      setCreds((c) => ({ ...c, new_passkey: e.target.value }))
                    }
                    placeholder="6 digits"
                    autoFocus
                  />
                  <Input
                    label="Confirm new passkey"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    value={creds.new_passkey_confirmation}
                    onChange={(e) =>
                      setCreds((c) => ({
                        ...c,
                        new_passkey_confirmation: e.target.value,
                      }))
                    }
                    placeholder="Repeat the 6 digits"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-500">
                  The password is what you log in with. Changing it needs your
                  current password as well as your passkey.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={creds.current_password}
                    onChange={(e) =>
                      setCreds((c) => ({
                        ...c,
                        current_password: e.target.value,
                      }))
                    }
                    placeholder="Your current password"
                    autoFocus
                  />
                  <div className="hidden sm:block" />
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={creds.new_password}
                    onChange={(e) =>
                      setCreds((c) => ({ ...c, new_password: e.target.value }))
                    }
                    placeholder="At least 8 characters"
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={creds.new_password_confirmation}
                    onChange={(e) =>
                      setCreds((c) => ({
                        ...c,
                        new_password_confirmation: e.target.value,
                      }))
                    }
                    placeholder="Repeat the new password"
                  />
                </div>
              </>
            )}

            {credsError && <p className="text-sm text-red-600">{credsError}</p>}
            {credsOk && <p className="text-sm text-emerald-600">{credsOk}</p>}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  savingCreds ||
                  (credsTab === "passkey"
                    ? creds.new_passkey.length !== 6 ||
                      creds.new_passkey_confirmation.length !== 6
                    : !creds.current_password ||
                      creds.new_password.length < 8 ||
                      !creds.new_password_confirmation)
                }
              >
                {savingCreds ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : credsTab === "passkey" ? (
                  "Update passkey"
                ) : (
                  "Update password"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreds(false)}
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Fingerprint. Rendered only inside the unlocked page, so anyone who
              never gets in never learns this exists.

              Shown when the device HAS a biometric sensor, or when credentials are
              already registered (so they can still be removed from a machine that
              has none). canFingerprint === null means we are still asking. */}
          {(canFingerprint || devices.length > 0) && (
            <div className="mt-6 border-t pt-6">
              <div className="mb-2 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-zinc-500" />
                <h3 className="font-semibold">Fingerprint</h3>
              </div>
              <p className="mb-4 text-sm text-zinc-500">
                Register this device and unlocking will require your fingerprint{" "}
                <em>as well as</em> your passkey — on this device only. Other
                devices keep working with the passkey alone, so you cannot lock
                yourself out.
              </p>

              {devices.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {devices.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium">{d.device_label}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(d.id)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {canFingerprint ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Device name"
                    value={regLabel}
                    onChange={(e) => setRegLabel(e.target.value)}
                    placeholder="e.g. Office laptop"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={Fingerprint}
                    disabled={registering}
                    onClick={handleRegisterDevice}
                  >
                    {registering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Register this device"
                    )}
                  </Button>
                </div>
              ) : (
                // No sensor here, but credentials exist on other machines — say so
                // plainly rather than silently offering a button that cannot work.
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                  This device has no fingerprint reader, so it cannot be
                  registered. You can still remove devices listed above, and
                  unlock here with your passkey alone.
                </p>
              )}

              {fpError && <p className="mt-2 text-sm text-red-600">{fpError}</p>}
              {fpMsg && <p className="mt-2 text-sm text-emerald-600">{fpMsg}</p>}
            </div>
          )}
        </Card>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {savedMsg && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {savedMsg}
          </span>
          <button
            type="button"
            onClick={() => setSavedMsg("")}
            className="text-emerald-700 hover:text-emerald-900"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <ImageOff className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Items without a photo</p>
              <p className="text-xl font-bold text-amber-600">
                {loading ? "…" : meta.total_items}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100">
              <Package className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Pledges affected</p>
              <p className="text-xl font-bold text-zinc-800">
                {loading ? "…" : meta.total_pledges}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Uploaded this session</p>
              <p className="text-xl font-bold text-emerald-600">{doneCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search. Only worth showing once there is a list to search. */}
      {!loading && pledges.length > 0 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pledge no, customer, IC or receipt no…"
            className={cn(
              "w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-9 text-sm",
              "placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <Card className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </Card>
      ) : pledges.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="p-3 rounded-full bg-emerald-50">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-zinc-800">Nothing to fix</p>
            <p className="text-sm text-zinc-500">
              Every pledge item has a photo.
            </p>
          </div>
        </Card>
      ) : visiblePledges.length === 0 ? (
        // Distinct from "nothing to fix" — there IS work, it just does not match.
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="p-3 rounded-full bg-zinc-100">
            <Search className="w-7 h-7 text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-800">No matching pledge</p>
            <p className="text-sm text-zinc-500">
              Nothing matches “{query}”. {pledges.length} pledge(s) still need
              photos.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {visiblePledges.map((pledge) => {
            const isOpen = expandedId === pledge.pledge_id;
            const items = itemsByPledge[pledge.pledge_id];
            const complete = pledge.missing_items === 0;

            return (
              <Card key={pledge.pledge_id} padding="none" className="overflow-hidden">
                {/* Pledge row — click to reveal every item on the pledge. */}
                <button
                  type="button"
                  onClick={() => togglePledge(pledge)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 text-left transition-colors",
                    isOpen ? "bg-zinc-50" : "hover:bg-zinc-50",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 shrink-0 text-zinc-400 transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-800">
                        {pledge.pledge_no}
                      </span>
                      <Badge.Status status={pledge.pledge_status} size="sm" />
                    </div>
                    <p className="text-sm text-zinc-500 truncate mt-0.5">
                      {pledge.customer_name}
                      {pledge.customer_ic && (
                        <span className="text-zinc-400"> · {pledge.customer_ic}</span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {complete ? (
                      <Badge variant="success" size="sm" icon={CheckCircle2}>
                        All photos added
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm" icon={AlertTriangle}>
                        {pledge.missing_items} of {pledge.total_items} missing
                      </Badge>
                    )}
                  </div>
                </button>

                {/* Every item on the pledge, not only the ones with a gap. */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-zinc-100"
                    >
                      {loadingItems === pledge.pledge_id ? (
                        <div className="flex justify-center p-8">
                          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                        </div>
                      ) : (
                        <div className="p-4 bg-zinc-50/60 space-y-4">
                          {(() => {
                            const all = items || [];
                            const gaps = all.filter((i) => !i.has_photo);
                            const done = all.filter((i) => i.has_photo);

                            return (
                              <>
                                {/* What you came here to do, first and largest. */}
                                {gaps.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {gaps.map((item) => (
                                      <UploadSlot
                                        key={item.item_id}
                                        item={item}
                                        uploading={uploadingId === item.item_id}
                                        onUpload={(file) =>
                                          stagePhoto(
                                            pledge.pledge_id,
                                            {
                                              ...item,
                                              pledge_no: pledge.pledge_no,
                                            },
                                            file,
                                          )
                                        }
                                      />
                                    ))}
                                  </div>
                                )}

                                {/* Already photographed — reference only, so it
                                    recedes rather than competing with the gaps. */}
                                {done.length > 0 && (
                                  <div>
                                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {done.length} already photographed
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                      {done.map((item) => (
                                        <DoneThumb
                                          key={item.item_id}
                                          item={item}
                                          onPreview={() => setPreview(item)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm before writing. This mutates a live pledge record, so a
          misclicked file must never commit on its own. */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            >
              <div className="border-b p-4">
                <h2 className="font-semibold text-zinc-800">
                  Attach this photo?
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  It will be saved to the pledge record and logged against your
                  name.
                </p>
              </div>

              <img
                src={pending.photo}
                alt="Photo to be saved"
                className="max-h-72 w-full bg-zinc-100 object-contain"
              />

              <div className="space-y-1 p-4 text-sm">
                <p className="font-semibold text-zinc-800">
                  {pending.item.category} · {pending.item.item_no}
                </p>
                <p className="text-zinc-500">
                  Pledge {pending.item.pledge_no}
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t bg-zinc-50 p-4">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploadingId === pending.item.item_id}
                  onClick={() => setPending(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={uploadingId === pending.item.item_id}
                  onClick={confirmUpload}
                >
                  {uploadingId === pending.item.item_id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save photo"
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-size photo */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full"
            >
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="absolute -top-10 right-0 text-white/80 hover:text-white"
                aria-label="Close preview"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={preview.photo}
                alt={preview.item_no}
                className="w-full rounded-xl bg-white object-contain"
              />
              <p className="mt-3 text-center text-sm text-white/80">
                {preview.item_no} · {preview.category}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}

/**
 * An item that still needs a photo. This is the page's whole purpose, so it gets
 * the space: a big drop target plus the details you need to match a photo to the
 * right item (barcode, description, weight).
 */
function UploadSlot({ item, uploading, onUpload }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative flex cursor-pointer gap-4 rounded-xl border-2 border-dashed p-4 transition-all",
        uploading && "pointer-events-none",
        dragging
          ? "border-amber-500 bg-amber-100/80 scale-[1.01]"
          : "border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-100/60",
      )}
    >
      {/* Drop target */}
      <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-white/70 text-amber-700">
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[11px] font-medium">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 transition-transform group-hover:-translate-y-0.5" />
            <span className="text-[11px] font-semibold">Add photo</span>
            <span className="text-[10px] text-amber-600">or drop it here</span>
          </>
        )}
      </div>

      {/* Everything you need to identify the item */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-zinc-800">{item.category}</p>
          <span className="shrink-0 rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            No photo
          </span>
        </div>
        <p className="font-mono text-[11px] text-zinc-500">{item.item_no}</p>
        <p className="truncate text-sm text-zinc-600">
          {item.description || (
            <span className="italic text-zinc-400">No description</span>
          )}
        </p>
        <div className="flex items-center gap-3 pt-0.5 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Scale className="w-3 h-3" />
            {item.net_weight}g
          </span>
          {item.barcode && (
            <span className="truncate font-mono text-[11px]">
              {item.barcode}
            </span>
          )}
        </div>
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          onUpload(e.target.files?.[0]);
          // Clear the input so cancelling and re-picking the SAME file re-fires.
          e.target.value = "";
        }}
      />
    </label>
  );
}

/**
 * An item that already has a photo. Deliberately small and quiet — it is context,
 * not a task. Click to see it full size.
 */
function DoneThumb({ item, onPreview }) {
  return (
    <button
      type="button"
      onClick={onPreview}
      title={`${item.category} · ${item.item_no}${item.description ? ` · ${item.description}` : ""}`}
      className="group relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
    >
      <img
        src={item.photo}
        alt={item.item_no}
        className="h-full w-full object-cover transition-transform group-hover:scale-110"
      />
      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white truncate">
        {item.category}
      </span>
    </button>
  );
}

