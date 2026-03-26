

# AI-Powered Market Guidance

## Overview
Replace the current rule-based scoring engine with an AI-powered evaluation that sends the **full account data** (application, drivers, power units, trailers, loss history, commodities) and each carrier's **complete appetite_guide JSON + notes** to Lovable AI. The AI produces scores, match tiers, and written reasoning for each carrier.

## Architecture

```text
┌─────────────┐     POST account + carriers     ┌──────────────────────┐
│  MarketGuid │ ──────────────────────────────▶  │  Edge Function       │
│  ance.tsx   │                                  │  ai-market-guidance  │
│  (frontend) │  ◀──────────────────────────────  │                      │
│             │     JSON: scored carrier list     │  Calls Lovable AI    │
└─────────────┘                                  │  (Gemini Flash)      │
                                                 └──────────────────────┘
```

## Steps

### 1. Create edge function `supabase/functions/ai-market-guidance/index.ts`
- Accepts `{ account, carriers, drivers, powerUnits, trailers, lossHistory }` in the POST body
- Builds a system prompt explaining the role: "You are an insurance underwriting analyst evaluating carrier appetite fit"
- For each carrier, includes its `appetite_guide` JSON, `notes`, and structured criteria fields
- Uses **tool calling** (structured output) to extract per-carrier results:
  - `score` (0-100)
  - `tier` ("strong" | "partial" | "poor")  
  - `summary` (2-3 sentence explanation)
  - `strengths` (string array)
  - `concerns` (string array)
- Model: `google/gemini-3-flash-preview` (fast, capable)
- Handles 429/402 errors gracefully

### 2. Update `AccountDetail.tsx` — fetch additional data
- Query `drivers`, `power_units`, `trailers`, `loss_history` for the account
- Pass them to `MarketGuidance` as new props

### 3. Rewrite `MarketGuidance.tsx`
- Remove the local `evaluateCarrier` function and all rule-based scoring logic
- On "Check Markets" click, call the edge function via `supabase.functions.invoke('ai-market-guidance', { body: ... })`
- Show a loading spinner during AI evaluation
- Display results with:
  - Score + tier badge (same visual style as current)
  - **AI Summary** paragraph explaining the match reasoning
  - **Strengths** list (green bullets)
  - **Concerns** list (red bullets)
- Keep "Generate Quote" button and re-check capability
- Handle rate limit / payment errors with toast messages

### 4. Data sent to AI per evaluation
- **Account**: company info, business type, years in business, authority date, fleet size, annual revenue, cargo types, operating states, commodity info, radius operations, coverage selections, claims count
- **Drivers**: count, experience, violations, accidents
- **Power Units**: count, types, GVW classes, years
- **Trailers**: count, types
- **Loss History**: policy terms, coverage types, cancellation info
- **Per Carrier**: name, appetite_guide JSON, notes, all preference/exclusion fields

## Technical Details
- LOVABLE_API_KEY is already configured
- Uses structured output via tool calling to guarantee parseable JSON responses
- Single AI call evaluates all carriers at once (batch in one prompt) to reduce latency
- No database changes needed

