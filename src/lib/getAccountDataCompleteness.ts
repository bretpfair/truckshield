import { supabase } from "@/integrations/supabase/client";

export interface AccountCompletenessInput {
  account: any;
  powerUnits?: any[];
  drivers?: any[];
  lossHistory?: any[];
}

export interface AccountCompletenessResult {
  ready: boolean;
  missing: string[];
  emptyApplication: boolean;
}

const percentTotal = (values: Record<string, unknown>) =>
  Object.values(values).reduce((sum, value) => sum + (parseFloat(String(value)) || 0), 0);

const hasCompleteRadius = (account: any) => {
  const radiusRow = (account?.radius_operations as any)?.[0] || {};
  const details = radiusRow.radius_details || {};
  const total = ["under_50", "51_200", "201_500", "500_plus"].reduce(
    (sum, key) => sum + (parseFloat(String(details[key])) || 0),
    0,
  );
  return Boolean(radiusRow.operation_type && radiusRow.annual_mileage && total === 100);
};

const hasCompleteCommodities = (account: any) => {
  const selected = (account?.commodity_info as any)?.selected_commodities || {};
  return Object.keys(selected).length > 0 && percentTotal(selected) === 100;
};

const hasApplicantInfo = (account: any) => {
  const gq = (account?.general_questions || {}) as any;
  const isNewVenture = Boolean(gq.new_venture);

  return Boolean(
    account?.requested_effective_date &&
      account?.dot_number &&
      account?.company_name &&
      account?.ein_tax_id &&
      account?.business_type &&
      account?.business_owner_name &&
      account?.business_owner_dob &&
      account?.contact_email &&
      account?.contact_phone &&
      account?.mailing_address &&
      account?.mailing_city &&
      account?.mailing_state &&
      account?.mailing_zip &&
      account?.years_in_business != null &&
      (account?.current_coverage_expiry || isNewVenture) &&
      (account?.business_categories || []).length > 0 &&
      account?.total_trucks != null &&
      account?.total_drivers != null,
  );
};

const hasCoverageLimits = (account: any) => {
  const coverage = (account?.coverage_selections || {}) as any;
  return Boolean(coverage.primary_bipd && coverage.icc_filing && coverage.state_filing);
};

const hasPowerUnits = (powerUnits: any[] = []) =>
  powerUnits.length > 0 &&
  powerUnits.every(
    (unit) =>
      unit.vin &&
      unit.year &&
      unit.make &&
      unit.truck_type &&
      unit.gvw_class &&
      unit.garage_zip &&
      unit.titled_state,
  );

const hasDrivers = (drivers: any[] = []) =>
  drivers.length > 0 &&
  drivers.every(
    (driver) =>
      driver.first_name &&
      driver.last_name &&
      driver.date_of_birth &&
      driver.license_number &&
      driver.license_state &&
      driver.license_type &&
      driver.driver_type &&
      driver.original_issue_year &&
      driver.date_hired_year &&
      driver.experience_years != null,
  );

const hasLossHistory = (account: any, lossHistory: any[] = []) => {
  const gq = (account?.general_questions || {}) as any;
  return lossHistory.length > 0 || Boolean(gq.new_venture);
};

export function getAccountDataCompleteness({
  account,
  powerUnits = [],
  drivers = [],
  lossHistory = [],
}: AccountCompletenessInput): AccountCompletenessResult {
  const missing: string[] = [];

  if (!hasApplicantInfo(account)) missing.push("Applicant info");
  if (!hasCoverageLimits(account)) missing.push("Coverage limits");
  if (!hasCompleteRadius(account)) missing.push("Radius distribution (must total 100%)");
  if (!hasCompleteCommodities(account)) missing.push("Commodities (must total 100%)");
  if (!hasPowerUnits(powerUnits)) missing.push("Power Units (>=1)");
  if (!hasDrivers(drivers)) missing.push("Drivers (>=1)");
  if (!hasLossHistory(account, lossHistory)) missing.push("Loss history");

  const emptyApplication =
    powerUnits.length === 0 &&
    Object.keys(((account?.commodity_info as any)?.selected_commodities || {}) as Record<string, unknown>).length === 0 &&
    !((account?.radius_operations as any)?.[0]?.radius_details);

  return {
    ready: missing.length === 0,
    missing,
    emptyApplication,
  };
}

export async function getAccountDataCompletenessById(accountId: string) {
  const [{ data: account, error: accountError }, { data: powerUnits }, { data: drivers }, { data: lossHistory }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("id", accountId).single(),
      supabase.from("power_units").select("*").eq("account_id", accountId),
      supabase.from("drivers").select("*").eq("account_id", accountId),
      supabase.from("loss_history").select("*").eq("account_id", accountId),
    ]);

  if (accountError) throw accountError;

  return getAccountDataCompleteness({
    account,
    powerUnits: powerUnits || [],
    drivers: drivers || [],
    lossHistory: lossHistory || [],
  });
}
