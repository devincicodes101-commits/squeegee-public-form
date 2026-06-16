# Squeegee Squad LA — Public Website Form (n8n Workflow)

n8n workflow for the public-facing estimate form on the Squeegee Squad LA website. Accepts customer-submitted form data + optional photos, optionally runs OpenAI Vision to auto-fill missing fields from the photos, applies the brief's pricing engine, and logs the lead to a Google Sheet.

---

## Workflow flow

```
Webhook (POST)
  → Normalize Form Inputs        (cleans + casts form data)
  → Extract Photos               (pulls image binaries, base64-encodes for Vision)
  → Has Photos?                  (branch)
      ├── YES → Prepare OpenAI Request → OpenAI Vision (gpt-4o) → Parse AI & Enrich Form
      └── NO  → No Photos Pass-Through (empty AI metadata)
  → Merge Photo Branches
  → 7× Google Sheets reads in parallel
      (Pricing Rule, Multipliers, Territory, Customer Copy,
       Bundle Logic, Scoring Rules, Smart Defaults)
  → Merge Sheets Data
  → Pricing Engine               (core formula: brief §4)
  → Log to Dashboard             (appends to Dashboard Template tab)
  → Respond JSON                 (returns estimate to the form)
```

---

## What the OpenAI Vision step does

When the customer uploads photos, the workflow sends them to `gpt-4o` with a strict JSON schema prompt. The AI returns:

| Field | What it estimates |
|---|---|
| `quantity_estimate` | Number of panes / sq ft / panels visible |
| `condition` | Standard / Moderate / Heavy / Severe |
| `access` | Easy / Moderate / Difficult / Height-Lift-Rope |
| `stories` | Building height |
| `risk_factors` | Visible safety/complexity flags |
| `confidence` | AI's own confidence in its read |
| `reasoning` | One-sentence summary |

**The rule:** AI only fills **blank** form fields. It never overrides what the customer typed. AI-filled fields are flagged with `ai_filled_*` metadata so the team can audit.

---

## Setup

### 1. Import into n8n
- n8n → Workflows → Import from File → upload `public-website-form-vision.workflow.json`

### 2. Replace placeholder credentials
The exported JSON has `"REPLACE_ME"` for all credential IDs (OpenAI + Google Sheets). After import, click each red-bordered node and re-attach your own credentials:
- **OpenAI Vision** — OpenAI API key
- **All 8 Google Sheets nodes** — Google Sheets OAuth2

### 3. Webhook URL
After activating the workflow, n8n shows the production webhook URL. Wire it up to your public form's `action` attribute (multipart/form-data POST).

Test URL pattern: `https://YOUR-N8N-HOST/webhook/0dc30588-9b5e-401e-b2c2-062d8c14831a`

### 4. Form field labels
The form must submit fields with these exact labels (the workflow's Normalize step depends on them):

- `Full Name`, `Email`, `Phone Number`
- `ZIP Code`, `Property Address (optional)`
- `Property Type`, `Service`
- `Quantity (panes / sq ft / linear ft / panels / loads — depends on service)`
- `Condition`, `Access`, `Urgency`
- `LA Logistics`, `Recurring`
- `Project Notes (optional)`
- Photos can be any file input (workflow scans all `image/*` binaries)

---

## Required Google Sheet tabs

The workflow reads from sheet ID `1DfbkAvbWMvQJFUr4_i5TlGuGZImbamxF4GNSh5VNa-Q`. That sheet must have these tabs:

| Tab | Purpose |
|---|---|
| Developer Pricing Rules | Service rates + minimums + range widths |
| Multipliers | Condition / Property / Access / Urgency / Logistics / Recurring multipliers |
| Territory Modifiers | LA ZIP-based modifiers |
| Customer Copy | Templated customer-facing estimate copy (use key `public`) |
| Bundle Logic | Good/Better/Best upsell options |
| Scoring Rules | Priority thresholds + strategic account flags |
| Smart Defaults | Property-type fallback values for missing fields |
| Dashboard Template | The lead log (workflow appends here) |

---

## ⚠️ Sheet ID mismatch with the deployed dashboard

The deployed Next.js dashboard reads from sheet ID **`1vdjvGmvi4gNvs1cx30DQiHzOkfWtn1FfBXXtMRsg8sw`**.

This workflow writes to sheet ID **`1DfbkAvbWMvQJFUr4_i5TlGuGZImbamxF4GNSh5VNa-Q`** — a **different sheet**.

Leads created by this workflow will **not** show in the deployed dashboard unless you:
- **Option A:** Change the workflow's sheet IDs to match the dashboard's sheet, or
- **Option B:** Update the dashboard's `GOOGLE_SHEET_ID` env var in Vercel to point to this sheet

Pick one before going live.

---

## Output shape

The workflow returns this JSON to the form on success:

```json
{
  "ok": true,
  "leadId": "SS-1717286400000",
  "estimate": "Hi Customer, your preliminary estimate range is $450 - $900...",
  "range": { "low": 450, "high": 900 },
  "confidence": "Medium",
  "ai_used": true,
  "ai_reasoning": "Single-story residential window with light water spotting visible."
}
```

The frontend can show `estimate` as customer-facing copy and surface `confidence` / `ai_used` if useful.

---

## Implementation notes

- **CORS:** the `Respond JSON` node sets `Access-Control-Allow-Origin: *`. Tighten to the production domain before launch.
- **Webhook ID:** the path is hard-coded to `0dc30588-9b5e-401e-b2c2-062d8c14831a`. n8n regenerates this on import — update the form's action URL accordingly.
- **Image detail:** Vision calls use `detail: 'low'` to keep token cost manageable. Bump to `'high'` if accuracy matters more than cost.
- **AI rule:** the Pricing Engine reads `form.ai_filled_*` flags so audit columns reflect whether the AI made the call vs the customer.