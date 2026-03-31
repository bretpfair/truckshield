import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Safely access nested properties like "basic_info.company_name" */
function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((cur: unknown, key: string) => {
    if (cur && typeof cur === "object") return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
const GVW_VALUES = [
  "Class 1","Class 1A","Class 1B","Class 1C","Class 1D",
  "Class 2","Class 2E","Class 2F","Class 2G","Class 2H",
  "Class 3","Class 4","Class 5","Class 6","Class 7","Class 8","Other",
];

/** Normalize a GVW string from CTQ into our class values */
function normalizeGvw(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // Direct match
  const exact = GVW_VALUES.find((v) => v === s);
  if (exact) return exact;
  // Match by prefix e.g. "Class 2E: 6,001 - 7,000 lb" -> "Class 2E"
  const match = s.match(/^(Class\s*\d[A-H]?)/i);
  if (match) {
    const normalized = match[1].replace(/\s+/g, " ");
    const found = GVW_VALUES.find((v) => v.toLowerCase() === normalized.toLowerCase());
    if (found) return found;
  }
  return s; // fallback: store raw value
}


/** Normalize business type strings from CTQ into our canonical values */
function normalizeBusinessType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "individual" || lower === "sole proprietor" || lower === "sole proprietorship") return "Individual";
  if (lower === "partnership" || lower === "limited partnership" || lower === "lp") return "Partnership";
  // Everything else maps to Corporation/LLC
  if (lower.includes("corp") || lower.includes("llc") || lower.includes("inc") || lower.includes("company") || lower.includes("s-corp") || lower.includes("c-corp")) return "Corporation/LLC";
  // If it doesn't match any known pattern, still try to preserve it if it's one of our values
  const KNOWN = ["Individual", "Partnership", "Corporation/LLC"];
  const exact = KNOWN.find((k) => k.toLowerCase() === lower);
  if (exact) return exact;
  // Default: Corporation/LLC for unrecognized values
  return "Corporation/LLC";
}

function yearsSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

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
    console.log("CTQ raw payload:", JSON.stringify(payload));

    // Extract fields from CTQ's nested structure
    const bi = (path: string) => get(payload, `basic_info.${path}`);
    const op = (path: string) => get(payload, `operation_info.${path}`);
    const cl = (path: string) => get(payload, `coverage_and_limit.${path}`);

    // Derive company name — CTQ may send it as basic_info.company_name or top-level
    const companyName =
      (bi("company_name") as string) ||
      (payload.company_name as string) ||
      (op("dot") ? `DOT ${op("dot")}` : null) ||
      `Unknown Lead ${new Date().toISOString().slice(0, 10)}`;

    const dotNumber = (op("dot") as string) || (payload.dot_number as string) || null;
    const mcNumber = (op("mc") as string) || (payload.mc_number as string) || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check for existing account by DOT number
    let accountId: string | null = null;
    let isUpdate = false;

    if (dotNumber) {
      const { data: existing } = await supabase
        .from("accounts")
        .select("id")
        .eq("dot_number", String(dotNumber))
        .maybeSingle();

      if (existing) {
        accountId = existing.id;
        isUpdate = true;
      }
    }

    // Build coverage_selections from coverage_and_limit fields
    const coverageSelections: Record<string, unknown> = {};
    const coverageTypes = [
      "bobtail_liability", "broadform_cargo", "collisions", "comprehensive",
      "expanded_refigeration", "garagekeepers_legal_liability", "general_liability",
      "hired_auto", "medical_payments", "non_trucking_liability", "on_hook_coverage",
      "pip", "refrigeration_malfunction", "specified_causes_of_loss",
      "trailer_interchange", "um_uim",
    ];
    for (const ct of coverageTypes) {
      const limit = cl(`${ct}_limit`);
      if (limit !== undefined) {
        coverageSelections[ct] = {
          enabled: !!limit,
          value: cl(`${ct}_value`) ?? null,
          deductible: cl(`${ct}_deductible`) ?? null,
        };
      }
    }

    // Extract contact info
    const contactEmail = (bi("email") as string) || (bi("contact_email") as string) || (payload.contact_email as string) || null;
    const contactPhone = (bi("phone") as string) || (bi("contact_phone") as string) || (payload.contact_phone as string) || null;

    // Map CTQ fields → accounts table
    const accountData: Record<string, unknown> = {
      company_name: companyName,
      dba_name: (bi("dba_name") as string) || payload.dba_name || null,
      dot_number: dotNumber ? String(dotNumber) : null,
      mc_number: mcNumber ? String(mcNumber) : null,
      ein_tax_id: (bi("fein_number") as string) || payload.ein_tax_id || null,
      business_type: normalizeBusinessType((bi("business_type_string") as string) || (payload.business_type as string) || null),
      business_owner_name: (bi("owner_name") as string) || payload.business_owner_name || null,
      business_owner_dob: (bi("owner_dob") as string) || payload.business_owner_dob || null,
      years_in_business: yearsSince(bi("business_starting_date") as string) ?? payload.years_in_business ?? null,
      date_of_authority: payload.date_of_authority || null,
      carrier_authority_number: payload.carrier_authority_number || null,
      carrier_authority_prefix: payload.carrier_authority_prefix || null,
      mailing_address: (bi("garaging_address") as string) || payload.mailing_address || null,
      mailing_city: (bi("city") as string) || payload.mailing_city || null,
      mailing_state: (bi("state") as string) || payload.mailing_state || null,
      mailing_zip: (bi("zip_code") as string) || payload.mailing_zip || null,
      county: payload.county || null,
      annual_revenue: (op("annual_revenue") as number) ?? payload.annual_revenue ?? null,
      total_annual_revenue: payload.total_annual_revenue ?? null,
      projected_gross_receipts: payload.projected_gross_receipts ?? null,
      total_subhaul_revenue: payload.total_subhaul_revenue ?? null,
      requested_effective_date: (bi("desired_effective_date") as string) || payload.requested_effective_date || null,
      current_coverage_expiry: (payload.renewal_date as string) || payload.current_coverage_expiry || null,
      operating_states: payload.operating_states || null,
      business_categories: payload.business_categories || null,
      cargo_types: payload.cargo_types || null,
      contractor_types: payload.contractor_types || null,
      notes: (op("notes") as string) || payload.notes || null,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      // Enriched fields
      fleet_size: payload.fleet_size ?? null,
      total_trucks: payload.total_trucks ?? null,
      total_drivers: payload.total_drivers ?? null,
      total_owned_trailers: payload.total_owned_trailers ?? null,
      total_nonowned_trailers: payload.total_nonowned_trailers ?? null,
      total_garage_locations: payload.total_garage_locations ?? null,
      number_of_claims: payload.number_of_claims ?? null,
      loss_history_summary: payload.loss_history_summary || null,
    };

    // Coverage selections - map CTQ coverage_and_limit to form format
    if (Object.keys(coverageSelections).length > 0) {
      accountData.coverage_selections = coverageSelections;
    } else if (payload.coverage_selections) {
      accountData.coverage_selections = payload.coverage_selections;
    }

    // Map auto_liability limit/deductible into coverage_selections
    const autoLiabilityLimit = cl("auto_liability_limit");
    if (autoLiabilityLimit) {
      const cs = (accountData.coverage_selections as Record<string, unknown>) || {};
      cs.primary_bipd = `$${Number(autoLiabilityLimit).toLocaleString()}`;
      const autoDeductible = cl("auto_liability_deductible");
      if (autoDeductible) cs.auto_liability_deductible = `$${Number(autoDeductible).toLocaleString()}`;
      // Map broadform cargo
      const cargoLimit = cl("broadform_cargo_limit");
      if (cargoLimit) {
        cs.cargo_liability = true;
        const cargoVal = Number(cargoLimit);
        cs.cargo_vehicle_limit = cargoVal >= 1000 ? `$${Math.round(cargoVal / 1000)}K` : `$${cargoVal}`;
        const cargoDed = cl("broadform_cargo_deductible");
        if (cargoDed) cs.cargo_deductible = `$${Number(cargoDed).toLocaleString()}`;
      }
      // Map federal/state filing from coverage
      const fedFiling = op("federal_or_state_filings_required");
      if (fedFiling === true || fedFiling === "Yes") {
        cs.icc_filing = "Yes";
        cs.state_filing = "Yes";
      }
      accountData.coverage_selections = cs;
    }

    // Radius operations - store in the format the wizard form expects
    // NOTE: CTQ does not provide radius percentage breakdowns (under_50, 51_200, etc.)
    // Only map operation type and annual mileage; leave radius_details empty
    const rangeOfOp = op("range_of_operation") as string;
    const annualMileage = op("annual_mileage");
    if (rangeOfOp || annualMileage || payload.radius_operations) {
      if (payload.radius_operations) {
        accountData.radius_operations = payload.radius_operations;
      } else {
        let operationType = "Both";
        if (rangeOfOp) {
          const lower = String(rangeOfOp).toLowerCase();
          if (lower.includes("interstate") && !lower.includes("intrastate")) operationType = "Interstate";
          else if (lower.includes("intrastate") && !lower.includes("interstate")) operationType = "Intrastate";
          else operationType = "Both";
        }
        accountData.radius_operations = [{
          operation_type: operationType,
          annual_mileage: annualMileage ? String(annualMileage) : null,
          radius_details: {},
        }];
      }
    }

    // Map commodities to the format the wizard form uses
    if (Array.isArray(payload.commodities) && payload.commodities.length > 0) {
      const selectedCommodities: Record<string, string> = {};
      for (const c of payload.commodities) {
        const name = (c.commodity as string) || "General Merchandise";
        selectedCommodities[name] = String(c.loads_percentage ?? "");
      }
      accountData.commodity_info = {
        selected_commodities: selectedCommodities,
      };
    } else if (payload.commodity_info) {
      accountData.commodity_info = payload.commodity_info;
    }

    // Map CTQ operation questions to wizard q-format
    const generalQuestions: Record<string, unknown> = payload.general_questions
      ? (typeof payload.general_questions === "object" ? { ...(payload.general_questions as Record<string, unknown>) } : {})
      : {};

    // q4: cover_all_vehicles
    const coverAll = op("cover_all_vehicles");
    if (coverAll !== undefined && coverAll !== null && !generalQuestions.q4) {
      generalQuestions.q4 = { answer: coverAll === true || coverAll === "Yes" ? "Yes" : "No" };
    }
    // q6: non_employee_passengers
    const nonEmpPax = op("non_employee_passengers");
    if (nonEmpPax !== undefined && nonEmpPax !== null && !generalQuestions.q6) {
      generalQuestions.q6 = { answer: nonEmpPax === true || nonEmpPax === "Yes" ? "Yes" : "No" };
    }
    // q12: is_risk_cancelled_in_last_three_years
    const cancelled = op("is_risk_cancelled_in_last_three_years");
    if (cancelled !== undefined && cancelled !== null && !generalQuestions.q12) {
      generalQuestions.q12 = { answer: cancelled === true || cancelled === "Yes" ? "Yes" : "No" };
    }
    // q15: is_risk_covered (workers comp)
    const workerComp = op("is_risk_covered");
    if (workerComp !== undefined && workerComp !== null && !generalQuestions.q15) {
      generalQuestions.q15 = { answer: workerComp === true || workerComp === "Yes" ? "Yes" : "No" };
    }
    // q16: federal_or_state_filings_required
    const fedFilings = op("federal_or_state_filings_required");
    if (fedFilings !== undefined && fedFilings !== null && !generalQuestions.q16) {
      generalQuestions.q16 = { answer: fedFilings === true || fedFilings === "Yes" ? "Yes" : "No" };
    }
    // q17: years_insured_owned_commercial_equipment
    const yearsEquip = op("years_insured_owned_commercial_equipment");
    if (yearsEquip !== undefined && yearsEquip !== null && !generalQuestions.q17) {
      generalQuestions.q17 = { value: String(yearsEquip) };
    }
    // q18: years of primary liability coverage
    const yearsLiability = op("years_of_primary_liability_coverage") ?? bi("years_of_primary_liability_coverage");
    if (yearsLiability !== undefined && yearsLiability !== null && !generalQuestions.q18) {
      generalQuestions.q18 = { value: String(yearsLiability) };
    }
    // q9: map years of coverage to yes/no
    if (yearsLiability !== undefined && yearsLiability !== null && !generalQuestions.q9) {
      generalQuestions.q9 = { answer: Number(yearsLiability) >= 2 ? "Yes" : "No" };
    }

    if (Object.keys(generalQuestions).length > 0) {
      accountData.general_questions = generalQuestions;
    }

    if (isUpdate && accountId) {
      const { error } = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", accountId);
      if (error) throw new Error(`Account update failed: ${error.message}`);
    } else {
      accountData.status = "pending_info";
      const { data, error } = await supabase
        .from("accounts")
        .insert(accountData)
        .select("id")
        .single();
      if (error) throw new Error(`Account insert failed: ${error.message}`);
      accountId = data.id;
    }

    // Insert drivers from CTQ's drivers[] array
    const ctqDrivers = Array.isArray(payload.drivers) ? payload.drivers : [];
    if (ctqDrivers.length > 0) {
      if (isUpdate) {
        await supabase.from("drivers").delete().eq("account_id", accountId!);
      }

      const driverRows = ctqDrivers.map((d: Record<string, unknown>, i: number) => {
        // CTQ sends "name" (full name); split into first/last
        const fullName = (d.name as string) || (d.full_name as string) || "";
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = d.first_name || nameParts[0] || null;
        const lastName = d.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null);

        // CTQ sends moving_violations and accidents as string counts
        const numViolations = parseInt(String(d.moving_violations ?? d.num_violations ?? 0), 10) || 0;
        const numAccidents = parseInt(String(d.accidents ?? d.num_accidents ?? 0), 10) || 0;

        return {
          account_id: accountId,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: d.dob || d.date_of_birth || null,
          license_number: d.license_number || null,
          license_state: d.state || d.license_state || null,
          license_type: d.license_type || null,
          driver_type: d.is_owner_operator ? "owner_operator" : (d.driver_type || null),
          experience_years: d.years_commercial_driving ?? d.years_experience ?? d.experience_years ?? null,
          experience_months: d.experience_months ?? null,
          date_hired_year: d.date_hired_year ?? null,
          date_hired_month: d.date_hired_month ?? null,
          original_issue_year: d.original_issue_year ?? null,
          original_issue_month: d.original_issue_month ?? null,
          num_violations: numViolations,
          violations: Array.isArray(d.violations) ? d.violations : [],
          num_accidents: numAccidents,
          accidents: Array.isArray(d.accidents) ? d.accidents : [],
          lapse_suspension: d.lapse_suspension || null,
          lapse_explanation: d.lapse_explanation || null,
          sort_order: i,
        };
      });

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
            model: v.vehicle_model || v.model || null,
            vin: v.vin || null,
            trailer_type: v.vehicle_type || v.trailer_type || null,
            garage_zip: v.garage_zip || null,
            ownership_type: v.ownership_type || "owned",
            has_physdam: !!(v.stated_value || v.has_physdam),
            physdam_amount: v.stated_value ?? v.physdam_amount ?? null,
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
            model: v.vehicle_model || v.model || null,
            vin: v.vin || null,
            truck_type: v.vehicle_type || v.truck_type || null,
            gvw_class: normalizeGvw(v.gvw_string || v.gvw || v.gvw_class),
            garage_zip: v.garage_zip || null,
            titled_state: v.titled_state || null,
            ownership_type: v.ownership_type || "owned",
            has_physdam: !!(v.stated_value || v.has_physdam),
            physdam_amount: v.stated_value ?? v.physdam_amount ?? null,
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

    // Insert loss history from CTQ's losses[] array
    const ctqLosses = Array.isArray(payload.losses) ? payload.losses : [];
    if (ctqLosses.length > 0) {
      if (isUpdate) {
        await supabase.from("loss_history").delete().eq("account_id", accountId!);
      }

      const lossRows = ctqLosses.map((l: Record<string, unknown>) => {
        const companyName = (l.company_name as string) || "";
        const isNoPrior = companyName.toLowerCase().includes("no prior");

        return {
          account_id: accountId,
          coverage_type: l.coverage_type || "auto_liability",
          no_prior_coverage: isNoPrior || (l.no_prior_coverage ?? false),
          policy_terms: l.policy_terms || [{
            start_date: l.policy_start_date || null,
            end_date: l.policy_end_date || null,
            premium: l.premium_amount || null,
            claims: l.number_of_claims || null,
            total_paid_reserved: l.total_paid_and_reserved || null,
            policy_numbers: l.policy_numbers || null,
            insurer: companyName || null,
          }],
          cancelled_nonrenewed: l.cancelled_nonrenewed ?? false,
          cancellation_reason: l.cancellation_reason || null,
          cancellation_reason_other: l.cancellation_reason_other || null,
        };
      });

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

    // If no explicit garage_locations but we have garaging_address, create one
    if (
      (!payload.garage_locations || payload.garage_locations.length === 0) &&
      bi("garaging_address")
    ) {
      if (isUpdate) {
        await supabase.from("garage_locations").delete().eq("account_id", accountId!);
      }
      const { error } = await supabase.from("garage_locations").insert({
        account_id: accountId,
        address: bi("garaging_address") as string,
        city: bi("city") as string || null,
        state: bi("state") as string || null,
        zip: bi("zip_code") as string || null,
        is_principal: true,
        sort_order: 0,
      });
      if (error) console.error("Garage location insert warning:", error.message);
    }

    // Auto-send client portal invite if contact_email is present and no client linked
    if (contactEmail && !isUpdate) {
      try {
        // Check no existing invitation for this account
        const { data: existingInvite } = await supabase
          .from("client_invitations")
          .select("id")
          .eq("account_id", accountId!)
          .eq("status", "pending")
          .maybeSingle();

        if (!existingInvite) {
          const { data: invitation, error: invErr } = await supabase
            .from("client_invitations")
            .insert({
              account_id: accountId!,
              email: contactEmail.trim().toLowerCase(),
            })
            .select()
            .single();

          if (!invErr && invitation) {
            const portalLink = `https://truckshield.lovable.app/auth?invite=${invitation.token}`;
            const firstName = (accountData.business_owner_name as string)?.split(/\s+/)[0]
              || contactEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "client-portal-invite",
                recipientEmail: contactEmail.trim().toLowerCase(),
                idempotencyKey: `portal-invite-${invitation.id}`,
                templateData: { firstName, portalLink },
              },
            });

            await supabase.from("activity_log").insert({
              account_id: accountId!,
              action_type: "client_linked",
              description: `Auto-invitation sent to ${contactEmail} (via CTQ webhook)`,
            });

            console.log(`Auto-invite sent to ${contactEmail} for account ${accountId}`);
          }
        }
      } catch (inviteErr) {
        // Don't fail the webhook if invite fails
        console.error("Auto-invite error (non-fatal):", inviteErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_id: accountId,
        action: isUpdate ? "updated" : "created",
        auto_invited: !isUpdate && !!contactEmail,
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
