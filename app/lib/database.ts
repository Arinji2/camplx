// lib/database.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ListingType,
  ListingStatus,
  ListingWithImages,
  ReservationStatus,
  MyReservation,
  ActiveReservation,
} from "@/types";

export type DefectItem = {
  id: string;
  defect_type: string;
  severity: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  buyer_note: string;
};

export type PricingIntelligence = {
  estimated_retail_new: number;
  typical_used_market_price: number;
  condition_penalty_amount: number;
  recommended_min_price: number;
  recommended_listing_price: number;
  recommended_max_price: number;
  pricing_rationale: string;
};

export type AmazonStyleListing = {
  title: string;
  key_features_bullets: string[];
  technical_specifications: Record<string, string>;
  seller_condition_summary: string;
};

export type InspectionResult = {
  id: string;
  listingId: string;
  status: "completed" | "pending" | "failed";
  originalImageUri: string;
  annotatedImageBase64?: string;
  overall_condition: string;
  circular_lifecycle_category: "Reusable" | "Repairable" | "End-of-life";
  defects: DefectItem[];
  pricing?: PricingIntelligence;
  amazon_listing?: AmazonStyleListing;
  modelNotes: string[];
  createdAt: string;
};

export type EwasteRequest = {
  id: string;
  student_id: string;
  item_category: string;
  description: string;
  quantity: number;
  latitude: number;
  longitude: number;
  location: string;
  preferredSlot: string;
  notes?: string;
  status: "pending" | "scheduled" | "collected" | "handed_over";
  zone_cluster_id?: number | null;
  pickup_sequence_order?: number | null;
  createdAt: string;
  estimatedCarbonSavingsKg: number;
};

const STORAGE_KEYS = {
  LISTINGS: "camplx.db.listings.v2",
  RESERVATIONS: "camplx.db.reservations.v2",
  EWASTE: "camplx.db.ewaste.v2",
  INSPECTIONS: "camplx.db.inspections.v2",
  INITIALIZED: "camplx.db.initialized.v2",
};

export const DEMO_CAMPUS = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Dr. D. Y. Patil Vidyapeeth (DPU Pune)",
  city: "Pune",
};

export const DEMO_USER = {
  id: "a0000000-0000-0000-0000-000000000001",
  email: "aarav.sharma@dpu.edu.in",
  display_name: "Aarav Sharma",
  verified_student: true,
  campus_id: DEMO_CAMPUS.id,
  campus_name: DEMO_CAMPUS.name,
  points: 420,
  cumulative_carbon_g: 32500,
};

const SEED_LISTINGS: ListingWithImages[] = [
  {
    id: "list-1",
    seller_id: "seller-101",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Casio FX-991EX ClassWiz Scientific Calculator",
    description:
      "Original Casio FX-991EX ClassWiz with dual solar & battery power. High-resolution natural textbook LCD display. Clean keys and protective snap-on case.",
    category: "electronics",
    condition: "Like New",
    price: 950,
    status: "active",
    carbon_savings_g: 3500,
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    listing_images: [
      {
        id: "img-1",
        listing_id: "list-1",
        storage_path:
          "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-2",
    seller_id: DEMO_USER.id,
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Firefox Target 29T Mountain Commuter Cycle",
    description:
      "Sturdy 21-speed alloy MTB with front suspension fork and dual mechanical disc brakes. Serviced with new chain lubricant and bell. Great for commuting between hostel and tech block.",
    category: "cycles",
    condition: "Good",
    price: 4800,
    status: "active",
    carbon_savings_g: 90000,
    published_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    listing_images: [
      {
        id: "img-2",
        listing_id: "list-2",
        storage_path:
          "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-3",
    seller_id: "seller-102",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Higher Engineering Mathematics – B.S. Grewal (44th Ed)",
    description:
      "Standard textbook for university engineering mathematics. Clean pages, no pencil marks or tears, firmly bound edition.",
    category: "books",
    condition: "Good",
    price: 420,
    status: "active",
    carbon_savings_g: 1500,
    published_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    listing_images: [
      {
        id: "img-3",
        listing_id: "list-3",
        storage_path:
          "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-4",
    seller_id: "seller-103",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "donate",
    title: "Hostel Study Lamp + 4-Socket Power Spike Guard",
    description:
      "Flexible neck LED lamp with 3 color temperatures, paired with an Anchor spike guard. Free handover to incoming hostel junior.",
    category: "hostel_essentials",
    condition: "Good",
    price: null,
    status: "active",
    carbon_savings_g: 5000,
    published_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    listing_images: [
      {
        id: "img-4",
        listing_id: "list-4",
        storage_path:
          "https://images.unsplash.com/photo-1534942940226-4a6c23b2074d?w=800&q=80",
        display_order: 0,
      },
    ],
  },
];

const SEED_INSPECTIONS: InspectionResult[] = [
  {
    id: "insp-1",
    listingId: "list-1",
    status: "completed",
    originalImageUri:
      "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&q=80",
    overall_condition: "Like New",
    circular_lifecycle_category: "Reusable",
    defects: [
      {
        id: "def-1",
        defect_type: "Bezel Scuff",
        severity: "Cosmetic Minor",
        box_2d: [120, 160, 260, 420],
        buyer_note:
          "Light surface scuff on outer border plastic. Glass display untouched.",
      },
      {
        id: "def-2",
        defect_type: "Solar Strip Check",
        severity: "Cosmetic Minor",
        box_2d: [130, 620, 290, 890],
        buyer_note:
          "Photovoltaic cell array is intact and generating nominal voltage.",
      },
    ],
    pricing: {
      estimated_retail_new: 1495,
      typical_used_market_price: 1050,
      condition_penalty_amount: 100,
      recommended_min_price: 850,
      recommended_listing_price: 950,
      recommended_max_price: 1100,
      pricing_rationale:
        "High semester exam demand on campus; 36% discount off current bookstore retail.",
    },
    amazon_listing: {
      title:
        "Casio FX-991EX ClassWiz Scientific Calculator (552 Functions, Solar)",
      key_features_bullets: [
        "Advanced high-resolution natural textbook display with QR Code visualization.",
        "Equipped with 552 scientific functions including matrix, vector, and calculus.",
        "Solar cell plus backup battery for reliable power during mid-terms and finals.",
        "Protective hard case included with clean non-sticky keypad response.",
      ],
      technical_specifications: {
        Brand: "Casio",
        Model: "FX-991EX ClassWiz",
        Display: "Natural Textbook LCD",
        "Power Source": "Solar & LR44 Battery",
      },
      seller_condition_summary:
        "Light cosmetic wear on casing edge. Screen and electronic circuits are pristine.",
    },
    modelNotes: [
      "Multimodal analysis completed via Gemini vision pipeline.",
      "Identified as Tier-1 circular reuse asset.",
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "insp-2",
    listingId: "list-2",
    status: "completed",
    originalImageUri:
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
    overall_condition: "Good",
    circular_lifecycle_category: "Reusable",
    defects: [
      {
        id: "def-3",
        defect_type: "Chainstay Paint Rub",
        severity: "Cosmetic Minor",
        box_2d: [620, 640, 800, 860],
        buyer_note: "Normal friction scratch near rear axle from chain slap.",
      },
    ],
    pricing: {
      estimated_retail_new: 12500,
      typical_used_market_price: 5200,
      condition_penalty_amount: 400,
      recommended_min_price: 4400,
      recommended_listing_price: 4800,
      recommended_max_price: 5400,
      pricing_rationale:
        "High utility commuter bike for campus terrain; priced 60% below showroom cost.",
    },
    amazon_listing: {
      title: "Firefox Target 29T All-Terrain Commuter MTB (Dual Disc)",
      key_features_bullets: [
        "29-inch high-traction nylon tires designed for smooth campus road transit.",
        "Mechanical front & rear disc brakes for responsive stopping in all conditions.",
        "Front suspension fork dampening curb bumps and gravel paths.",
        "Serviced gear shifters and chain ready for immediate daily riding.",
      ],
      technical_specifications: {
        Brand: "Firefox",
        Type: "Mountain Bike (MTB)",
        "Wheel Size": "29 Inches",
        Brakes: "Dual Mechanical Disc",
      },
      seller_condition_summary:
        "Mechanically sound with minor cosmetic chainstay rubs.",
    },
    modelNotes: ["Bicycle tires and brake lever integrity visually validated."],
    createdAt: new Date().toISOString(),
  },
];

const SEED_EWASTE: EwasteRequest[] = [
  {
    id: "ewaste-1",
    student_id: DEMO_USER.id,
    item_category: "End-of-life",
    description: "Dell Inspiron with dead motherboard & bulging battery",
    quantity: 1,
    latitude: 18.6251,
    longitude: 73.8198,
    location: "Tech Block B, DPU Campus",
    preferredSlot: "Morning (10:00 AM - 1:00 PM)",
    notes: "Non-repairable PCB; battery isolated safely.",
    status: "scheduled",
    zone_cluster_id: 0,
    pickup_sequence_order: 1,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    estimatedCarbonSavingsKg: 34.5,
  },
  {
    id: "ewaste-2",
    student_id: "seller-102",
    item_category: "End-of-life",
    description: "Swollen Lithium-ion Power Bank & 3 Frayed USB Cables",
    quantity: 4,
    latitude: 18.6272,
    longitude: 73.8184,
    location: "Hostel Block 4 Reception",
    preferredSlot: "Afternoon (2:00 PM - 5:00 PM)",
    notes: "Flagged for hazardous recycling protocol.",
    status: "pending",
    zone_cluster_id: null,
    pickup_sequence_order: null,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    estimatedCarbonSavingsKg: 8.2,
  },
  {
    id: "ewaste-3",
    student_id: "seller-105",
    item_category: "Repairable",
    description: "HP Laser DeskJet with faulty paper roller motor",
    quantity: 1,
    latitude: 18.6242,
    longitude: 73.8211,
    location: "Library Ground Floor Hub",
    preferredSlot: "Morning (10:00 AM - 1:00 PM)",
    notes: "Eligible for department electronics workshop refurbishment.",
    status: "pending",
    zone_cluster_id: null,
    pickup_sequence_order: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    estimatedCarbonSavingsKg: 18.0,
  },
];

async function getTable<T>(key: string, defaultData: T[]): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return defaultData;
    return JSON.parse(raw);
  } catch {
    return defaultData;
  }
}

async function setTable<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("[Database] setTable error:", e);
  }
}

export const db = {
  async init(): Promise<void> {
    try {
      const initialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        await setTable(STORAGE_KEYS.LISTINGS, SEED_LISTINGS);
        await setTable(STORAGE_KEYS.INSPECTIONS, SEED_INSPECTIONS);
        await setTable(STORAGE_KEYS.EWASTE, SEED_EWASTE);
        await setTable(STORAGE_KEYS.RESERVATIONS, []);
        await AsyncStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
      }
    } catch (e) {
      console.warn("[Database] Init warning:", e);
    }
  },

  async getListings(): Promise<ListingWithImages[]> {
    await db.init();
    return getTable<ListingWithImages>(STORAGE_KEYS.LISTINGS, SEED_LISTINGS);
  },

  async getListingById(id: string): Promise<ListingWithImages | null> {
    const all = await db.getListings();
    return all.find((l) => l.id === id) ?? null;
  },

  async createListing(
    item: Omit<ListingWithImages, "id" | "created_at" | "published_at">,
  ): Promise<string> {
    const all = await db.getListings();
    const id = `list-${Date.now()}`;
    const now = new Date().toISOString();
    const newListing: ListingWithImages = {
      ...item,
      id,
      created_at: now,
      published_at: now,
    };
    await setTable(STORAGE_KEYS.LISTINGS, [newListing, ...all]);
    return id;
  },

  async updateListing(
    id: string,
    patch: Partial<ListingWithImages>,
  ): Promise<void> {
    const all = await db.getListings();
    const updated = all.map((l) => (l.id === id ? { ...l, ...patch } : l));
    await setTable(STORAGE_KEYS.LISTINGS, updated);
  },

  async deleteListing(id: string): Promise<void> {
    const all = await db.getListings();
    const filtered = all.filter((l) => l.id !== id);
    await setTable(STORAGE_KEYS.LISTINGS, filtered);
  },

  async getReservations(): Promise<any[]> {
    return getTable(STORAGE_KEYS.RESERVATIONS, []);
  },

  async createReservation(
    listingId: string,
    buyerId: string,
    buyerName: string,
  ): Promise<string> {
    const resId = `res-${Date.now()}`;
    const all = await db.getReservations();
    const now = new Date().toISOString();

    const newRes = {
      id: resId,
      listing_id: listingId,
      buyer_id: buyerId,
      buyer_name: buyerName,
      status: "active" as ReservationStatus,
      created_at: now,
    };

    await setTable(STORAGE_KEYS.RESERVATIONS, [newRes, ...all]);
    await db.updateListing(listingId, { status: "reserved" });
    return resId;
  },

  async releaseReservation(
    reservationId: string,
    listingId: string,
  ): Promise<void> {
    const all = await db.getReservations();
    const updated = all.map((r) =>
      r.id === reservationId
        ? { ...r, status: "released" as ReservationStatus }
        : r,
    );
    await setTable(STORAGE_KEYS.RESERVATIONS, updated);
    await db.updateListing(listingId, { status: "active" });
  },

  async completeReservation(
    reservationId: string,
    listingId: string,
    outcome: "sold" | "donated",
  ): Promise<void> {
    const all = await db.getReservations();
    const updated = all.map((r) =>
      r.id === reservationId
        ? { ...r, status: "completed" as ReservationStatus }
        : r,
    );
    await setTable(STORAGE_KEYS.RESERVATIONS, updated);
    await db.updateListing(listingId, { status: outcome });
  },

  async getActiveReservation(
    listingId: string,
  ): Promise<ActiveReservation | null> {
    const all = await db.getReservations();
    const found = all.find(
      (r) => r.listing_id === listingId && r.status === "active",
    );
    if (!found) return null;
    return {
      id: found.id,
      listing_id: found.listing_id,
      buyer_id: found.buyer_id,
      campus_id: DEMO_CAMPUS.id,
      status: "active",
      created_at: found.created_at,
      buyer: {
        display_name: found.buyer_name || "Campus Buyer",
        email: "student@dpu.edu.in",
      },
    };
  },

  async getMyReservations(buyerId: string): Promise<MyReservation[]> {
    const allRes = await db.getReservations();
    const listings = await db.getListings();
    const my = allRes.filter((r) => r.buyer_id === buyerId);

    return my.map((r) => {
      const listing = listings.find((l) => l.id === r.listing_id) ?? null;
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        listing,
      };
    });
  },

  async getEwasteRequests(): Promise<EwasteRequest[]> {
    await db.init();
    return getTable<EwasteRequest>(STORAGE_KEYS.EWASTE, SEED_EWASTE);
  },

  async createEwasteRequest(
    item: Omit<
      EwasteRequest,
      | "id"
      | "createdAt"
      | "status"
      | "estimatedCarbonSavingsKg"
      | "zone_cluster_id"
      | "pickup_sequence_order"
    >,
  ): Promise<EwasteRequest> {
    const all = await db.getEwasteRequests();
    const newReq: EwasteRequest = {
      ...item,
      id: `ewaste-${Date.now()}`,
      status: "pending",
      zone_cluster_id: null,
      pickup_sequence_order: null,
      createdAt: new Date().toISOString(),
      estimatedCarbonSavingsKg: Number(
        (
          item.quantity *
          (item.description.toLowerCase().includes("laptop") ? 34.5 : 5.0)
        ).toFixed(1),
      ),
    };
    await setTable(STORAGE_KEYS.EWASTE, [newReq, ...all]);
    return newReq;
  },

  async updateEwasteStatus(
    id: string,
    status: EwasteRequest["status"],
  ): Promise<void> {
    const all = await db.getEwasteRequests();
    const updated = all.map((req) =>
      req.id === id ? { ...req, status } : req,
    );
    await setTable(STORAGE_KEYS.EWASTE, updated);
  },

  async saveOptimizedEwasteRoutes(
    clusteredRequests: EwasteRequest[],
  ): Promise<void> {
    await setTable(STORAGE_KEYS.EWASTE, clusteredRequests);
  },

  async getInspectionByListingId(
    listingId: string,
  ): Promise<InspectionResult | null> {
    await db.init();
    const all = await getTable<InspectionResult>(
      STORAGE_KEYS.INSPECTIONS,
      SEED_INSPECTIONS,
    );
    return all.find((i) => i.listingId === listingId) ?? null;
  },

  async saveInspection(inspection: InspectionResult): Promise<void> {
    const all = await getTable<InspectionResult>(
      STORAGE_KEYS.INSPECTIONS,
      SEED_INSPECTIONS,
    );
    const existingIndex = all.findIndex(
      (i) => i.listingId === inspection.listingId,
    );
    if (existingIndex >= 0) {
      all[existingIndex] = inspection;
      await setTable(STORAGE_KEYS.INSPECTIONS, all);
    } else {
      await setTable(STORAGE_KEYS.INSPECTIONS, [inspection, ...all]);
    }
  },
};
