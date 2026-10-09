/**
 * Small, pure formatting helpers shared across screens. Kept side-effect free
 * so they are trivial to reuse from any screen or component.
 */

/**
 * Format a carbon-savings value stored in grams (gCO2e) as a human-readable
 * kilogram string, e.g. `12500` -> "12.5 kg".
 *
 * Returns "0 kg" for null / undefined / zero / NaN so a screen never renders
 * a blank or `NaN` value before any completed transactions exist. Carbon
 * figures are directional estimates — callers are responsible for labelling
 * them as such.
 */
export function formatCarbonKg(grams: number | null | undefined): string {
  if (grams == null || grams === 0 || Number.isNaN(grams)) return "0 kg";
  const kg = grams / 1000;
  return `${kg.toFixed(1)} kg`;
}

/**
 * Format an asking price as Indian Rupees, e.g. `4800` -> "₹4,800".
 *
 * Returns "Free" for null / undefined / zero / NaN — free-donation listings
 * store `asking_price: null` per the OpenAPI contract, and a zero-rupee sale
 * is semantically a donation, so both render as "Free".
 *
 * Uses Indian digit grouping (`en-IN`) to match the price rendering already
 * used by `ListingCard`.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || Number.isNaN(price) || price <= 0) return "Free";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}
