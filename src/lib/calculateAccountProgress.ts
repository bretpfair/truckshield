/**
 * Pure function to calculate application completion %.
 * Mirrors the logic in useApplicationProgress hook but works without React.
 * Used by PipelineView (client) and can be ported server-side.
 */
export function calculateAccountProgress(
  account: any,
  powerUnits: any[],
  trailers: any[],
  drivers: any[],
  lossHistory: any[],
): { progress: number; completedCount: number; totalSections: number } {
  const formData = account ?? {};
  const gq = (formData.general_questions || {}) as any;
  const cov = (formData.coverage_selections || {}) as any;
  const isNewVenture = !!gq.new_venture;

  const isStep1Complete = !!(
    formData.requested_effective_date &&
    formData.dot_number && formData.company_name &&
    formData.ein_tax_id && formData.business_type &&
    formData.business_owner_name && formData.business_owner_dob &&
    formData.contact_email && formData.contact_phone &&
    formData.mailing_address && formData.mailing_city && formData.mailing_state && formData.mailing_zip &&
    formData.years_in_business != null &&
    (formData.current_coverage_expiry || isNewVenture) &&
    (formData.business_categories || []).length > 0 &&
    formData.total_trucks != null && formData.total_drivers != null
  );

  const isStep2Complete = !!(cov.primary_bipd && cov.icc_filing && cov.state_filing);

  const isStep3Complete = (() => {
    const r = (formData.radius_operations as any)?.[0] || {};
    const details = r.radius_details || {};
    const total = ["under_50", "51_200", "201_500", "500_plus"].reduce(
      (s: number, k: string) => s + (parseFloat(details[k]) || 0), 0
    );
    return !!(r.operation_type && r.annual_mileage && total === 100);
  })();

  const isStep4Complete = (() => {
    const selected = (formData.commodity_info as any)?.selected_commodities || {};
    const total = Object.values(selected).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
    return Object.keys(selected).length > 0 && total === 100;
  })();

  const isStep5Complete = (powerUnits?.length || 0) > 0 &&
    powerUnits.every((u: any) => u.vin && u.year && u.make && u.truck_type && u.gvw_class && u.garage_zip && u.titled_state);

  const isStep6Complete = gq.no_trailers ||
    ((trailers?.length || 0) > 0 && trailers.every((t: any) => t.vin && t.year && t.make && t.trailer_type && t.garage_zip));

  const isStep7Complete = (drivers?.length || 0) > 0 &&
    drivers.every((d: any) =>
      d.first_name && d.last_name && d.date_of_birth &&
      d.license_number && d.license_state && d.license_type && d.driver_type &&
      d.original_issue_year && d.date_hired_year &&
      d.experience_years != null && d.lapse_suspension
    );

  const isStep8Complete = (lossHistory?.length || 0) > 0 || isNewVenture;

  const isStep9Complete = (() => {
    const autoQs = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12","q13","q14","q15","q16","q17"];
    const allAutoAnswered = autoQs.every(qId => {
      const q = gq[qId];
      if (!q) return false;
      if (qId === "q17") return q.value != null && q.value !== "";
      return q.answer === "Yes" || q.answer === "No";
    });
    const hasGL = cov.general_liability && cov.general_liability !== "No Coverage";
    if (hasGL) {
      const glQs = ["gl1","gl2","gl3","gl4","gl5","gl6","gl7"];
      return allAutoAnswered && glQs.every(qId => {
        const q = gq[qId];
        return q && (q.answer === "Yes" || q.answer === "No");
      });
    }
    return allAutoAnswered;
  })();

  const sections = [
    isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete,
    isStep5Complete, isStep6Complete, isStep7Complete, isStep8Complete, isStep9Complete,
  ];

  const completedCount = sections.filter(Boolean).length;
  const totalSections = sections.length;
  const progress = Math.round((completedCount / totalSections) * 100);

  return { progress, completedCount, totalSections };
}
