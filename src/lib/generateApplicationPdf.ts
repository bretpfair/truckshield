import jsPDF from "jspdf";

interface PdfData {
  account: any;
  drivers: any[];
  powerUnits: any[];
  trailers: any[];
  lossHistory: any[];
  garageLocations: any[];
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5.5;
const SECTION_GAP = 8;

export function generateApplicationPdf({
  account,
  drivers,
  powerUnits,
  trailers,
  lossHistory,
  garageLocations,
}: PdfData) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = MARGIN;

  const checkPage = (needed = 20) => {
    if (y + needed > 260) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const sectionTitle = (title: string) => {
    checkPage(15);
    y += SECTION_GAP;
    doc.setFillColor(30, 58, 95);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), MARGIN + 3, y + 5);
    doc.setTextColor(30, 30, 30);
    y += 10;
  };

  const fieldRow = (label: string, value: string | null | undefined) => {
    checkPage(7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", MARGIN + 2, y);
    doc.setFont("helvetica", "normal");
    const val = value ?? "—";
    const lines = doc.splitTextToSize(val, CONTENT_WIDTH - 55);
    doc.text(lines, MARGIN + 55, y);
    y += Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);
  };

  const fieldRowWide = (label: string, value: string | null | undefined) => {
    checkPage(12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", MARGIN + 2, y);
    y += LINE_HEIGHT;
    doc.setFont("helvetica", "normal");
    const val = value ?? "—";
    const lines = doc.splitTextToSize(val, CONTENT_WIDTH - 4);
    doc.text(lines, MARGIN + 4, y);
    y += lines.length * LINE_HEIGHT;
  };

  // ====== HEADER ======
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Commercial Trucking Insurance Application", MARGIN, y + 2);
  y += 8;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, MARGIN, y);
  y += 2;
  doc.setTextColor(30, 30, 30);

  // ====== 1. APPLICANT INFORMATION ======
  sectionTitle("1. Applicant Information");
  fieldRow("Company Name", account.company_name);
  fieldRow("DBA Name", account.dba_name);
  fieldRow("Business Type", account.business_type);
  fieldRow("Business Categories", account.business_categories?.join(", "));
  fieldRow("Contractor Types", account.contractor_types?.join(", "));
  fieldRow("EIN / Tax ID", account.ein_tax_id);
  fieldRow("DOT Number", account.dot_number);
  fieldRow("MC Number", account.mc_number);
  fieldRow("Carrier Authority", [account.carrier_authority_prefix, account.carrier_authority_number].filter(Boolean).join(" "));
  fieldRow("Date of Authority", account.date_of_authority);
  fieldRow("Years in Business", account.years_in_business?.toString());
  fieldRow("Business Owner", account.business_owner_name);
  fieldRow("Owner DOB", account.business_owner_dob);

  // Mailing address
  const addr = [account.mailing_address, account.mailing_city, account.mailing_state, account.mailing_zip].filter(Boolean).join(", ");
  fieldRow("Mailing Address", addr || null);
  fieldRow("County", account.county);
  fieldRow("Requested Effective Date", account.requested_effective_date);
  fieldRow("Current Coverage Expiry", account.current_coverage_expiry);

  // ====== 2. COVERAGE SELECTIONS ======
  sectionTitle("2. Coverage Selections");
  const coverages = account.coverage_selections as any;
  if (coverages && typeof coverages === "object") {
    Object.entries(coverages).forEach(([key, val]: [string, any]) => {
      if (typeof val === "object" && val !== null) {
        const parts: string[] = [];
        if (val.enabled === false) {
          parts.push("Not Selected");
        } else {
          Object.entries(val).forEach(([k, v]) => {
            if (k !== "enabled") parts.push(`${formatLabel(k)}: ${v}`);
          });
        }
        fieldRow(formatLabel(key), parts.join(" | ") || "Selected");
      } else {
        fieldRow(formatLabel(key), String(val));
      }
    });
  } else {
    fieldRow("Coverage Selections", "None specified");
  }

  // ====== 3. RADIUS OF OPERATIONS ======
  sectionTitle("3. Radius of Operations");
  const radiusOps = account.radius_operations as any[];
  if (radiusOps && Array.isArray(radiusOps) && radiusOps.length > 0) {
    radiusOps.forEach((r: any, idx: number) => {
      if (radiusOps.length > 1) {
        checkPage(7);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bolditalic");
        doc.text(`Operation ${idx + 1}`, MARGIN + 2, y);
        y += LINE_HEIGHT;
      }
      fieldRow("Operation Type", r.operation_type);
      fieldRow("Annual Mileage", r.annual_mileage);
      if (r.radius_details && typeof r.radius_details === "object") {
        const rd = r.radius_details;
        if (rd.under_50) fieldRow("Under 50 miles", rd.under_50 + "%");
        if (rd["51_200"]) fieldRow("51-200 miles", rd["51_200"] + "%");
        if (rd["201_500"]) fieldRow("201-500 miles", rd["201_500"] + "%");
        if (rd["500_plus"]) fieldRow("500+ miles", rd["500_plus"] + "%");
      }
    });
  } else {
    fieldRow("Radius Operations", "None specified");
  }

  // ====== 4. COMMODITIES ======
  sectionTitle("4. Commodities / Cargo");
  fieldRow("Cargo Types", account.cargo_types?.join(", "));
  const commodity = account.commodity_info as any;
  if (commodity && typeof commodity === "object") {
    Object.entries(commodity).forEach(([key, val]) => {
      fieldRow(formatLabel(key), typeof val === "object" ? JSON.stringify(val) : String(val ?? ""));
    });
  }

  // ====== 5. FINANCIALS ======
  sectionTitle("5. Financial Information");
  fieldRow("Annual Revenue", account.annual_revenue ? `$${Number(account.annual_revenue).toLocaleString()}` : null);
  fieldRow("Total Annual Revenue", account.total_annual_revenue ? `$${Number(account.total_annual_revenue).toLocaleString()}` : null);
  fieldRow("Projected Gross Receipts", account.projected_gross_receipts ? `$${Number(account.projected_gross_receipts).toLocaleString()}` : null);
  fieldRow("Total Subhaul Revenue", account.total_subhaul_revenue ? `$${Number(account.total_subhaul_revenue).toLocaleString()}` : null);

  // ====== 6. FLEET SUMMARY ======
  sectionTitle("6. Fleet Summary");
  fieldRow("Fleet Size", account.fleet_size?.toString());
  fieldRow("Total Trucks", account.total_trucks?.toString());
  fieldRow("Total Drivers", account.total_drivers?.toString());
  fieldRow("Total Owned Trailers", account.total_owned_trailers?.toString());
  fieldRow("Total Non-Owned Trailers", account.total_nonowned_trailers?.toString());
  fieldRow("Garage Locations", account.total_garage_locations?.toString());
  fieldRow("Operating States", account.operating_states?.join(", "));

  // ====== 7. GARAGE LOCATIONS ======
  if (garageLocations.length > 0) {
    sectionTitle("7. Garage Locations");
    garageLocations.forEach((g, idx) => {
      const locAddr = [g.address, g.city, g.state, g.zip].filter(Boolean).join(", ");
      fieldRow(`Location ${idx + 1}${g.is_principal ? " (Principal)" : ""}`, locAddr || "—");
      if (g.county) fieldRow("  County", g.county);
    });
  }

  // ====== 8. POWER UNITS ======
  sectionTitle("8. Power Units");
  if (powerUnits.length === 0) {
    fieldRow("Power Units", "None listed");
  } else {
    // Table header
    checkPage(10);
    drawTableHeader(doc, y, ["#", "Year", "Make", "Model", "Type", "GVW", "VIN", "Ownership"]);
    y += 6;
    powerUnits.forEach((pu, idx) => {
      checkPage(7);
      const row = [
        String(idx + 1),
        pu.year || "—",
        pu.make || "—",
        pu.model || "—",
        pu.truck_type || "—",
        pu.gvw_class || "—",
        pu.vin || "—",
        pu.ownership_type || "—",
      ];
      drawTableRow(doc, y, row, idx % 2 === 0);
      y += 5;
    });
  }

  // ====== 9. TRAILERS ======
  sectionTitle("9. Trailers");
  if (trailers.length === 0) {
    fieldRow("Trailers", "None listed");
  } else {
    checkPage(10);
    drawTableHeader(doc, y, ["#", "Year", "Make", "Model", "Type", "VIN", "Ownership", "Non-Owned"]);
    y += 6;
    trailers.forEach((t, idx) => {
      checkPage(7);
      const row = [
        String(idx + 1),
        t.year || "—",
        t.make || "—",
        t.model || "—",
        t.trailer_type || "—",
        t.vin || "—",
        t.ownership_type || "—",
        t.is_nonowned ? "Yes" : "No",
      ];
      drawTableRow(doc, y, row, idx % 2 === 0);
      y += 5;
    });
  }

  // ====== 10. DRIVERS ======
  sectionTitle("10. Drivers");
  if (drivers.length === 0) {
    fieldRow("Drivers", "None listed");
  } else {
    drivers.forEach((d, idx) => {
      checkPage(30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Driver ${idx + 1}: ${d.first_name || ""} ${d.last_name || ""}`.trim(), MARGIN + 2, y);
      y += LINE_HEIGHT + 1;
      fieldRow("  DOB", d.date_of_birth);
      fieldRow("  License #", d.license_number);
      fieldRow("  License State", d.license_state);
      fieldRow("  License Type", d.license_type);
      fieldRow("  Experience", `${d.experience_years ?? "—"} years ${d.experience_months ? `${d.experience_months} months` : ""}`);
      fieldRow("  Date Hired", d.date_hired_month && d.date_hired_year ? `${d.date_hired_month}/${d.date_hired_year}` : "—");
      fieldRow("  Violations", d.num_violations?.toString());
      fieldRow("  Accidents", d.num_accidents?.toString());
      if (d.lapse_suspension && d.lapse_suspension !== "none") {
        fieldRow("  Lapse/Suspension", d.lapse_suspension);
        if (d.lapse_explanation) fieldRow("  Explanation", d.lapse_explanation);
      }

      // Detail violations
      const violations = d.violations as any[];
      if (violations && Array.isArray(violations) && violations.length > 0) {
        violations.forEach((v: any, vi: number) => {
          checkPage(8);
          fieldRow(`    Violation ${vi + 1}`, `${v.description || v.type || "—"} (${v.date || "—"})`);
        });
      }
      const accidents = d.accidents as any[];
      if (accidents && Array.isArray(accidents) && accidents.length > 0) {
        accidents.forEach((a: any, ai: number) => {
          checkPage(8);
          fieldRow(`    Accident ${ai + 1}`, `${a.description || a.type || "—"} (${a.date || "—"})`);
        });
      }
      y += 2;
    });
  }

  // ====== 11. LOSS HISTORY ======
  sectionTitle("11. Loss History");
  fieldRow("Total Claims", account.number_of_claims?.toString());
  if (account.loss_history_summary) {
    fieldRowWide("Loss History Summary", account.loss_history_summary);
  }
  if (lossHistory.length === 0) {
    fieldRow("Loss History Records", "None");
  } else {
    lossHistory.forEach((lh) => {
      checkPage(20);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${formatLabel(lh.coverage_type)}`, MARGIN + 2, y);
      y += LINE_HEIGHT;
      if (lh.no_prior_coverage) {
        fieldRow("  Prior Coverage", "No Prior Coverage / New Venture");
      } else {
        fieldRow("  Cancelled/Non-Renewed", lh.cancelled_nonrenewed ? "Yes" : "No");
        if (lh.cancelled_nonrenewed && lh.cancellation_reason) {
          fieldRow("  Cancellation Reason", lh.cancellation_reason === "other" ? lh.cancellation_reason_other || "Other" : lh.cancellation_reason);
        }
        // Policy terms
        const terms = lh.policy_terms as any[];
        if (terms && Array.isArray(terms) && terms.length > 0) {
          terms.forEach((term: any) => {
            checkPage(10);
            const label = term.term || term.year || "Term";
            const parts: string[] = [];
            if (term.no_losses) {
              parts.push("No Losses");
            } else {
              if (term.auto_liability_count != null) parts.push(`AL: ${term.auto_liability_count} claims / $${Number(term.auto_liability_paid || 0).toLocaleString()}`);
              if (term.physical_damage_count != null) parts.push(`PD: ${term.physical_damage_count} claims / $${Number(term.physical_damage_paid || 0).toLocaleString()}`);
              if (term.cargo_count != null) parts.push(`Cargo: ${term.cargo_count} claims / $${Number(term.cargo_paid || 0).toLocaleString()}`);
            }
            fieldRow(`  ${label}`, parts.join(" | ") || "—");
          });
        }
      }
      y += 2;
    });
  }

  // ====== 12. GENERAL QUESTIONS ======
  sectionTitle("12. General / Underwriting Questions");
  const gq = account.general_questions as any;
  if (gq && typeof gq === "object") {
    Object.entries(gq).forEach(([key, val]) => {
      fieldRow(formatLabel(key), typeof val === "boolean" ? (val ? "Yes" : "No") : String(val ?? "—"));
    });
  } else {
    fieldRow("General Questions", "None answered");
  }

  // ====== 13. DESCRIPTION OF OPERATIONS ======
  const opInfo = account.operation_info as any;
  if (opInfo?.notes) {
    sectionTitle("13. Description of Operations");
    fieldRowWide("Notes", opInfo.notes);
  }

  // ====== FOOTER on each page ======
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(`${account.company_name} — Application Summary`, MARGIN, 272);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN - 20, 272);
    doc.setTextColor(30, 30, 30);
  }

  doc.save(`${(account.company_name || "Application").replace(/[^a-zA-Z0-9]/g, "_")}_Application.pdf`);
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function drawTableHeader(doc: jsPDF, y: number, cols: string[]) {
  const colWidths = getColWidths(cols.length);
  doc.setFillColor(230, 235, 242);
  doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 5.5, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  let x = MARGIN + 1;
  cols.forEach((col, i) => {
    doc.text(col, x, y);
    x += colWidths[i];
  });
}

function drawTableRow(doc: jsPDF, y: number, cols: string[], shaded: boolean) {
  const colWidths = getColWidths(cols.length);
  if (shaded) {
    doc.setFillColor(247, 249, 252);
    doc.rect(MARGIN, y - 3.5, CONTENT_WIDTH, 5, "F");
  }
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  let x = MARGIN + 1;
  cols.forEach((col, i) => {
    const maxW = colWidths[i] - 1;
    const truncated = doc.getTextWidth(col) > maxW ? col.substring(0, Math.floor(col.length * (maxW / doc.getTextWidth(col)))) : col;
    doc.text(truncated, x, y);
    x += colWidths[i];
  });
}

function getColWidths(count: number): number[] {
  if (count === 8) return [8, 14, 22, 22, 24, 16, 38, 26];
  return Array(count).fill(CONTENT_WIDTH / count);
}
