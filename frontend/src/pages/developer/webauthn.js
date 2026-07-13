import { apiGet, apiPost, apiDelete } from "@/services/api";

/**
 * Browser-side WebAuthn plumbing for the hidden developer page.
 *
 * No fingerprint ever leaves the device: the secure enclave signs a server-issued
 * challenge with a private key it will not release. Only public keys and signatures
 * move across the wire. Nothing in this file is a security boundary — the server
 * re-decides everything, so lying to it here gains an attacker nothing.
 */

/**
 * Does the BROWSER expose the WebAuthn API at all, in a secure context?
 *
 * WebAuthn requires HTTPS, or localhost (which the spec exempts). Production and
 * staging are both https, so this is true there; it is only false on an http://
 * host that is not localhost.
 *
 * NOTE: this says nothing about whether the device has a fingerprint sensor —
 * for that you need hasPlatformAuthenticator() below.
 */
export const isWebauthnSupported = () =>
  typeof window !== "undefined" &&
  window.PublicKeyCredential !== undefined &&
  window.isSecureContext;

/**
 * Does this DEVICE actually have a built-in authenticator that can verify the
 * user — a fingerprint reader, Face ID, Windows Hello?
 *
 * This is the real question. A desktop with no biometric hardware still exposes
 * the WebAuthn API, so isWebauthnSupported() alone would wrongly offer
 * registration and only fail at the prompt. Async by nature: the browser has to
 * ask the platform.
 */
export async function hasPlatformAuthenticator() {
  if (!isWebauthnSupported()) return false;

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const b64urlToBuf = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
};

const bufToB64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// The server sends base64url strings; the browser API demands ArrayBuffers.
const decodeCreationOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  user: { ...o.user, id: b64urlToBuf(o.user.id) },
  excludeCredentials: (o.excludeCredentials || []).map((c) => ({
    ...c,
    id: b64urlToBuf(c.id),
  })),
});

const decodeRequestOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  allowCredentials: (o.allowCredentials || []).map((c) => ({
    ...c,
    id: b64urlToBuf(c.id),
  })),
});

const encodeAttestation = (cred) => ({
  id: cred.id,
  rawId: bufToB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: bufToB64url(cred.response.clientDataJSON),
    attestationObject: bufToB64url(cred.response.attestationObject),
  },
  clientExtensionResults: cred.getClientExtensionResults(),
});

const encodeAssertion = (cred) => ({
  id: cred.id,
  rawId: bufToB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: bufToB64url(cred.response.clientDataJSON),
    authenticatorData: bufToB64url(cred.response.authenticatorData),
    signature: bufToB64url(cred.response.signature),
    userHandle: cred.response.userHandle
      ? bufToB64url(cred.response.userHandle)
      : null,
  },
  clientExtensionResults: cred.getClientExtensionResults(),
});

/** Enrol this device. Throws with a readable message on failure or cancel. */
export async function registerDevice(label) {
  const { options } = await apiPost("/dev/webauthn/register/options", {});

  const credential = await navigator.credentials.create({
    publicKey: decodeCreationOptions(options),
  });
  if (!credential) throw new Error("Registration was cancelled.");

  await apiPost("/dev/webauthn/register", {
    credential: encodeAttestation(credential),
    device_label: label,
  });
}

/** Prove possession of a registered device. Throws on failure or cancel. */
export async function authenticateDevice() {
  const { options } = await apiPost("/dev/webauthn/login/options", {});

  const credential = await navigator.credentials.get({
    publicKey: decodeRequestOptions(options),
  });
  if (!credential) throw new Error("Fingerprint was cancelled.");

  await apiPost("/dev/webauthn/login", {
    credential: encodeAssertion(credential),
  });
}

/** Devices registered for this origin. */
export async function listDevices() {
  const res = await apiGet("/dev/webauthn/devices");
  return res.data || [];
}

/** Remove a registered device (e.g. a lost laptop). */
export async function removeDevice(id) {
  await apiDelete(`/dev/webauthn/devices/${id}`);
}
