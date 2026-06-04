# AiSensy WhatsApp — Setup & Mapping Reference

How to configure AiSensy WhatsApp sending. The **campaign mappings live in the
database (per-branch), not in code**, so they must be entered in the app's
Settings UI on each environment (local, live) after the matching campaigns exist
in that environment's AiSensy account.

---

## 1. Provider configuration (one-time, per branch)

**Settings → WhatsApp → Configuration:**

| Field | Value |
|---|---|
| Enable WhatsApp | ON |
| Provider | **AiSensy** |
| API Key | the AiSensy **API Campaign Key** (Developer → API Campaign Key → copy the `eyJ…` JWT) |
| Default Country Code | `+60` |

Then **Save Settings**. (Instance ID is hidden/unused for AiSensy.)

> Only one provider is active at a time. Selecting AiSensy + Save makes it the
> sole sender; UltraMsg goes dormant.

---

## 2. Per message type: template → campaign → mapping

For each flow you must:
1. Create a WhatsApp **template** in AiSensy (Manage → Templates) and get it
   **Meta-approved** (Category: **Utility**, Type: **Text**, Interactive Actions: **None**).
2. Create a **Live API Campaign** (Campaigns → Create → API Campaign) on that template.
3. Map it in the app: **Settings → WhatsApp → Message Templates → Edit** the row →
   fill **AiSensy Campaign Name** + **Parameters** → Save.

The Parameters list maps in order to the template's `{{1}}`, `{{2}}`, … placeholders.
The **param count must equal the number of `{{n}}`** in the approved template.

---

### New Pledge

- **App template key:** `pledge_created`
- **Campaign name:** `pledge_created_v1`
- **Parameters:** `customer_name, pledge_no, loan_amount, due_date`
- **Placeholder order:** `{{1}}`=customer_name, `{{2}}`=pledge_no, `{{3}}`=loan_amount, `{{4}}`=due_date

Template body (reference):
```
Salam {{1}}, terima kasih kerana memilih kami.

No. Pajak: {{2}}
Jumlah Pinjaman: RM{{3}}
Tarikh Tamat: {{4}}

Sila simpan mesej ini untuk rujukan.
```

---

### Renewal

- **App template key:** `renewal_completed`
- **Campaign name:** `renewal_completed_v1`
- **Parameters:** `customer_name, pledge_no, total_paid, new_due_date`
- **Placeholder order:** `{{1}}`=customer_name, `{{2}}`=pledge_no, `{{3}}`=total_paid, `{{4}}`=new_due_date

Template body (reference):
```
Salam {{1}}, pembaharuan pajak gadai anda berjaya.

No. Pajak: {{2}}
Jumlah Dibayar: RM{{3}}
Tarikh Tamat Baru: {{4}}

Terima kasih.
```

---

### Redemption

- **App template key:** `redemption_completed`
- **Campaign name:** `redemption_completed_v1`
- **Parameters:** `customer_name, pledge_no, total_paid`  *(3 params — no due date)*
- **Placeholder order:** `{{1}}`=customer_name, `{{2}}`=pledge_no, `{{3}}`=total_paid

Template body (reference):
```
Salam {{1}}, pajak gadai anda telah ditebus.

No. Pajak: {{2}}
Jumlah Dibayar: RM{{3}}

Terima kasih kerana berurusan dengan kami.
```

---

## 3. Testing

- **Settings → WhatsApp → Test tab** sends the `pledge_created` template — good for a
  first connectivity check.
- Real sends happen from the pledge / renewal / redemption actions in the app.
- The **History tab** logs every send and shows AiSensy's exact error on failure.

Common errors:
- `No AiSensy campaign configured for this message type` → the Campaign Name field
  for that template is empty in the app. Map it.
- Param-count mismatch → the Parameters count ≠ the approved template's `{{n}}` count.
- Auth error (401/403) → wrong/expired API key.

---

## 4. Live server notes (cPanel)

- `deploy.sh` pulls `dev`, builds, and runs `migrate --force`. The code (drivers,
  service, mapping columns, routes) deploys automatically.
- **Mappings do NOT deploy** — they're DB rows per branch. Re-enter the campaign
  names + parameters (section 2) in the live app after creating the live AiSensy
  campaigns.
- The live `.env` must have `APP_URL=https://<public-domain>` (deploy.sh preserves
  the server's own `.env`). This matters for the optional PDF attachment, which
  needs a publicly reachable signed URL.

---

## 5. On hold / not wired (as of this writing)

- **Reminders** (7/3/1-day, overdue) — not wired to AiSensy.
- **Owner dashboard** — not wired to AiSensy.
- **PDF receipt attachment** — built behind `attach_pdf_receipt` (default OFF) and the
  UI toggle is currently hidden. AiSensy attaches a PDF via a public signed URL, so it
  only works on the live public domain, not localhost. UltraMsg attaches via base64
  (works anywhere). Currently wired for the pledge flow only.
