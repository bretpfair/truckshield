import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CWCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

function getCWCredentials(): CWCredentials {
  const baseUrl = Deno.env.get("CW_BASE_URL");
  const username = Deno.env.get("CW_USERNAME");
  const password = Deno.env.get("CW_PASSWORD");
  if (!baseUrl || !username || !password) {
    throw new Error("Cover Whale API credentials not configured. Please add CW_BASE_URL, CW_USERNAME, and CW_PASSWORD secrets.");
  }
  return { baseUrl, username, password };
}

async function authenticate(creds: CWCredentials): Promise<string> {
  // Auth endpoint is at the API root, not under /quote
  const authUrl = new URL(creds.baseUrl);
  const res = await fetch(`${authUrl.origin}/authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CW auth failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (!data.AccessToken) throw new Error("No AccessToken in auth response");
  return data.AccessToken;
}

async function cwFetch(token: string, baseUrl: string, path: string, method: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "AccessToken": token,
    },
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw { status: res.status, data: json };
  }
  return json;
}

// ---- Data mapping helpers ----

function mapCoverageSelections(cs: any) {
  return {
    requestAl: cs?.auto_liability ? "Y" : "N",
    optAlPip: cs?.pip ? "Y" : "N",
    optAlUm: cs?.um_uim ? "Y" : "N",
    requestApd: cs?.auto_physical_damage ? "Y" : "N",
    requestMtc: cs?.motor_truck_cargo ? "Y" : "N",
    requestTgl: cs?.truckers_general_liability ? "Y" : "N",
    requestNtl: cs?.non_trucking_liability ? "Y" : "N",
  };
}

function mapEntityType(bt: string | null): string {
  if (!bt) return "llc";
  const lower = bt.toLowerCase();
  if (lower.includes("individual") || lower.includes("sole")) return "individual";
  if (lower.includes("corp")) return "corporation";
  if (lower.includes("llc")) return "llc";
  if (lower.includes("partnership")) return "partnership";
  if (lower.includes("joint")) return "joint_venture";
  return "llc";
}

function formatDateMMDDYYYY(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function mapGvwToClass(gvw: string | null): string {
  if (!gvw) return "8";
  const g = gvw.toLowerCase().replace(/[^0-9a-z]/g, "");
  if (g.includes("2a") || g === "2a") return "2a";
  if (g.includes("2b") || g === "2b") return "2b";
  if (g === "3") return "3";
  if (g === "4") return "4";
  if (g === "5") return "5";
  if (g === "6") return "6";
  if (g === "7") return "7";
  return "8";
}

function mapTruckTypeToBody(tt: string | null, gvw: string | null): string {
  if (!tt) return "tractor";
  const lower = tt.toLowerCase();
  if (lower.includes("tractor")) return "tractor";
  if (lower.includes("box")) return "box_truck";
  if (lower.includes("straight")) return "straight_truck";
  if (lower.includes("flatbed")) return "flatbed_truck";
  if (lower.includes("dump")) return "dump_truck";
  if (lower.includes("pick") || lower.includes("pickup")) return "pick_up";
  if (lower.includes("stake")) return "stake_truck";
  return "tractor";
}

function mapTrailerType(tt: string | null): string {
  if (!tt) return "dry_van_trailer";
  const lower = tt.toLowerCase();
  if (lower.includes("dry van")) return "dry_van_trailer";
  if (lower.includes("flatbed")) return "flatbed_trailer";
  if (lower.includes("refriger") || lower.includes("reefer")) return "refrigerated_van_trailer";
  if (lower.includes("step")) return "step_deck_trailer";
  if (lower.includes("dump")) return "dump_trailer";
  if (lower.includes("lowboy") || lower.includes("low boy")) return "low_boy_trailer";
  if (lower.includes("auto") || lower.includes("car")) return "auto_transporter_trailer";
  if (lower.includes("curtain")) return "curtain_van_trailer";
  if (lower.includes("gooseneck")) return "gooseneck_trailer";
  if (lower.includes("intermodal")) return "intermodal_container_hauler_trailer";
  if (lower.includes("tilt")) return "tilt_deck_trailer";
  if (lower.includes("utility")) return "utility_trailer";
  if (lower.includes("bulk")) return "dry_bulk_trailer";
  return "dry_van_trailer";
}

function mapCommodities(ci: any): { commodities: any[]; refrigeration: string } {
  const commodities: any[] = [];
  let refrigeration = "N";
  
  const COMMODITY_MAP: Record<string, string> = {
    "general freight": "general_merchandise",
    "agricultural/farm supplies": "agricultural_farm_supplies",
    "beverages": "beverages",
    "building materials": "building_materials",
    "chemicals": "chemicals_packaged_or_bulk",
    "coal/coke": "coal",
    "construction": "building_materials",
    "fresh produce": "produce",
    "garbage/refuse": "refuse_garbage",
    "grain, feed, hay": "grain_hay_feed",
    "household goods": "household_goods",
    "liquids/gases": "liquid_haulers",
    "livestock": "livestock_and_live_poultry",
    "logs, poles, beams, lumber": "lumber",
    "machinery, large objects": "machinery_and_heavy_equipment",
    "meat": "meat",
    "metal: sheets, coils, rolls": "metal_and steel",
    "mobile homes": "mobile_homes",
    "motor vehicles": "automobiles_5_vehicles_or_less",
    "oilfield equipment": "machinery_and_heavy_equipment",
    "paper products": "paper_and_paper_products",
    "refrigerated food": "frozen_or_refrigerated",
    "dirt / sand / gravel": "cement_sand_or_gravel",
    "other": "general_merchandise",
  };
  
  if (ci?.selected_commodities && typeof ci.selected_commodities === "object") {
    for (const [name, pct] of Object.entries(ci.selected_commodities)) {
      const key = COMMODITY_MAP[name.toLowerCase()] || "general_merchandise";
      commodities.push({
        commodityKey: key,
        commodityPercentage: String(pct),
      });
      if (name.toLowerCase().includes("refriger")) refrigeration = "Y";
    }
  }
  
  if (commodities.length === 0) {
    commodities.push({ commodityKey: "general_merchandise", commodityPercentage: "100" });
  }
  
  return { commodities, refrigeration };
}

function mapRadius(ro: any): any {
  const radius: any = {
    stateOperations: "interstate",
    annualMileage: 10000,
    radius0_50: "0",
    radius51_200: "0",
    radius201_500: "0",
    radius501: "0",
  };
  
  if (Array.isArray(ro) && ro.length > 0) {
    for (const r of ro) {
      if (r.range === "0-50" || r.range === "local") radius.radius0_50 = String(r.percentage || 0);
      else if (r.range === "51-200" || r.range === "intermediate") radius.radius51_200 = String(r.percentage || 0);
      else if (r.range === "201-500" || r.range === "regional") radius.radius201_500 = String(r.percentage || 0);
      else if (r.range === "501+" || r.range === "long_haul") radius.radius501 = String(r.percentage || 0);
    }
  } else if (ro && typeof ro === "object" && !Array.isArray(ro)) {
    radius.radius0_50 = String(ro.radius0_50 || ro["0-50"] || 0);
    radius.radius51_200 = String(ro.radius51_200 || ro["51-200"] || 0);
    radius.radius201_500 = String(ro.radius201_500 || ro["201-500"] || 0);
    radius.radius501 = String(ro.radius501 || ro["501+"] || 0);
  }
  
  // Default: if all zeros, set 100% to 51-200
  const total = parseInt(radius.radius0_50) + parseInt(radius.radius51_200) + parseInt(radius.radius201_500) + parseInt(radius.radius501);
  if (total === 0) {
    radius.radius51_200 = "100";
  }
  
  return radius;
}

function mapLossHistory(lh: any[]): any {
  const losses: any = {};
  if (!lh || lh.length === 0) {
    losses["1"] = {
      lossConfirmed: "Y",
      lossAlCount: "0", lossAlPaid: "0",
      lossApdCount: "0", lossApdPaid: "0",
      lossMtcCount: "0", lossMtcPaid: "0",
      lossTglCount: "0", lossTglPaid: "0",
      lossNtlCount: "0", lossNtlPaid: "0",
    };
    return losses;
  }
  
  // Aggregate by policy term year (up to 3 years)
  const yearData: Record<string, any> = {};
  for (const entry of lh) {
    const terms = entry.policy_terms as any[];
    if (!Array.isArray(terms)) continue;
    for (const term of terms) {
      const year = term.year || "1";
      if (!yearData[year]) {
        yearData[year] = {
          lossConfirmed: "Y",
          lossAlCount: 0, lossAlPaid: 0,
          lossApdCount: 0, lossApdPaid: 0,
          lossMtcCount: 0, lossMtcPaid: 0,
          lossTglCount: 0, lossTglPaid: 0,
          lossNtlCount: 0, lossNtlPaid: 0,
        };
      }
      const ct = entry.coverage_type || "";
      const claims = Number(term.num_claims) || 0;
      const paid = Number(term.amount_paid) || 0;
      if (ct.includes("auto_liability") || ct.includes("al")) {
        yearData[year].lossAlCount += claims;
        yearData[year].lossAlPaid += paid;
      } else if (ct.includes("physical") || ct.includes("apd")) {
        yearData[year].lossApdCount += claims;
        yearData[year].lossApdPaid += paid;
      } else if (ct.includes("cargo") || ct.includes("mtc")) {
        yearData[year].lossMtcCount += claims;
        yearData[year].lossMtcPaid += paid;
      } else if (ct.includes("general") || ct.includes("tgl")) {
        yearData[year].lossTglCount += claims;
        yearData[year].lossTglPaid += paid;
      } else if (ct.includes("non_trucking") || ct.includes("ntl")) {
        yearData[year].lossNtlCount += claims;
        yearData[year].lossNtlPaid += paid;
      } else {
        yearData[year].lossAlCount += claims;
        yearData[year].lossAlPaid += paid;
      }
    }
  }
  
  const keys = Object.keys(yearData).sort();
  for (let i = 0; i < Math.min(keys.length, 3); i++) {
    const d = yearData[keys[i]];
    losses[String(i + 1)] = {
      lossConfirmed: "Y",
      lossAlCount: String(d.lossAlCount),
      lossAlPaid: String(d.lossAlPaid),
      lossApdCount: String(d.lossApdCount),
      lossApdPaid: String(d.lossApdPaid),
      lossMtcCount: String(d.lossMtcCount),
      lossMtcPaid: String(d.lossMtcPaid),
      lossTglCount: String(d.lossTglCount),
      lossTglPaid: String(d.lossTglPaid),
      lossNtlCount: String(d.lossNtlCount),
      lossNtlPaid: String(d.lossNtlPaid),
    };
  }
  
  if (Object.keys(losses).length === 0) {
    losses["1"] = {
      lossConfirmed: "Y",
      lossAlCount: "0", lossAlPaid: "0",
      lossApdCount: "0", lossApdPaid: "0",
      lossMtcCount: "0", lossMtcPaid: "0",
      lossTglCount: "0", lossTglPaid: "0",
      lossNtlCount: "0", lossNtlPaid: "0",
    };
  }
  
  return losses;
}

function mapOperations(account: any, gq: any): any {
  const ops: any = {
    opsLocal: "N",
    opsIntermediate: "Y",
    opsLongHaul: "N",
    opsIntermodalPort: "N",
    opsDumpTruckOther: "N",
    opsDumpTruckSandGravel: "N",
    opsEndDumper: "N",
    opsLogging: "N",
    opsRefrigirated: "N",
    opsHotShot: "N",
    opsOversizedOvernight: "N",
    opsAutomobileHauler: "N",
    opsHouseholdGoods: "N",
    opsTanker: "N",
    ineligibleOperations: "N",
    filingsAlFederal: "N",
    filingsAlState: "N",
    priorInsuranceCancelledNonrenewed: "N",
    bankruptcies: "N",
    personalUseOfVehicle: "N",
    UIIAintermodal: "N",
    dataSharingOption: "eld_only",
  };
  
  // Derive from general_questions if available
  if (gq) {
    if (gq.prior_cancelled) ops.priorInsuranceCancelledNonrenewed = "Y";
    if (gq.bankruptcies) ops.bankruptcies = "Y";
    if (gq.personal_use) ops.personalUseOfVehicle = "Y";
  }
  
  // Derive operation types from business_categories or cargo
  const cats = account.business_categories || [];
  const cargo = account.cargo_types || [];
  for (const c of [...cats, ...cargo]) {
    const lower = (c || "").toLowerCase();
    if (lower.includes("refriger") || lower.includes("reefer")) ops.opsRefrigirated = "Y";
    if (lower.includes("dump")) ops.opsDumpTruckOther = "Y";
    if (lower.includes("household")) ops.opsHouseholdGoods = "Y";
    if (lower.includes("tanker") || lower.includes("liquid")) ops.opsTanker = "Y";
    if (lower.includes("intermodal")) ops.opsIntermodalPort = "Y";
    if (lower.includes("auto") && lower.includes("haul")) ops.opsAutomobileHauler = "Y";
    if (lower.includes("log")) ops.opsLogging = "Y";
  }
  
  return ops;
}

async function buildQuotePayload(supabase: any, accountId: string) {
  // Fetch all related data
  const [accountRes, driversRes, powerUnitsRes, trailersRes, lossHistoryRes, garageRes, producerRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).single(),
    supabase.from("drivers").select("*").eq("account_id", accountId).order("sort_order"),
    supabase.from("power_units").select("*").eq("account_id", accountId).order("sort_order"),
    supabase.from("trailers").select("*").eq("account_id", accountId).order("sort_order"),
    supabase.from("loss_history").select("*").eq("account_id", accountId),
    supabase.from("garage_locations").select("*").eq("account_id", accountId).order("sort_order"),
    null, // Will fetch producer separately if needed
  ]);
  
  if (accountRes.error) throw new Error(`Failed to fetch account: ${accountRes.error.message}`);
  const account = accountRes.data;
  const drivers = driversRes.data || [];
  const powerUnits = powerUnitsRes.data || [];
  const trailers = trailersRes.data || [];
  const lossHistory = lossHistoryRes.data || [];
  const garages = garageRes.data || [];
  
  const cs = account.coverage_selections || {};
  const ci = account.commodity_info || {};
  const gq = account.general_questions || {};
  const ro = account.radius_operations;
  
  // Build principal garage address
  const principalGarage = garages.find((g: any) => g.is_principal) || garages[0];
  
  // Producer info for retail agent
  let producer: any = null;
  if (account.assigned_producer_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", account.assigned_producer_id)
      .single();
    producer = p;
  }
  
  // Owner name parsing
  const ownerName = account.business_owner_name || account.company_name;
  const ownerParts = ownerName.split(" ");
  const ownerFirst = ownerParts[0] || "Owner";
  const ownerLast = ownerParts.slice(1).join(" ") || ownerFirst;
  
  // Calculate total truck/trailer values for limits
  const totalTruckValue = powerUnits.reduce((sum: number, pu: any) => sum + (Number(pu.physdam_amount) || 0), 0);
  const totalTrailerValue = trailers.reduce((sum: number, t: any) => sum + (Number(t.physdam_amount) || 0), 0);
  
  const { commodities, refrigeration } = mapCommodities(ci);
  
  const payload: any = {
    coverage: {
      ...mapCoverageSelections(cs),
      effectiveDate: formatDateMMDDYYYY(account.requested_effective_date) || formatDateMMDDYYYY(new Date().toISOString()),
    },
    insuredInformation: {
      entityType: mapEntityType(account.business_type),
      dotNumber: account.dot_number ? parseInt(account.dot_number) : 0,
      email: account.contact_email || "noemail@placeholder.com",
      legalName: account.company_name,
      dbaName: account.dba_name || account.company_name,
      ownerName: ownerName,
      yearsInBusiness: String(account.years_in_business || 1),
      monthsInBusiness: "0",
      insuranceContactFirstName: ownerFirst,
      insuranceContactLastName: ownerLast,
      insuranceContactPhone: (account.contact_phone || "5555555555").replace(/\D/g, ""),
      insuranceContactEmail: account.contact_email || "noemail@placeholder.com",
    },
    limits: {
      trailerInterchange: "N",
      trailerInterchangeLimit: "0",
      limitTowingStorage: "7500",
      nbrOfTrucks: String(powerUnits.length || account.total_trucks || 1),
      valueOfTrucks: String(totalTruckValue),
      nbrOfTrailers: String(trailers.filter((t: any) => !t.is_nonowned).length || 0),
      valueOfTrailers: String(totalTrailerValue),
      mtcLimit: cs?.mtc_limit || "100000",
      limitAutoLiability: cs?.al_limit || "1000000",
      insuredWaiverSubrogation: "N",
    },
    operations: mapOperations(account, gq),
    garageAddress: principalGarage ? {
      garageStreet: principalGarage.address || account.mailing_address || "",
      garageCity: principalGarage.city || account.mailing_city || "",
      garageState: principalGarage.state || account.mailing_state || "",
      garageZip: principalGarage.zip || account.mailing_zip || "",
      garageCounty: principalGarage.county || account.county || "",
      garageCountry: "US",
    } : {
      garageStreet: account.mailing_address || "",
      garageCity: account.mailing_city || "",
      garageState: account.mailing_state || "",
      garageZip: account.mailing_zip || "",
      garageCounty: account.county || "",
      garageCountry: "US",
    },
    mailingAddress: {
      mailingStreet: account.mailing_address || "",
      mailingCity: account.mailing_city || "",
      mailingState: account.mailing_state || "",
      mailingZip: account.mailing_zip || "",
      mailingCounty: account.county || "",
      mailingCountry: "US",
    },
    radius: mapRadius(ro),
    commoditiesRefrigeration: refrigeration,
    commodities,
    terminals: garages.length > 0 ? garages.map((g: any) => ({
      terminalStreet: g.address || "",
      terminalCity: g.city || "",
      terminalState: g.state || "",
      terminalZip: g.zip || "",
      terminalCounty: g.county || "",
    })) : [{
      terminalStreet: account.mailing_address || "",
      terminalCity: account.mailing_city || "",
      terminalState: account.mailing_state || "",
      terminalZip: account.mailing_zip || "",
      terminalCounty: account.county || "",
    }],
    vehicles: powerUnits.map((pu: any) => ({
      vin: pu.vin || "",
      year: pu.year || "2020",
      make: pu.make || "Unknown",
      model: pu.model || "Unknown",
      value: String(pu.physdam_amount || 0),
      classKey: mapGvwToClass(pu.gvw_class),
      bodyTypeKey: mapTruckTypeToBody(pu.truck_type, pu.gvw_class),
      includeAPDTowing: pu.has_physdam ? "Y" : "N",
    })),
    trailers: trailers.filter((t: any) => !t.is_nonowned).map((t: any) => ({
      vin: t.vin || "",
      year: t.year || "2020",
      make: t.make || "Unknown",
      model: t.model || "Unknown",
      value: String(t.physdam_amount || 0),
      bodyTypeKey: mapTrailerType(t.trailer_type),
    })),
    drivers: drivers.map((d: any) => ({
      firstName: d.first_name || "Unknown",
      lastName: d.last_name || "Unknown",
      licenseState: d.license_state || "",
      licenseNumber: d.license_number || "",
      dateOfBirth: formatDateMMDDYYYY(d.date_of_birth),
      dateOfHire: d.date_hired_month && d.date_hired_year
        ? `${String(d.date_hired_month).padStart(2, "0")}/01/${d.date_hired_year}`
        : "",
      yearsExperience: String(d.experience_years || 1),
      monthsExperience: String(d.experience_months || 0),
      eligibility: "Covered",
      accidents_total: String(d.num_accidents || 0),
      violations_total: String(d.num_violations || 0),
      suspensions_total: d.lapse_suspension === "yes" ? "1" : "0",
      major_violations_total: "0",
    })),
    losses: mapLossHistory(lossHistory),
    retailAgent: {
      FirstName: producer?.full_name?.split(" ")[0] || "360 Risk",
      LastName: producer?.full_name?.split(" ").slice(1).join(" ") || "Partners",
      Phone: producer?.phone || "5555555555",
      Email: producer?.email || "integrations@360riskpartners.com",
      AgencyName: "360 Risk Partners",
      Street: "",
      City: "",
      State: "",
      Zip: "",
    },
  };
  
  // Ensure at least 1 vehicle
  if (payload.vehicles.length === 0) {
    throw new Error("No power units found. At least one vehicle is required for a Cover Whale quote.");
  }
  
  // Ensure at least 1 driver
  if (payload.drivers.length === 0) {
    throw new Error("No drivers found. At least one driver is required for a Cover Whale quote.");
  }
  
  return { payload, account };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const userId = claims.claims.sub as string;
    
    // Service client for DB ops
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check user is staff
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = roles?.some((r: any) => r.role === "admin" || r.role === "producer");
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Staff access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const body = await req.json();
    const { action, accountId, submissionNumber, bindData } = body;
    
    const creds = getCWCredentials();
    const cwToken = await authenticate(creds);
    
    if (action === "quote" || action === "indication") {
      if (!accountId) throw new Error("accountId is required");
      
      const { payload, account } = await buildQuotePayload(supabase, accountId);
      const endpoint = action === "quote" ? "/quote" : "/indication";
      
      const result = await cwFetch(cwToken, creds.baseUrl, endpoint, "POST", payload);
      
      // Find Cover Whale carrier
      const { data: cwCarrier } = await supabase
        .from("carriers")
        .select("id")
        .ilike("name", "%cover whale%")
        .single();
      
      if (result.submission_number) {
        // Create or update quote record
        let quoteId: string | null = null;
        if (cwCarrier) {
          // Check for existing quote
          const { data: existing } = await supabase
            .from("quotes")
            .select("id")
            .eq("account_id", accountId)
            .eq("carrier_id", cwCarrier.id)
            .single();
          
          const totalPremium = result.coverages
            ? Object.values(result.coverages).reduce((sum: number, c: any) => sum + (c.totalCost || 0), 0)
            : null;
          
          if (existing) {
            await supabase.from("quotes").update({
              status: result.status?.toLowerCase() === "quoted" ? "quoted" : "submitted",
              premium_estimate: totalPremium,
              coverage_details: { cw_coverages: result.coverages, cw_quote_pdf: result.quote_pdf },
              published_at: new Date().toISOString(),
            }).eq("id", existing.id);
            quoteId = existing.id;
          } else {
            const { data: newQuote } = await supabase.from("quotes").insert({
              account_id: accountId,
              carrier_id: cwCarrier.id,
              status: result.status?.toLowerCase() === "quoted" ? "quoted" : "submitted",
              premium_estimate: totalPremium,
              coverage_details: { cw_coverages: result.coverages, cw_quote_pdf: result.quote_pdf },
              created_by: userId,
              match_score: null,
              published_at: new Date().toISOString(),
            }).select("id").single();
            quoteId = newQuote?.id || null;
          }
        }
        
        // Store CW submission
        const totalPremium = result.coverages
          ? Object.values(result.coverages).reduce((sum: number, c: any) => sum + (c.totalCost || 0), 0)
          : null;
        
        // Check existing submission
        const { data: existingSub } = await supabase
          .from("coverwhale_submissions")
          .select("id")
          .eq("account_id", accountId)
          .eq("submission_number", result.submission_number)
          .single();
        
        if (existingSub) {
          await supabase.from("coverwhale_submissions").update({
            status: result.status || "quoted",
            quote_pdf_url: result.quote_pdf || null,
            coverages_data: result.coverages || {},
            total_premium: totalPremium,
            api_response: result,
            quote_id: quoteId,
          }).eq("id", existingSub.id);
        } else {
          await supabase.from("coverwhale_submissions").insert({
            account_id: accountId,
            quote_id: quoteId,
            submission_number: result.submission_number,
            status: result.status || "quoted",
            quote_pdf_url: result.quote_pdf || null,
            coverages_data: result.coverages || {},
            total_premium: totalPremium,
            api_response: result,
          });
        }
        
        // Log activity
        const actionLabel = action === "quote" ? "quote" : "indication";
        const premiumStr = totalPremium ? ` — Total premium: $${totalPremium.toLocaleString()}` : "";
        await supabase.from("activity_log").insert({
          account_id: accountId,
          user_id: userId,
          action_type: "coverwhale_api",
          description: `Cover Whale ${actionLabel} received — Submission #${result.submission_number}${premiumStr}`,
        });
      }
      
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (action === "submission-status") {
      if (!submissionNumber) throw new Error("submissionNumber is required");
      const result = await cwFetch(cwToken, creds.baseUrl, `/submission/${submissionNumber}`, "GET");
      
      // Update local record
      await supabase.from("coverwhale_submissions")
        .update({ status: result.status || result.submission_status || "unknown", api_response: result })
        .eq("submission_number", submissionNumber);
      
      if (accountId) {
        await supabase.from("activity_log").insert({
          account_id: accountId,
          user_id: userId,
          action_type: "coverwhale_api",
          description: `Cover Whale status check — Submission #${submissionNumber} — Status: ${result.status || result.submission_status || "unknown"}`,
        });
      }
      
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (action === "bind") {
      if (!submissionNumber || !bindData) throw new Error("submissionNumber and bindData are required");
      const result = await cwFetch(cwToken, creds.baseUrl, `/api/v1/bind/${submissionNumber}`, "PUT", bindData);
      
      // Update local records
      await supabase.from("coverwhale_submissions")
        .update({ status: result.status || "bind requested", api_response: result })
        .eq("submission_number", submissionNumber);
      
      if (accountId) {
        await supabase.from("activity_log").insert({
          account_id: accountId,
          user_id: userId,
          action_type: "coverwhale_api",
          description: `Cover Whale bind requested — Submission #${submissionNumber}`,
        });
      }
      
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ error: "Invalid action. Use: quote, indication, submission-status, bind" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err: any) {
    console.error("CoverWhale API error:", err);
    const status = err.status || 500;
    const errorData = err.data || { error: err.message || "Internal server error" };
    return new Response(JSON.stringify(errorData), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
