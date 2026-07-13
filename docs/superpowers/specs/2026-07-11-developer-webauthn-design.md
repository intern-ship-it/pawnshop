# Fingerprint (WebAuthn) as a Second Factor on the Developer Page — Design

**Date:** 2026-07-11
**Status:** Approved
**Builds on:** `2026-07-11-developer-image-backfill-design.md`

## Problem

The hidden developer page (`/dev/missing-images`) is gated by a 6-digit passkey — a
knowledge factor. A 6-digit secret is a million combinations, and it can be shoulder-surfed
or guessed. We want to add a possession factor (fingerprint / platform authenticator) so
that entry requires *both*, on devices where the developer has registered one.

It must work **in production on cPanel**, not just on localhost.

## Architecture

### The core fact everything follows from

**The fingerprint never travels. Only a signature does.**

No biometric is ever sent to, stored by, or seen by the server. The device's secure hardware
holds a **private key** and releases a signature only when the finger unlocks it. The server
holds the matching **public key** and verifies the maths. A full database dump yields public
keys — useless to an attacker. This is categorically different from a password or passkey,
which do travel and can be stolen in transit or at rest.

### Three trust zones

**Zone 1 — the authenticator (device secure enclave).** Holds the private key. Not
exfiltratable by the browser, by JavaScript, or by us. The only thing that can produce a
valid signature. Trust rests on *physical possession*.

**Zone 2 — the browser (untrusted messenger).** Carries a challenge in, a signature out.
Assumed hostile: it could be a compromised page, a replay, a forged origin. **It is given
nothing worth stealing.** Consequently *nothing in the frontend is a security boundary* —
the "is this device registered?" flag, the hidden route, the fingerprint prompt are all UX.
Any of them can be lied about with no security consequence.

**Zone 3 — the server (sole arbiter).** Holds the public key and the challenge it issued.
The only place any decision is made. Every unlock and every upload is re-decided here from
scratch.

The existing passkey is a **knowledge** factor in Zone 3 (`Hash::check` on `users.passkey`).
WebAuthn adds a **possession** factor in Zone 1. Together they are 2FA precisely because
they fail to *different* attackers: shoulder-surfing the 6 digits yields no device; stealing
the laptop yields no digits.

### Where the two factors attach — the load-bearing decision

**The fingerprint gates the *door*. The passkey gates every *write*.**

Entry requires passkey + signature. But each photo upload **continues to re-verify the
passkey server-side, exactly as it does today**. We deliberately do NOT mint a session token
that says "this person is trusted now" — that token would become the thing worth stealing,
and per-request verification would quietly degrade into per-session verification.

The property preserved: **every mutation of a live pledge record is independently authorized
at the moment it happens.** WebAuthn is *added* to the front door; nothing behind it is
loosened.

### RP-ID is architectural, not configuration

A WebAuthn credential is **cryptographically bound to an origin** — that binding is what
makes it phishing-proof. A fake `dsaraassetventures.evil.com` cannot elicit a signature
valid for `dsaraassetventures.com`; the browser refuses to try. The origin is *part of the
key's identity*, not a setting.

The same code runs at three origins:

| Environment | Origin | RP-ID |
|---|---|---|
| Dev | `http://localhost:3000` | `localhost` |
| Staging | `https://devtesting.dsaraassetventures.com` | `devtesting.dsaraassetventures.com` |
| Production | `https://dsaraassetventures.com` | `dsaraassetventures.com` |

So the RP-ID **must be derived from the live request host at runtime**. Hard-coding it is
exactly the bug that works on localhost and fails silently in production. A credential
registered on staging will not work on production — that is WebAuthn behaving correctly, and
it means the developer registers once per environment.

`localhost` is exempt from the secure-context rule, so dev works over plain `http`. Both real
hosts are already `https` (confirmed in `frontend/.env.production` / `.env.staging`), so
there is no certificate work to do.

## Security model and its honest limit

Passkey **and** fingerprint are both required — but **only on devices where one is
registered**. On an unregistered device (new laptop, phone, cleared browser data) the passkey
alone still works, as today.

What this buys: an attacker with the passkey who is sitting at the registered machine still
cannot get in. A phishing site cannot elicit a valid signature.

What it does **not** buy: a stolen passkey is not rendered inert everywhere — the attacker
could open a fresh, unregistered browser and use it.

This is the price of never being able to lock yourself out, and it was chosen deliberately.
The strict alternative ("any registered credential ⇒ fingerprint always required") closes that
hole but locks the developer out permanently on device loss, recoverable only by SSH-ing into
cPanel. For a maintenance tool used a handful of times, the non-lockout trade is correct.

## Components

### Backend

`composer require web-auth/webauthn-lib` — placed in `require` (NOT `require-dev`), because
`deploy.sh:51` runs `composer install --no-dev` on the server.

**Not hand-rolled.** Correct verification requires checking the signature *and* the challenge
*and* the origin *and* the RP-ID hash *and* the user-presence flag *and* the signature
counter. Missing any one makes the factor decorative. This is not a place to be clever.

New table `webauthn_credentials`: `user_id`, `credential_id`, `public_key`, `sign_count`,
`device_label`, `last_used_at`. **Multiple devices per account** are supported (laptop +
phone), each labelled, so the developer need not re-register when switching machines.

Four endpoints, all behind the existing `developer.only` middleware so they 404 for everyone
else exactly like the rest of the tool:

| Route | Purpose |
|---|---|
| `POST /api/dev/webauthn/register/options` | Challenge to enrol this device |
| `POST /api/dev/webauthn/register` | Store the new credential |
| `POST /api/dev/webauthn/login/options` | Challenge to authenticate |
| `POST /api/dev/webauthn/login` | Verify the assertion |

Challenges are **single-use**, held server-side in the session, and expire. A replayed
challenge is rejected. The `sign_count` is checked and advanced on each use to detect cloned
authenticators.

### Frontend

Unlock becomes: enter passkey → if the server reports this account has a credential **and**
this browser supports WebAuthn, the fingerprint prompt appears → both must succeed.

**"Register this device" appears only after unlock**, so anyone who never gets in never
learns the mechanism exists. On an unregistered device the user sees the ordinary passkey
prompt and nothing else.

Two failure modes handled explicitly so they do not look like bugs:
- Browser without WebAuthn support → silently falls back to passkey-only.
- User cancels the fingerprint prompt → clear message, retryable; not a dead page.

## Verification

- Registration and authentication exercised end-to-end on localhost.
- RP-ID derivation unit-tested against all three hosts, proving production cannot silently
  break.
- A tampered or replayed assertion is rejected.
- The passkey-only path on an unregistered device still works.
- Uploads still re-verify the passkey per request (the property that must not regress).

## Deployment notes (cPanel)

`deploy.sh` already does the necessary work: `composer install --no-dev` (line 51) installs
the new dependency, and `artisan migrate --force` (line 125) applies the new table. PHP 8.2
on the server matches dev. The script auto-detects the branch, so `dev` → staging and `main`
→ production, each at its own origin — which is precisely why the RP-ID must be
runtime-derived.

## Out of scope

- `/dev/verify` has **no rate limiting**. A 6-digit passkey is ~1M combinations and can
  currently be guessed without limit by an authenticated developer-role session. This is a
  real weakness in the existing gate, independent of WebAuthn, and should be fixed separately
  with Laravel's `throttle` middleware.
- Extending WebAuthn to the cashier passkey (`pledges.edit`, `customers.blacklist`), where
  staff type a 6-digit code many times a day on shared machines. That is the higher-value
  target but needs its own design pass.
