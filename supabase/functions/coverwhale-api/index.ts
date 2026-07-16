import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// ============================================================================
// TruckShield ↔ Cover Whale API Integration  (v2 – 2026-04)
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CWCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

interface QuoteResult {
  success: boolean;
  status?: string;
  submission_number?: string;
  quote_pdf?: string;
  coverages?: Record<string, any>;
  raw?: any;
  error?: string;
  details?: any;
}

// ---------------------------------------------------------------------------
// Token cache (in-memory, per isolate)
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiry = 0; // unix ms

// Safety margin: refresh 5 minutes before the API-reported expiry
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readSharedToken(): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("coverwhale_token_cache")
      .select("access_token, expires_at")
      .eq("id", 1)
      .maybeSingle();
    if (!data?.access_token || !data?.expires_at) return null;
    return { token: data.access_token, expiresAt: new Date(data.expires_at).getTime() };
  } catch (err) {
    console.warn("[CW] readSharedToken failed:", (err as Error).message);
    return null;
  }
}

async function writeSharedToken(token: string, expiresAt: number): Promise<void> {
  try {
    const admin = getAdminClient();
    await admin
      .from("coverwhale_token_cache")
      .upsert({ id: 1, access_token: token, expires_at: new Date(expiresAt).toISOString(), updated_at: new Date().toISOString() });
  } catch (err) {
    console.warn("[CW] writeSharedToken failed:", (err as Error).message);
  }
}

async function clearSharedToken(): Promise<void> {
  cachedToken = null;
  tokenExpiry = 0;
  try {
    const admin = getAdminClient();
    await admin.from("coverwhale_token_cache").delete().eq("id", 1);
  } catch (err) {
    console.warn("[CW] clearSharedToken failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function getCWCredentials(): CWCredentials {
  const baseUrl = Deno.env.get("CW_BASE_URL");
  const username = Deno.env.get("CW_USERNAME");
  const password = Deno.env.get("CW_PASSWORD");
  if (!baseUrl || !username || !password) {
    throw new Error(
      "Cover Whale API credentials not configured. Please add CW_BASE_URL, CW_USERNAME, and CW_PASSWORD secrets.",
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), username, password };
}

// ---------------------------------------------------------------------------
// Authentication (with caching)
// ---------------------------------------------------------------------------

async function getAccessToken(creds: CWCredentials, forceRefresh = false): Promise<string> {
  const now = Date.now();

  // 1) In-memory cache (per isolate)
  if (!forceRefresh && cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  // 2) Shared DB cache (across isolates)
  if (!forceRefresh) {
    const shared = await readSharedToken();
    if (shared && now < shared.expiresAt) {
      cachedToken = shared.token;
      tokenExpiry = shared.expiresAt;
      return shared.token;
    }
  }

  // 3) Authenticate against Cover Whale
  console.log("[CW] Authenticating…");
  const res = await fetch(`${creds.baseUrl}/authentication`, {
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

  // Use ExpiresIn (seconds) from the auth response, minus a safety margin.
  const expiresInSec = Number(data.ExpiresIn) > 0 ? Number(data.ExpiresIn) : 3600;
  const expiresAt = Date.now() + expiresInSec * 1000 - TOKEN_SAFETY_MARGIN_MS;

  cachedToken = data.AccessToken;
  tokenExpiry = expiresAt;
  await writeSharedToken(data.AccessToken, expiresAt);
  console.log(`[CW] Authenticated successfully (expires in ${expiresInSec}s)`);
  return data.AccessToken;
}

// ---------------------------------------------------------------------------
// HTTP helper with retry
// ---------------------------------------------------------------------------

async function cwFetch(
  creds: CWCredentials,
  path: string,
  method: string,
  body?: unknown,
  retries = 2,
): Promise<any> {
  const url = `${creds.baseUrl}${path}`;
  let reauthed = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = await getAccessToken(creds);
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        AccessToken: token,
      },
    };
    if (body && (method === "POST" || method === "PUT")) {
      opts.body = JSON.stringify(body);
    }

    try {
      console.log(`[CW] ${method} ${path} (attempt ${attempt + 1})`);
      const res = await fetch(url, opts);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        // 401 → cached token is stale/invalidated. Clear and re-auth once.
        if (res.status === 401 && !reauthed) {
          console.warn("[CW] 401 – clearing cached token and re-authenticating");
          reauthed = true;
          await clearSharedToken();
          await getAccessToken(creds, true);
          continue;
        }
        // Don't retry other client errors (4xx) except 429
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw { status: res.status, data: json };
        }
        // Retry on 429 or 5xx
        if (attempt < retries) {
          const delay = res.status === 429 ? 3000 : 1000 * (attempt + 1);
          console.warn(`[CW] ${res.status} – retrying in ${delay}ms…`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw { status: res.status, data: json };
      }

      return json;
    } catch (err: any) {
      if (err.status) throw err; // already structured
      if (attempt < retries) {
        console.warn(`[CW] Network error – retrying… ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Unavailable-state guard
// ---------------------------------------------------------------------------

// Updated April 2026 – only current "Pending" states
const PENDING_STATES = new Set(["AK", "HI", "KS", "MA", "NY"]);

function guardState(state: string | null): string | null {
  if (!state) return null;
  const upper = state.toUpperCase().trim();
  if (PENDING_STATES.has(upper)) {
    return `Cover Whale coverage is not yet available in this state (Pending). Pending states: ${[...PENDING_STATES].join(", ")}.`;
  }
  return null;
}

// ============================================================================
// Data mapping helpers
// ============================================================================

function mapCoverageSelections(cs: any) {
  const hasAL = !!(cs?.auto_liability || cs?.primary_bipd);
  const hasAPD = !!(cs?.auto_physical_damage || cs?.physical_damage);
  const hasMTC = !!(cs?.motor_truck_cargo || cs?.cargo_liability);
  // Support both { general_liability: true } and { general_liability: { enabled: true } }
  const hasTGL = !!(cs?.truckers_general_liability || cs?.general_liability === true || cs?.general_liability?.enabled);
  const hasNTL = !!(cs?.non_trucking_liability === true || cs?.non_trucking_liability?.enabled || cs?.bobtail_liability === true || cs?.bobtail_liability?.enabled);
  const anyRequested = hasAL || hasAPD || hasMTC || hasTGL || hasNTL;

  return {
    requestAl: hasAL || !anyRequested ? "Y" : "N",
    optAlPip: cs?.pip?.enabled || cs?.pip === true ? "Y" : "N",
    optAlUm: cs?.um_uim?.enabled || cs?.um_bi ? "Y" : "N",
    requestApd: hasAPD ? "Y" : "N",
    requestMtc: hasMTC ? "Y" : "N",
    requestTgl: hasTGL ? "Y" : "N",
    requestNtl: hasNTL ? "Y" : "N",
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

function fmtDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function mapGvwToClass(gvw: string | null): string {
  if (!gvw) return "8";
  const g = gvw.toLowerCase().replace(/[^0-9a-z]/g, "");
  for (const c of ["2a", "2b", "3", "4", "5", "6", "7"]) {
    if (g.includes(c) || g === c) return c;
  }
  return "8";
}

function mapTruckTypeToBody(tt: string | null, _gvw: string | null): string {
  if (!tt) return "tractor";
  const l = tt.toLowerCase();
  if (l.includes("tractor")) return "tractor";
  if (l.includes("box")) return "box_truck";
  if (l.includes("dump")) return "dump_trucks";
  if (l.includes("pick")) return "pick-up_trucks_suv_or_service_trucks";
  if (l.includes("tow")) return "tow_trucks";
  if (l.includes("cement")) return "cement_trucks";
  if (l.includes("garbage") || l.includes("refuse")) return "garbage_trucks";
  if (l.includes("logging")) return "logging_trucks";
  if (l.includes("straight") || l.includes("flatbed") || l.includes("stake")) return "straight_truck";
  return "tractor";
}

function mapTrailerType(tt: string | null): string {
  if (!tt) return "dry_van_trailer";
  const l = tt.toLowerCase();
  const map: [string, string][] = [
    ["dry van", "dry_van_trailer"],
    ["flatbed", "flat_bed_trailer"],
    ["flat bed", "flat_bed_trailer"],
    ["refriger", "refrigeration_trailer"],
    ["reefer", "refrigeration_trailer"],
    ["auto", "auto_hauler_trailers"],
    ["car", "auto_hauler_trailers"],
    ["curtain", "curtain_van_trailer"],
    ["livestock", "livestock_trailer"],
    ["tanker", "tank_trailer"],
    ["tank", "tank_trailer"],
    ["liquid", "tank_trailer"],
    ["bulk", "hopper_trailer"],
    ["hopper", "hopper_trailer"],
    ["pneumatic", "pneumatic_trailer"],
    ["double", "double_trailers"],
    ["triple", "triple_trailers"],
  ];
  for (const [k, v] of map) {
    if (l.includes(k)) return v;
  }
  return "dry_van_trailer";
}

// ---------------------------------------------------------------------------
// Commodities
// ---------------------------------------------------------------------------

const COMMODITY_MAP: Record<string, string> = {
  "general freight": "general_merchandise",
  "agricultural/farm supplies": "farm_products",
  beverages: "beverages",
  "building materials": "building_materials",
  chemicals: "chemicals_packaged_or_bulk",
  "coal/coke": "coal",
  construction: "building_materials",
  "fresh produce": "produce",
  "garbage/refuse": "refuse_garbage",
  "grain, feed, hay": "grain_hay_feed",
  "household goods": "household_goods",
  "liquids/gases": "liquid_haulers",
  livestock: "livestock_and_live_poultry",
  "logs, poles, beams, lumber": "lumber",
  "machinery, large objects": "machinery_and_heavy_equipment",
  meat: "meat",
  "metal: sheets, coils, rolls": "metal_and steel",
  "mobile homes": "mobile_homes",
  "motor vehicles": "automobiles_or_motorcycles",
  "oilfield equipment": "machinery_and_heavy_equipment",
  "paper products": "paper_and_paper_products",
  "refrigerated food": "frozen_or_refrigerated",
  "dirt / sand / gravel": "cement_sand_or_gravel",
  other: "general_merchandise",
};

function mapCommodities(ci: any): { commodities: any[]; refrigeration: string } {
  const commodities: any[] = [];
  let refrigeration = "N";

  if (ci?.selected_commodities && typeof ci.selected_commodities === "object") {
    for (const [name, pct] of Object.entries(ci.selected_commodities)) {
      const key = COMMODITY_MAP[name.toLowerCase()] || "general_merchandise";
      commodities.push({ commodityKey: key, commodityPercentage: String(pct) });
      if (name.toLowerCase().includes("refriger")) refrigeration = "Y";
    }
  }

  if (commodities.length === 0) {
    commodities.push({ commodityKey: "general_merchandise", commodityPercentage: "100" });
  }

  // Validate totals = 100
  const total = commodities.reduce((s: number, c: any) => s + Number(c.commodityPercentage || 0), 0);
  if (total !== 100 && commodities.length > 0) {
    // Normalise proportionally
    const factor = 100 / (total || 1);
    let running = 0;
    for (let i = 0; i < commodities.length - 1; i++) {
      const val = Math.round(Number(commodities[i].commodityPercentage) * factor);
      commodities[i].commodityPercentage = String(val);
      running += val;
    }
    commodities[commodities.length - 1].commodityPercentage = String(100 - running);
  }

  return { commodities, refrigeration };
}

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

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

  const total =
    parseInt(radius.radius0_50) +
    parseInt(radius.radius51_200) +
    parseInt(radius.radius201_500) +
    parseInt(radius.radius501);
  if (total === 0) radius.radius51_200 = "100";

  return radius;
}

// ---------------------------------------------------------------------------
// Loss history
// ---------------------------------------------------------------------------

function mapLossHistory(lh: any[]): any {
  const emptyYear = () => ({
    lossConfirmed: "Y",
    lossAlCount: 0, lossAlPaid: 0,
    lossApdCount: 0, lossApdPaid: 0,
    lossMtcCount: 0, lossMtcPaid: 0,
    lossTglCount: 0, lossTglPaid: 0,
    lossNtlCount: 0, lossNtlPaid: 0,
  });

  const losses: any = {};
  if (!lh || lh.length === 0) {
    losses["1"] = { ...emptyYear(), ...stringifyLossYear(emptyYear()) };
    return losses;
  }

  const yearData: Record<string, ReturnType<typeof emptyYear>> = {};
  for (const entry of lh) {
    const terms = entry.policy_terms as any[];
    if (!Array.isArray(terms)) continue;
    for (const term of terms) {
      const year = term.year || "1";
      if (!yearData[year]) yearData[year] = emptyYear();
      const ct = (entry.coverage_type || "").toLowerCase();
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
    losses[String(i + 1)] = stringifyLossYear(yearData[keys[i]]);
  }

  if (Object.keys(losses).length === 0) {
    losses["1"] = stringifyLossYear(emptyYear());
  }
  return losses;
}

function stringifyLossYear(d: any) {
  return {
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

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

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

  if (gq) {
    if (gq.prior_cancelled) ops.priorInsuranceCancelledNonrenewed = "Y";
    if (gq.bankruptcies) ops.bankruptcies = "Y";
    if (gq.personal_use) ops.personalUseOfVehicle = "Y";
  }

  const combined = [...(account.business_categories || []), ...(account.cargo_types || [])];
  for (const c of combined) {
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

// ============================================================================
// Build full quote payload
// ============================================================================

async function buildQuotePayload(supabase: any, accountId: string) {
  // Fetch all related data in parallel
  const [accountRes, driversRes, powerUnitsRes, trailersRes, lossHistoryRes, garageRes] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("id", accountId).single(),
      supabase.from("drivers").select("*").eq("account_id", accountId).order("sort_order"),
      supabase.from("power_units").select("*").eq("account_id", accountId).order("sort_order"),
      supabase.from("trailers").select("*").eq("account_id", accountId).order("sort_order"),
      supabase.from("loss_history").select("*").eq("account_id", accountId),
      supabase.from("garage_locations").select("*").eq("account_id", accountId).order("sort_order"),
    ]);

  if (accountRes.error) throw new Error(`Failed to fetch account: ${accountRes.error.message}`);
  const account = accountRes.data;
  const drivers = driversRes.data || [];
  const powerUnits = powerUnitsRes.data || [];
  const trailers = trailersRes.data || [];
  const lossHistory = lossHistoryRes.data || [];
  const garages = garageRes.data || [];

  // ---- State guard ----
  const principalGarage = garages.find((g: any) => g.is_principal) || garages[0];
  const garageState = principalGarage?.state || account.mailing_state || null;
  const stateErr = guardState(garageState);
  if (stateErr) throw new Error(stateErr);

  // ---- Validation: at least 1 vehicle & 1 driver ----
  if (powerUnits.length === 0) {
    throw new Error("No power units found. At least one vehicle is required for a Cover Whale quote.");
  }
  if (drivers.length === 0) {
    throw new Error("No drivers found. At least one driver is required for a Cover Whale quote.");
  }

  // ---- Duplicate VIN check ----
  const vins = powerUnits.map((pu: any) => pu.vin).filter(Boolean);
  const trailerVins = trailers.filter((t: any) => !t.is_nonowned).map((t: any) => t.vin).filter(Boolean);
  const allVins = [...vins, ...trailerVins];
  const vinSet = new Set(allVins);
  if (vinSet.size < allVins.length) {
    throw new Error("Duplicate VINs detected. Each vehicle/trailer must have a unique VIN.");
  }

  const cs = account.coverage_selections || {};
  const ci = account.commodity_info || {};
  const gq = account.general_questions || {};
  const ro = account.radius_operations;

  // Owner name
  const ownerName = account.business_owner_name || account.company_name;
  const ownerParts = ownerName.split(" ");
  const ownerFirst = ownerParts[0] || "Owner";
  const ownerLast = ownerParts.slice(1).join(" ") || ownerFirst;

  // Truck / trailer values
  const totalTruckValue = powerUnits.reduce(
    (sum: number, pu: any) => sum + (Number(pu.physdam_amount) || 0),
    0,
  );
  const totalTrailerValue = trailers.reduce(
    (sum: number, t: any) => sum + (Number(t.physdam_amount) || 0),
    0,
  );

  const { commodities, refrigeration } = mapCommodities(ci);

  // ---- Effective date (today or later) ----
  let effDate = account.requested_effective_date
    ? new Date(account.requested_effective_date + "T00:00:00")
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!effDate || effDate < today) effDate = today;
  const effDateStr = `${String(effDate.getMonth() + 1).padStart(2, "0")}/${String(effDate.getDate()).padStart(2, "0")}/${effDate.getFullYear()}`;

  // ---- Garage / mailing / shipping addresses ----
  const garageAddr = principalGarage
    ? {
        garageStreet: principalGarage.address || account.mailing_address || "",
        garageCity: principalGarage.city || account.mailing_city || "",
        garageState: principalGarage.state || account.mailing_state || "",
        garageZip: principalGarage.zip || account.mailing_zip || "",
        garageCounty: principalGarage.county || account.county || "Unknown",
        garageCountry: "US",
      }
    : {
        garageStreet: account.mailing_address || "",
        garageCity: account.mailing_city || "",
        garageState: account.mailing_state || "",
        garageZip: account.mailing_zip || "",
        garageCounty: account.county || "Unknown",
        garageCountry: "US",
      };

  const mailingAddr = {
    mailingStreet: account.mailing_address || "",
    mailingCity: account.mailing_city || "",
    mailingState: account.mailing_state || "",
    mailingZip: account.mailing_zip || "",
    mailingCounty: account.county || account.mailing_city || "Unknown",
    mailingCountry: "US",
  };

  // Shipping defaults to mailing
  const shippingAddr = {
    shippingStreet: account.mailing_address || "",
    shippingCity: account.mailing_city || "",
    shippingState: account.mailing_state || "",
    shippingZip: account.mailing_zip || "",
    shippingCounty: account.county || account.mailing_city || "Unknown",
    shippingCountry: "US",
  };

  // ---- Terminals ----
  const terminals =
    garages.length > 0
      ? garages.map((g: any) => ({
          terminalStreet: g.address || account.mailing_address || "",
          terminalCity: g.city || account.mailing_city || "",
          terminalState: g.state || account.mailing_state || "",
          terminalZip: g.zip || account.mailing_zip || "",
          terminalCounty: g.county || account.county || "Unknown",
        }))
      : [
          {
            terminalStreet: account.mailing_address || "",
            terminalCity: account.mailing_city || "",
            terminalState: account.mailing_state || "",
            terminalZip: account.mailing_zip || "",
            terminalCounty: account.county || "Unknown",
          },
        ];

  // ---- Build payload ----
  const payload: any = {
    coverage: {
      ...mapCoverageSelections(cs),
      effectiveDate: effDateStr,
    },
    insuredInformation: {
      entityType: mapEntityType(account.business_type),
      dotNumber: account.dot_number ? parseInt(account.dot_number) : 0,
      email: account.contact_email || "noemail@placeholder.com",
      legalName: account.company_name,
      dbaName: account.dba_name || account.company_name,
      ownerName,
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
    garageAddress: garageAddr,
    mailingAddress: mailingAddr,
    shippingAddress: shippingAddr,
    radius: mapRadius(ro),
    commoditiesRefrigeration: refrigeration,
    commodities,
    terminals,
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
    trailers: trailers
      .filter((t: any) => !t.is_nonowned)
      .map((t: any) => ({
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
      dateOfBirth: fmtDate(d.date_of_birth),
      dateOfHire:
        d.date_hired_month && d.date_hired_year
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
      FirstName: "Bret",
      LastName: "Fair",
      Phone: 8888854144,
      Email: "integrations@360riskpartners.com",
      AgencyName: "360 Risk Partners Insurance Solutions, Inc.",
      Street: "1101 Fulton Ave Ste 204",
      City: "Sacramento",
      State: "CA",
      Zip: "95825",
    },
    additionalInsured: [],
  };

  console.log("[CW] Payload built:", JSON.stringify(payload, null, 2).slice(0, 2000));
  return { payload, account };
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- Auth check ----
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

    // Staff check
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

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action'. Use: quote, indication, submission-status, bind, pdf-proxy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ==== PDF PROXY ====
    // Streams a Cover Whale S3-hosted PDF back through our origin. Solves two
    // problems: (1) browser ad-blockers that block *.s3.amazonaws.com hosts
    // containing "submission", and (2) Cover Whale's pre-signed URLs expire
    // after 5 minutes, so we always fetch a fresh URL from the submission
    // endpoint before streaming.
    if (action === "pdf-proxy") {
      let pdfUrl: string | undefined = body.pdfUrl;

      // If we have a submissionNumber, always refetch a fresh signed URL
      if (submissionNumber) {
        const creds = getCWCredentials();
        try {
          const sub = await cwFetch(creds, `/submission/${submissionNumber}`, "GET");
          const fresh =
            sub?.quote_pdf ||
            sub?.QuoteDocumentURL ||
            sub?.quoteDocumentURL ||
            sub?.documentURL ||
            sub?.pdf_url ||
            sub?.quotePDF ||
            null;
          if (fresh) {
            pdfUrl = fresh;
            // Persist the new URL for reference (will expire again in 5 min)
            await supabase
              .from("coverwhale_submissions")
              .update({ quote_pdf_url: fresh })
              .eq("submission_number", submissionNumber);
          }
        } catch (e) {
          console.error("[CW] Failed to refresh PDF URL:", e);
        }
      }

      if (!pdfUrl) {
        return new Response(JSON.stringify({ error: "No PDF URL available for this submission" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let parsed: URL;
      try {
        parsed = new URL(pdfUrl);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid pdfUrl" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only allow Cover Whale S3 hosts
      if (!/(^|\.)s3[.-].*amazonaws\.com$/.test(parsed.hostname) && !parsed.hostname.endsWith(".amazonaws.com")) {
        return new Response(JSON.stringify({ error: "Host not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const upstream = await fetch(pdfUrl);
      if (!upstream.ok) {
        const text = await upstream.text();
        return new Response(
          JSON.stringify({
            error: "Failed to fetch PDF (the pre-signed link may have expired). Try refreshing status.",
            status: upstream.status,
            details: text,
          }),
          { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const buf = await upstream.arrayBuffer();
      return new Response(buf, {
        headers: {
          ...corsHeaders,
          "Content-Type": upstream.headers.get("Content-Type") || "application/pdf",
          "Content-Disposition": `inline; filename="coverwhale-quote.pdf"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const creds = getCWCredentials();

    // ==== QUOTE / INDICATION ====
    if (action === "quote" || action === "indication") {
      if (!accountId) {
        return new Response(JSON.stringify({ error: "accountId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { payload, account } = await buildQuotePayload(supabase, accountId);
      const endpoint = action === "quote" ? "/quote" : "/indication";

      console.log(`[CW] Sending ${action} for account ${accountId}`);
      const result = await cwFetch(creds, endpoint, "POST", payload);
      console.log(`[CW] Response:`, JSON.stringify(result).slice(0, 1500));

      // ---- Persist results ----
      const { data: cwCarrier } = await supabase
        .from("carriers")
        .select("id")
        .ilike("name", "%cover whale%")
        .single();

      const totalPremium = result.coverages
        ? Object.values(result.coverages)
            .filter((c: any) => c != null)
            .reduce((sum: number, c: any) => sum + (c?.totalCost || c?.premium || 0), 0)
        : null;

      let quoteId: string | null = null;

      if (result.submission_number && cwCarrier) {
        const { data: existing } = await supabase
          .from("quotes")
          .select("id")
          .eq("account_id", accountId)
          .eq("carrier_id", cwCarrier.id)
          .single();

        const quoteFields = {
          status: result.status?.toLowerCase() === "quoted" ? "quoted" : "submitted",
          premium_estimate: totalPremium,
          coverage_details: { cw_coverages: result.coverages, cw_quote_pdf: result.quote_pdf },
          published_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from("quotes").update(quoteFields).eq("id", existing.id);
          quoteId = existing.id;
        } else {
          const { data: newQuote } = await supabase
            .from("quotes")
            .insert({
              account_id: accountId,
              carrier_id: cwCarrier.id,
              created_by: userId,
              match_score: null,
              ...quoteFields,
            })
            .select("id")
            .single();
          quoteId = newQuote?.id || null;
        }
      }

      if (result.submission_number) {
        const { data: existingSub } = await supabase
          .from("coverwhale_submissions")
          .select("id")
          .eq("account_id", accountId)
          .eq("submission_number", result.submission_number)
          .single();

        const subFields = {
          status: result.status || "quoted",
          quote_pdf_url: result.quote_pdf || null,
          coverages_data: result.coverages || {},
          total_premium: totalPremium,
          api_response: result,
          quote_id: quoteId,
        };

        if (existingSub) {
          await supabase.from("coverwhale_submissions").update(subFields).eq("id", existingSub.id);
        } else {
          await supabase.from("coverwhale_submissions").insert({
            account_id: accountId,
            submission_number: result.submission_number,
            ...subFields,
          });
        }

        // Activity log
        const premiumStr = totalPremium ? ` — Total premium: $${totalPremium.toLocaleString()}` : "";
        await supabase.from("activity_log").insert({
          account_id: accountId,
          user_id: userId,
          action_type: "coverwhale_api",
          description: `Cover Whale ${action} received — Submission #${result.submission_number}${premiumStr}`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ==== SUBMISSION STATUS ====
    if (action === "submission-status") {
      if (!submissionNumber) {
        return new Response(JSON.stringify({ error: "submissionNumber is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await cwFetch(creds, `/submission/${submissionNumber}`, "GET");

      await supabase
        .from("coverwhale_submissions")
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

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ==== BIND ====
    if (action === "bind") {
      if (!submissionNumber || !bindData) {
        return new Response(
          JSON.stringify({ error: "submissionNumber and bindData are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await cwFetch(
        creds,
        `/bind/${submissionNumber}`,
        "PUT",
        bindData,
      );

      await supabase
        .from("coverwhale_submissions")
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

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ==== UNKNOWN ACTION ====
    return new Response(
      JSON.stringify({ error: "Invalid action. Use: quote, indication, submission-status, bind" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[CW] Error:", err);
    const status = err.status || 500;
    const errorData = err.data || { error: err.message || "Internal server error" };
    return new Response(
      JSON.stringify({ success: false, error: errorData.error || errorData.message || err.message, details: errorData }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
