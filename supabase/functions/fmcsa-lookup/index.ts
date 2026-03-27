import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dotNumber } = await req.json();
    if (!dotNumber) {
      return new Response(
        JSON.stringify({ error: "DOT number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FMCSA_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "FMCSA API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanDot = dotNumber.toString().replace(/\D/g, "");
    console.log("Looking up DOT number:", cleanDot);

    // Fetch carrier details and cargo carried in parallel
    const [carrierRes, cargoRes] = await Promise.all([
      fetch(`https://mobile.fmcsa.dot.gov/qc/services/carriers/${cleanDot}?webKey=${apiKey}`),
      fetch(`https://mobile.fmcsa.dot.gov/qc/services/carriers/${cleanDot}/cargo-carried?webKey=${apiKey}`),
    ]);

    if (!carrierRes.ok) {
      const text = await carrierRes.text();
      console.error("FMCSA API error:", carrierRes.status, text);
      return new Response(
        JSON.stringify({ error: `FMCSA API returned ${carrierRes.status}` }),
        { status: carrierRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await carrierRes.json();
    const carrier = data?.content?.carrier;

    if (!carrier) {
      return new Response(
        JSON.stringify({ error: "No carrier found for this DOT number" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse cargo carried
    let cargoTypes: string[] = [];
    try {
      if (cargoRes.ok) {
        const cargoData = await cargoRes.json();
        const cargoList = cargoData?.content?.cargoCarried;
        if (Array.isArray(cargoList)) {
          cargoTypes = cargoList
            .map((c: any) => c.cargoClassDesc || c.cargoCarriedDesc || "")
            .filter(Boolean);
        }
      }
    } catch (e) {
      console.warn("Could not parse cargo carried:", e);
    }

    console.log("Cargo types from FMCSA:", cargoTypes);

    // Map FMCSA response to our form fields
    const mapped = {
      company_name: carrier.legalName || null,
      dba_name: carrier.dbaName || null,
      dot_number: carrier.dotNumber?.toString() || cleanDot,
      mc_number: carrier.mcNumber?.toString() || null,
      mailing_address: carrier.phyStreet || null,
      mailing_city: carrier.phyCity || null,
      mailing_state: carrier.phyState || null,
      mailing_zip: carrier.phyZipcode || null,
      contact_phone: carrier.telephone || null,
      contact_email: carrier.emailAddress || null,
      total_trucks: carrier.totalPowerUnits != null ? parseInt(carrier.totalPowerUnits) : null,
      total_drivers: carrier.totalDrivers != null ? parseInt(carrier.totalDrivers) : null,
      carrier_operation: carrier.carrierOperation || null,
      allow_to_operate: carrier.allowToOperate || null,
      out_of_service: carrier.outOfService || null,
      cargo_carried: cargoTypes,
    };

    console.log("Mapped carrier data for DOT", cleanDot);

    return new Response(JSON.stringify({ success: true, data: mapped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in FMCSA lookup:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
