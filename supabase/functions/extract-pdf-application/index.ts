import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_application",
    description:
      "Extract structured insurance application data from a trucking PDF application.",
    parameters: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        dba_name: { type: "string" },
        dot_number: { type: "string" },
        mc_number: { type: "string" },
        ein_tax_id: { type: "string" },
        business_type: { type: "string" },
        business_owner_name: { type: "string" },
        business_owner_dob: {
          type: "string",
          description: "Format: YYYY-MM-DD",
        },
        years_in_business: { type: "number" },
        date_of_authority: {
          type: "string",
          description: "Format: YYYY-MM-DD",
        },
        mailing_address: { type: "string" },
        mailing_city: { type: "string" },
        mailing_state: { type: "string" },
        mailing_zip: { type: "string" },
        county: { type: "string" },
        annual_revenue: { type: "number" },
        fleet_size: { type: "number" },
        total_trucks: { type: "number" },
        total_drivers: { type: "number" },
        requested_effective_date: {
          type: "string",
          description: "Format: YYYY-MM-DD",
        },
        current_coverage_expiry: {
          type: "string",
          description: "Format: YYYY-MM-DD",
        },
        operating_states: {
          type: "array",
          items: { type: "string" },
          description: "2-letter state codes",
        },
        cargo_types: {
          type: "array",
          items: { type: "string" },
        },
        notes: { type: "string", description: "Any notes or description of operations" },
        coverage_selections: {
          type: "object",
          description: "Key-value pairs of coverage type to limit/deductible info",
          properties: {
            auto_liability: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            cargo: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            general_liability: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            physical_damage: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            non_trucking: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            um_uim: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            medical_pip: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            hired_auto: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
            trailer_interchange: { type: "object", properties: { limit: { type: "string" }, deductible: { type: "string" } } },
          },
        },
        drivers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              first_name: { type: "string" },
              last_name: { type: "string" },
              date_of_birth: { type: "string", description: "Format: YYYY-MM-DD" },
              license_number: { type: "string" },
              license_state: { type: "string", description: "2-letter state code" },
              license_type: { type: "string" },
              date_hired_year: { type: "number" },
              date_hired_month: { type: "number" },
              original_issue_year: { type: "number" },
              original_issue_month: { type: "number" },
              num_violations: { type: "number" },
              num_accidents: { type: "number" },
            },
          },
        },
        vehicles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              is_trailer: { type: "boolean" },
              year: { type: "string" },
              make: { type: "string" },
              model: { type: "string" },
              vin: { type: "string" },
              vehicle_type: { type: "string" },
              gvw_class: { type: "string" },
              garage_zip: { type: "string" },
              physdam_amount: { type: "number", description: "Stated/insured value" },
              has_physdam: { type: "boolean" },
            },
          },
        },
        garage_locations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              address: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              zip: { type: "string" },
              county: { type: "string" },
              is_principal: { type: "boolean" },
            },
          },
        },
      },
      required: ["company_name"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PDF from form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Call AI with the PDF as an inline document
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
              content: `You are an expert at extracting structured data from commercial trucking insurance applications. 
Extract ALL available information from the PDF. 
For dates, use YYYY-MM-DD format. 
For state codes, use 2-letter abbreviations.
Split full names into first_name and last_name.
Determine if a vehicle is a trailer based on its type description (e.g. "Trailer", "Step Deck", "Flatbed Trailer" = trailer; "Truck Tractor", "Straight Truck" = not trailer).
Extract coverage limits and deductibles from the coverage section.
Include any notes or description of operations in the notes field.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: file.name,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all insurance application data from this PDF using the extract_application tool.",
                },
              ],
            },
          ],
          tools: [EXTRACTION_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "extract_application" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured extraction");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
