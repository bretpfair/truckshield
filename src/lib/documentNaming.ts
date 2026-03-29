import { format } from "date-fns";

/**
 * Category labels used in standardized file names.
 * Maps internal category keys to human-readable labels.
 */
const CATEGORY_LABELS: Record<string, string> = {
  loss_runs: "Loss_Run",
  cab_cards: "Cab_Card",
  quotes: "Quote",
  policies: "Policy",
  application: "Application",
  mvr: "MVR",
  drivers_license: "Drivers_License",
  misc: "Document",
};

/**
 * Sanitize a string for use in a file name:
 * - Replace spaces / special chars with underscores
 * - Collapse multiple underscores
 * - Trim leading/trailing underscores
 */
function sanitize(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Build a standardized document file name.
 *
 * Format: [Category]_[CompanyName]_[Date].[ext]
 *
 * @param category  - Internal category key (e.g. "loss_runs", "quotes")
 * @param companyName - The account's company name
 * @param originalFileName - Original uploaded file name (used for extension)
 * @param suffix - Optional extra identifier (e.g. carrier name, unit number)
 */
export function buildDocumentName(
  category: string,
  companyName: string,
  originalFileName: string,
  suffix?: string,
): string {
  const categoryLabel = CATEGORY_LABELS[category] || sanitize(category);
  const company = sanitize(companyName);
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const ext = originalFileName.includes(".")
    ? originalFileName.split(".").pop()!.toLowerCase()
    : "pdf";

  const parts = [categoryLabel, company];
  if (suffix) parts.push(sanitize(suffix));
  parts.push(dateStr);

  return `${parts.join("_")}.${ext}`;
}

/**
 * Build a full storage path: [accountId]/[standardizedName]
 */
export function buildDocumentPath(
  accountId: string,
  category: string,
  companyName: string,
  originalFileName: string,
  suffix?: string,
): string {
  const name = buildDocumentName(category, companyName, originalFileName, suffix);
  // Add timestamp to prevent collisions for same-day re-uploads
  const ts = Date.now();
  const dotIdx = name.lastIndexOf(".");
  const base = name.substring(0, dotIdx);
  const ext = name.substring(dotIdx);
  return `${accountId}/${base}_${ts}${ext}`;
}
