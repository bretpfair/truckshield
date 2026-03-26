import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account, carriers, drivers, powerUnits, trailers, lossHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build account summary
    const accountSummary = {
      company_name: account.company_name,
      dba_name: account.dba_name,
      business_type: account.business_type,
      years_in_business: account.years_in_business,
      date_of_authority: account.date_of_authority,
      dot_number: account.dot_number,
      mc_number: account.mc_number,
      carrier_authority_number: account.carrier_authority_number,
      fleet_size: account.fleet_size,
      total_trucks: account.total_trucks,
      total_drivers: account.total_drivers,
      annual_revenue: account.annual_revenue,
      total_annual_revenue: account.total_annual_revenue,
      projected_gross_receipts: account.projected_gross_receipts,
      cargo_types: account.cargo_types,
      operating_states: account.operating_states,
      commodity_info: account.commodity_info,
      radius_operations: account.radius_operations,
      coverage_selections: account.coverage_selections,
      number_of_claims: account.number_of_claims,
      loss_history_summary: account.loss_history_summary,
      business_categories: account.business_categories,
      contractor_types: account.contractor_types,
      general_questions: account.general_questions,
      mailing_state: account.mailing_state,
      county: account.county,
      description_of_operations: account.operation_info?.notes || null,
    };

    // Build driver summary
    const driverSummary = (drivers || []).map((d: any) => ({
      name: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
      experience_years: d.experience_years,
      license_type: d.license_type,
      num_violations: d.num_violations,
      num_accidents: d.num_accidents,
      violations: d.violations,
      accidents: d.accidents,
      lapse_suspension: d.lapse_suspension,
    }));

    // Build power unit summary
    const powerUnitSummary = (powerUnits || []).map((p: any) => ({
      year: p.year, make: p.make, model: p.model,
      truck_type: p.truck_type, gvw_class: p.gvw_class,
      ownership_type: p.ownership_type,
    }));

    // Build trailer summary
    const trailerSummary = (trailers || []).map((t: any) => ({
      year: t.year, make: t.make, model: t.model,
      trailer_type: t.trailer_type, ownership_type: t.ownership_type,
      is_nonowned: t.is_nonowned,
    }));

    // Build loss history summary
    const lossHistorySummary = (lossHistory || []).map((l: any) => ({
      coverage_type: l.coverage_type,
      no_prior_coverage: l.no_prior_coverage,
      policy_terms: l.policy_terms,
      cancelled_nonrenewed: l.cancelled_nonrenewed,
      cancellation_reason: l.cancellation_reason,
    }));

    // Build carrier details for the prompt
    const carrierDetails = carriers.map((c: any) => ({
      id: c.id,
      name: c.name,
      appetite_guide: c.appetite_guide,
      notes: c.notes,
      am_best_rating: c.am_best_rating,
      preferred_cargo_types: c.preferred_cargo_types,
      excluded_cargo_types: c.excluded_cargo_types,
      preferred_states: c.preferred_states,
      excluded_states: c.excluded_states,
      accepted_business_types: c.accepted_business_types,
      min_fleet_size: c.min_fleet_size,
      max_fleet_size: c.max_fleet_size,
      min_years_in_business: c.min_years_in_business,
      min_authority_age_months: c.min_authority_age_months,
      min_annual_revenue: c.min_annual_revenue,
      max_annual_revenue: c.max_annual_revenue,
      max_claims_tolerance: c.max_claims_tolerance,
      max_radius_pct_over500: c.max_radius_pct_over500,
      requires_authority: c.requires_authority,
    }));

    const systemPrompt = `You are an expert commercial trucking insurance underwriting analyst. Your job is to evaluate how well a trucking company (the "account") fits each carrier's appetite and underwriting guidelines.

For each carrier, analyze the account data against the carrier's appetite guide, structured criteria, and notes. Consider:
- Hard disqualifiers (excluded cargo, excluded states, authority requirements)
- Numeric thresholds (fleet size, revenue, years in business, authority age, claims)
- Preferred vs actual cargo types and operating states
- Driver quality (violations, accidents, experience)
- Equipment profile (types, ages, GVW classes)
- Loss history (prior coverage, cancellations, claims patterns)
- Any nuanced guidance in the carrier's appetite_guide JSON or notes field

Be realistic and conservative. If data is missing, note it as a concern — don't assume favorable conditions.
Score from 0-100 where 100 means perfect fit across all criteria.`;

    const userPrompt = `Evaluate this trucking account against each carrier below.

## Account Data
${JSON.stringify(accountSummary, null, 2)}

## Drivers (${driverSummary.length} total)
${JSON.stringify(driverSummary, null, 2)}

## Power Units (${powerUnitSummary.length} total)
${JSON.stringify(powerUnitSummary, null, 2)}

## Trailers (${trailerSummary.length} total)
${JSON.stringify(trailerSummary, null, 2)}

## Loss History
${JSON.stringify(lossHistorySummary, null, 2)}

## Carriers to Evaluate
${JSON.stringify(carrierDetails, null, 2)}

For each carrier, provide a score (0-100), tier, summary, strengths, and concerns.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_carrier_evaluations",
              description: "Submit the evaluation results for all carriers",
              parameters: {
                type: "object",
                properties: {
                  evaluations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        carrier_id: { type: "string", description: "The carrier's UUID" },
                        score: { type: "number", description: "Match score 0-100" },
                        tier: { type: "string", enum: ["strong", "partial", "poor"] },
                        summary: { type: "string", description: "2-3 sentence explanation of the match quality" },
                        strengths: { type: "array", items: { type: "string" }, description: "List of positive factors" },
                        concerns: { type: "array", items: { type: "string" }, description: "List of concerns or disqualifiers" },
                      },
                      required: ["carrier_id", "score", "tier", "summary", "strengths", "concerns"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["evaluations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_carrier_evaluations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI evaluation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "AI did not return structured results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ evaluations: parsed.evaluations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-market-guidance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
