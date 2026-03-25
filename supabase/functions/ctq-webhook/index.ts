import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();

    // Basic validation — require company_name at minimum
    if (!payload.company_name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: company_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check for existing account by DOT number
    let accountId: string | null = null;
    let isUpdate = false;

    if (payload.dot_number) {
      const { data: existing } = await supabase
        .from("accounts")
        .select("id")
        .eq("dot_number", String(payload.dot_number))
        .maybeSingle();

      if (existing) {
        accountId = existing.id;
        isUpdate = true;
      }
    }

    // Map CTQ fields to accounts table
    const accountData: Record<string, unknown> = {
      company_name: payload.company_name,
      dba_name: payload.dba_name || null,
      dot_number: payload.dot_number ? String(payload.dot_number) : null,
      mc_number: payload.mc_number ? String(payload.mc_number) : null,
      ein_tax_id: payload.ein_tax_id || null,
      business_type: payload.business_type || null,
      business_owner_name: payload.business_owner_name || null,
      business_owner_dob: payload.business_owner_dob || null,
      years_in_business: payload.years_in_business ?? null,
      date_of_authority: payload.date_of_authority || null,
      carrier_authority_number: payload.carrier_authority_number || null,
      carrier_authority_prefix: payload.carrier_authority_prefix || null,
      mailing_address: payload.mailing_address || null,
      mailing_city: payload.mailing_city || null,
      mailing_state: payload.mailing_state || null,
      mailing_zip: payload.mailing_zip || null,
      county: payload.county || null,
      fleet_size: payload.fleet_size ?? null,
      total_trucks: payload.total_trucks ?? null,
      total_drivers: payload.total_drivers ?? null,
      total_owned_trailers: payload.total_owned_trailers ?? null,
      total_nonowned_trailers: payload.total_nonowned_trailers ?? null,
      total_garage_locations: payload.total_garage_locations ?? null,
      annual_revenue: payload.annual_revenue ?? null,
      total_annual_revenue: payload.total_annual_revenue ?? null,
      projected_gross_receipts: payload.projected_gross_receipts ?? null,
      total_subhaul_revenue: payload.total_subhaul_revenue ?? null,
      number_of_claims: payload.number_of_claims ?? null,
      requested_effective_date: payload.requested_effective_date || null,
      current_coverage_expiry: payload.current_coverage_expiry || null,
      operating_states: payload.operating_states || null,
      business_categories: payload.business_categories || null,
      cargo_types: payload.cargo_types || null,
      contractor_types: payload.contractor_types || null,
      loss_history_summary: payload.loss_history_summary || null,
      notes: payload.notes || null,
    };

    // JSON fields
    if (payload.coverage_selections) {
      accountData.coverage_selections = payload.coverage_selections;
    }
    if (payload.radius_operations) {
      accountData.radius_operations = payload.radius_operations;
    }
    if (payload.commodity_info) {
      accountData.commodity_info = payload.commodity_info;
    }
    if (payload.general_questions) {
      accountData.general_questions = payload.general_questions;
    }

    if (isUpdate && accountId) {
      // Update existing account
      const { error } = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", accountId);
      if (error) throw new Error(`Account update failed: ${error.message}`);
    } else {
      // Create new account with 'lead' status
      accountData.status = "lead";
      const { data, error } = await supabase
        .from("accounts")
        .insert(accountData)
        .select("id")
        .single();
      if (error) throw new Error(`Account insert failed: ${error.message}`);
      accountId = data.id;
    }

    // Insert drivers
    if (Array.isArray(payload.drivers) && payload.drivers.length > 0) {
      // Clear existing drivers on update
      if (isUpdate) {
        await supabase.from("drivers").delete().eq("account_id", accountId!);
      }

      const driverRows = payload.drivers.map((d: Record<string, unknown>, i: number) => ({
        account_id: accountId,
        first_name: d.first_name || null,
        last_name: d.last_name || null,
        date_of_birth: d.date_of_birth || null,
        license_number: d.license_number || null,
        license_state: d.license_state || null,
        license_type: d.license_type || null,
        driver_type: d.driver_type || null,
        experience_years: d.experience_years ?? null,
        experience_months: d.experience_months ?? null,
        date_hired_year: d.date_hired_year ?? null,
        date_hired_month: d.date_hired_month ?? null,
        original_issue_year: d.original_issue_year ?? null,
        original_issue_month: d.original_issue_month ?? null,
        num_violations: d.num_violations ?? 0,
        violations: d.violations || [],
        num_accidents: d.num_accidents ?? 0,
        accidents: d.accidents || [],
        lapse_suspension: d.lapse_suspension || null,
        lapse_explanation: d.lapse_explanation || null,
        sort_order: i,
      }));

      const { error } = await supabase.from("drivers").insert(driverRows);
      if (error) throw new Error(`Drivers insert failed: ${error.message}`);
    }

    // Insert vehicles (power_units and trailers)
    if (Array.isArray(payload.vehicles) && payload.vehicles.length > 0) {
      if (isUpdate) {
        await Promise.all([
          supabase.from("power_units").delete().eq("account_id", accountId!),
          supabase.from("trailers").delete().eq("account_id", accountId!),
        ]);
      }

      const powerUnits: Record<string, unknown>[] = [];
      const trailers: Record<string, unknown>[] = [];

      payload.vehicles.forEach((v: Record<string, unknown>, i: number) => {
        if (v.is_trailer) {
          trailers.push({
            account_id: accountId,
            year: v.year ? String(v.year) : null,
            make: v.make || null,
            model: v.model || null,
            vin: v.vin || null,
            trailer_type: v.vehicle_type || v.trailer_type || null,
            garage_zip: v.garage_zip || null,
            ownership_type: v.ownership_type || "owned",
            has_physdam: v.has_physdam ?? false,
            physdam_amount: v.physdam_amount ?? null,
            is_nonowned: v.is_nonowned ?? false,
            lender_name: v.lender_name || null,
            lender_address: v.lender_address || null,
            lender_city: v.lender_city || null,
            lender_state: v.lender_state || null,
            lender_zip: v.lender_zip || null,
            sort_order: i,
          });
        } else {
          powerUnits.push({
            account_id: accountId,
            year: v.year ? String(v.year) : null,
            make: v.make || null,
            model: v.model || null,
            vin: v.vin || null,
            truck_type: v.vehicle_type || v.truck_type || null,
            gvw_class: v.gvw_class || null,
            garage_zip: v.garage_zip || null,
            titled_state: v.titled_state || null,
            ownership_type: v.ownership_type || "owned",
            has_physdam: v.has_physdam ?? false,
            physdam_amount: v.physdam_amount ?? null,
            has_cargo: v.has_cargo ?? false,
            is_service_vehicle: v.is_service_vehicle ?? false,
            roadside_assistance: v.roadside_assistance ?? false,
            lender_name: v.lender_name || null,
            lender_address: v.lender_address || null,
            lender_city: v.lender_city || null,
            lender_state: v.lender_state || null,
            lender_zip: v.lender_zip || null,
            sort_order: i,
          });
        }
      });

      if (powerUnits.length > 0) {
        const { error } = await supabase.from("power_units").insert(powerUnits);
        if (error) throw new Error(`Power units insert failed: ${error.message}`);
      }
      if (trailers.length > 0) {
        const { error } = await supabase.from("trailers").insert(trailers);
        if (error) throw new Error(`Trailers insert failed: ${error.message}`);
      }
    }

    // Insert loss history
    if (Array.isArray(payload.loss_history) && payload.loss_history.length > 0) {
      if (isUpdate) {
        await supabase.from("loss_history").delete().eq("account_id", accountId!);
      }

      const lossRows = payload.loss_history.map((l: Record<string, unknown>) => ({
        account_id: accountId,
        coverage_type: l.coverage_type || "auto_liability",
        no_prior_coverage: l.no_prior_coverage ?? false,
        policy_terms: l.policy_terms || [],
        cancelled_nonrenewed: l.cancelled_nonrenewed ?? false,
        cancellation_reason: l.cancellation_reason || null,
        cancellation_reason_other: l.cancellation_reason_other || null,
      }));

      const { error } = await supabase.from("loss_history").insert(lossRows);
      if (error) throw new Error(`Loss history insert failed: ${error.message}`);
    }

    // Insert garage locations
    if (Array.isArray(payload.garage_locations) && payload.garage_locations.length > 0) {
      if (isUpdate) {
        await supabase.from("garage_locations").delete().eq("account_id", accountId!);
      }

      const garageRows = payload.garage_locations.map((g: Record<string, unknown>, i: number) => ({
        account_id: accountId,
        address: g.address || null,
        city: g.city || null,
        state: g.state || null,
        zip: g.zip || null,
        county: g.county || null,
        is_principal: g.is_principal ?? (i === 0),
        sort_order: i,
      }));

      const { error } = await supabase.from("garage_locations").insert(garageRows);
      if (error) throw new Error(`Garage locations insert failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_id: accountId,
        action: isUpdate ? "updated" : "created",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("CTQ webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
