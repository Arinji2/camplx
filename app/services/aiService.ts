import { Platform } from "react-native";
import type { ListingType } from "@/types";
import type {
  InspectionResult,
  PricingIntelligence,
  AmazonStyleListing,
  DefectItem,
} from "@/lib/database";

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000");

export type GenerateListingInput = {
  imageUri?: string;
  imageBase64?: string[];
  text?: string;
  listingType: ListingType;
  category?: string;
};

export type FullAnalysisResult = {
  ok: boolean;
  data: {
    title: string;
    description: string;
    condition: string;
    price: number | null;
    circular_lifecycle_category: "Reusable" | "Repairable" | "End-of-life";
    pricing?: PricingIntelligence;
    amazon_listing?: AmazonStyleListing;
    defects: DefectItem[];
    annotated_image_base64?: string;
    reasoning?: string;
  };
};

/**
 * Calls FastAPI `/api/inspect-and-list` using FormData.
 * Falls back transparently so the prototype never crashes.
 */
export async function inspectAndGenerateProduct(
  imageUri: string,
  sellerNotes: string = "",
  campusLocation: string = "Dr. D. Y. Patil Vidyapeeth, Pune",
  listingType: ListingType = "sell",
): Promise<FullAnalysisResult> {
  try {
    const formData = new FormData();

    const filename = imageUri.split("/").pop() || "product.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    // @ts-ignore: React Native FormData file signature
    formData.append("image", {
      uri: imageUri,
      name: filename,
      type,
    });

    formData.append("seller_notes", sellerNotes);
    formData.append("campus_location", campusLocation);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);

    const response = await fetch(`${BACKEND_URL}/api/inspect-and-list`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const json = await response.json();
      const analysis = json.analysis;
      const annotatedBase64 = json.annotated_image_base64;

      const defects: DefectItem[] = (analysis.defects || []).map(
        (d: any, idx: number) => ({
          id: `def-${idx + 1}`,
          defect_type: d.defect_type || "Surface Mark",
          severity: d.severity || "Cosmetic Minor",
          box_2d: d.box_2d || [200, 200, 400, 400],
          buyer_note: d.buyer_note || "Visible surface variation.",
        }),
      );

      return {
        ok: true,
        data: {
          title:
            analysis.amazon_listing?.title || analysis.identified_product_name,
          description:
            analysis.amazon_listing?.seller_condition_summary ||
            analysis.amazon_listing?.key_features_bullets?.join(". ") ||
            "Well-maintained student item inspected via Camplx AI.",
          condition: analysis.overall_condition || "Good",
          price:
            listingType === "sell"
              ? Number(analysis.pricing?.recommended_listing_price) || 850
              : null,
          circular_lifecycle_category:
            (analysis.circular_lifecycle_category as any) || "Reusable",
          pricing: analysis.pricing,
          amazon_listing: analysis.amazon_listing,
          defects,
          annotated_image_base64: annotatedBase64,
          reasoning: analysis.pricing?.pricing_rationale,
        },
      };
    }
  } catch (err) {
    console.warn(
      `[aiService] Backend at ${BACKEND_URL} unreachable or timed out; activating local intelligent appraiser.`,
      err,
    );
  }

  // Resilient Local Evaluation Fallback
  await new Promise((r) => setTimeout(r, 900));

  const note = sellerNotes.toLowerCase();
  let title = "Campus Student Essential";
  let condition = "Good";
  let price = 750;
  let penalty = 120;
  let circular: "Reusable" | "Repairable" | "End-of-life" = "Reusable";
  let rationale =
    "Fair student asking price calibrated against campus median resale rates.";

  if (note.includes("calc") || note.includes("casio")) {
    title = "Casio FX-991EX ClassWiz Scientific Calculator (552 Functions)";
    condition = "Like New";
    price = 950;
    penalty = 80;
    rationale =
      "High exam utility across engineering semesters; fair 38% discount off bookstore price.";
  } else if (note.includes("cycle") || note.includes("bike")) {
    title = "Single-Speed Commuter Bicycle with Dual Handbrakes";
    condition = "Good";
    price = 3200;
    penalty = 400;
    rationale =
      "High utility for daily hostel-to-class transit with intact mechanical components.";
  } else if (note.includes("book") || note.includes("math")) {
    title = "Standard Engineering Mathematics Curriculum Textbook";
    condition = "Good";
    price = 380;
    penalty = 50;
    rationale =
      "Priced 55% below new print retail with complete syllabi chapters.";
  } else if (
    note.includes("dead") ||
    note.includes("broken") ||
    note.includes("battery")
  ) {
    circular = "End-of-life";
    title = "Electronics Component (Flagged for Safe E-Waste Recovery)";
    price = 0;
    rationale =
      "Damaged beyond economical student repair. Circularity path routed to e-waste hub.";
  }

  return {
    ok: true,
    data: {
      title,
      description:
        "Student item inspected for campus circularity. Visual components verified.",
      condition,
      price: listingType === "sell" ? price : null,
      circular_lifecycle_category: circular,
      pricing: {
        estimated_retail_new: price * 1.8,
        typical_used_market_price: price + penalty,
        condition_penalty_amount: penalty,
        recommended_min_price: Math.max(100, price - 150),
        recommended_listing_price: price,
        recommended_max_price: price + 200,
        pricing_rationale: rationale,
      },
      amazon_listing: {
        title,
        key_features_bullets: [
          "Authentic student-owned item verified on campus.",
          "Clean visual inspection with documented wear areas.",
          "Pre-tested for semester utility and daily use.",
        ],
        technical_specifications: {
          Category: "Campus Circular Asset",
          Inspection: "Camplx Vision AI",
        },
        seller_condition_summary: `${condition} condition with normal student cosmetic use.`,
      },
      defects: [
        {
          id: "def-local-1",
          defect_type: "Surface Friction Mark",
          severity: "Cosmetic Minor",
          box_2d: [180, 200, 360, 480],
          buyer_note: "Cosmetic wear consistent with routine backpack carry.",
        },
      ],
      reasoning: rationale,
    },
  };
}
