import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { filePath } = await req.json();
    if (!filePath) throw new Error("filePath required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Download the PDF
    const { data: fileData, error: dlError } = await supabase.storage
      .from("appetite-guides")
      .download(filePath);
    if (dlError) throw dlError;

    // Determine MIME type from file extension
    const ext = filePath.split(".").pop()?.toLowerCase();
    const mimeType = ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : ext === "doc"
      ? "application/msword"
      : "application/pdf";

    // Convert to base64 for AI
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an insurance underwriting expert. Extract carrier appetite guide criteria from the provided PDF document. Return structured data using the extract_appetite tool.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all appetite/underwriting criteria from this carrier appetite guide PDF.",
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_appetite",
              description: "Extract structured appetite guide criteria from a carrier document",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Carrier name" },
                  preferred_cargo_types: { type: "array", items: { type: "string" }, description: "Cargo types the carrier prefers (e.g. General Freight, Refrigerated)" },
                  excluded_cargo_types: { type: "array", items: { type: "string" }, description: "Cargo types the carrier won't write" },
                  preferred_states: { type: "array", items: { type: "string" }, description: "State abbreviations where carrier operates" },
                  excluded_states: { type: "array", items: { type: "string" }, description: "States the carrier avoids" },
                  min_fleet_size: { type: "integer", description: "Minimum fleet size" },
                  max_fleet_size: { type: "integer", description: "Maximum fleet size" },
                  max_claims_tolerance: { type: "integer", description: "Maximum number of claims in last 3 years" },
                  min_years_in_business: { type: "integer", description: "Minimum years in business required" },
                  min_authority_age_months: { type: "integer", description: "Minimum authority age in months" },
                  min_annual_revenue: { type: "number", description: "Minimum annual revenue" },
                  max_annual_revenue: { type: "number", description: "Maximum annual revenue" },
                  accepted_business_types: { type: "array", items: { type: "string" }, description: "Accepted business entity types" },
                  max_radius_pct_over500: { type: "integer", description: "Maximum percentage of operations over 500 miles" },
                  requires_authority: { type: "boolean", description: "Whether active carrier authority is required" },
                  notes: { type: "string", description: "Additional appetite details, special programs, or notable exclusions" },
                },
                required: ["name"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_appetite" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No extraction result from AI");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted, filePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-appetite-guide error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
