

## Plan: Hardcode retailAgent to 360 Risk Partners / Bret Fair

### Change
Update `supabase/functions/coverwhale-api/index.ts` — replace the dynamic `retailAgent` block with hardcoded values:

```typescript
retailAgent: {
  FirstName: "Bret",
  LastName: "Fair",
  Phone: "888-885-4144",
  Email: "integrations@360riskpartners.com",
  AgencyName: "360 Risk Partners Insurance Solutions, Inc.",
  Street: "1101 Fulton Ave Ste 204",
  City: "Sacramento",
  State: "CA",
  Zip: "95825",
},
```

Then redeploy the `coverwhale-api` edge function.

### Files modified
- `supabase/functions/coverwhale-api/index.ts`

