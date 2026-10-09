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

export type InspectionFinding = {
  id: string;
  label: string;
  severity: "minor" | "moderate" | "major";
  confidence: "high" | "medium" | "low";
  reviewStatus: "verified" | "disputed" | "pending";
  description: string;
  location?: { x: number; y: number; width: number; height: number }; // normalized 0-100
};

export type InspectionResult = {
  id: string;
  listingId: string;
  status: "completed" | "pending" | "failed";
  originalImageUri: string;
  annotatedImageUri?: string;
  findings: InspectionFinding[];
  modelNotes: string[];
  createdAt: string;
};

export type EwasteRequest = {
  id: string;
  userId: string;
  deviceType: string;
  description: string;
  quantity: number;
  location: string;
  preferredSlot: string;
  notes?: string;
  status: "submitted" | "scheduled" | "collected" | "recycled";
  createdAt: string;
  estimatedCarbonSavingsKg: number;
};

export type LocalNeedItRequest = {
  id: string;
  title: string;
  category: string | null;
  description?: string;
  budget?: number;
  status: "open" | "fulfilled";
  createdAt: number;
};

const STORAGE_KEYS = {
  LISTINGS: "camplx.db.listings.v1",
  RESERVATIONS: "camplx.db.reservations.v1",
  EWASTE: "camplx.db.ewaste.v1",
  INSPECTIONS: "camplx.db.inspections.v1",
  NEEDIT: "camplx.db.needit.v1",
  INITIALIZED: "camplx.db.initialized.v1",
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
  points: 380,
  cumulative_carbon_g: 24500,
};

// Seed listings with high-quality, stable image representations
const SEED_LISTINGS: ListingWithImages[] = [
  {
    id: "list-1",
    seller_id: "seller-101",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Casio FX-991EX ClassWiz Scientific Calculator",
    description:
      "Original Casio FX-991EX with solar battery. Perfect for Engineering Mathematics & Physics. High resolution LCD display, pristine keys.",
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
    title: "Firefox Target 29T Mountain Bicycle",
    description:
      "Sturdy 21-speed MTB with front suspension and dual disc brakes. Recently serviced with new brake pads and bell. Great for commuting between hostel and department.",
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
    title: "Higher Engineering Mathematics – B.S. Grewal (44th Edition)",
    description:
      "Standard textbook for 1st & 2nd year engineering mathematics. Clean pages, no highlighting, hardbound edition with syllabus markings.",
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
    title: "Adjustable LED Study Lamp + Extension Board",
    description:
      "3-color temperature desk lamp with flexible neck plus a 4-socket spike guard. Free for any junior moving into Hostel Block C.",
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
  {
    id: "list-5",
    seller_id: "seller-104",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Logitech K380 Bluetooth Multi-Device Keyboard",
    description:
      "Compact wireless keyboard connecting up to 3 devices (laptop, tablet, phone). Fresh AAA batteries included. Perfect for coding and taking lecture notes.",
    category: "electronics",
    condition: "Like New",
    price: 1400,
    status: "active",
    carbon_savings_g: 4500,
    published_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    listing_images: [
      {
        id: "img-5",
        listing_id: "list-5",
        storage_path:
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-6",
    seller_id: "seller-105",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Wooden Study Desk with 2 Storage Drawers",
    description:
      "Engineered wood desk with smooth laminate finish. Sturdy steel legs, fits easily into hostel dorm space. Disassembles for easy transport.",
    category: "furniture",
    condition: "Fair",
    price: 1800,
    status: "active",
    carbon_savings_g: 32000,
    published_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    listing_images: [
      {
        id: "img-6",
        listing_id: "list-6",
        storage_path:
          "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-7",
    seller_id: "seller-106",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "sell",
    title: "Sony WH-CH520 Wireless Bluetooth Headphones",
    description:
      "50-hour battery life with multipoint connection. Clear audio for online lectures and quiet study sessions. Minor ear-cup wear, sounds like brand new.",
    category: "electronics",
    condition: "Good",
    price: 2100,
    status: "active",
    carbon_savings_g: 8000,
    published_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    listing_images: [
      {
        id: "img-7",
        listing_id: "list-7",
        storage_path:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
        display_order: 0,
      },
    ],
  },
  {
    id: "list-8",
    seller_id: "seller-107",
    campus_id: DEMO_CAMPUS.id,
    listing_type: "donate",
    title: "Dorm Essentials Pack (Iron Box + Hangers + Laundry Bag)",
    description:
      "Philips dry iron in working condition with 12 clothes hangers and a foldable mesh laundry basket. Graduating senior giveaway.",
    category: "hostel_essentials",
    condition: "Fair",
    price: null,
    status: "active",
    carbon_savings_g: 6500,
    published_at: new Date(Date.now() - 3600000 * 60).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 60).toISOString(),
    listing_images: [
      {
        id: "img-8",
        listing_id: "list-8",
        storage_path:
          "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800&q=80",
        display_order: 0,
      },
    ],
  },
];

// Seed inspection for list-1 (Calculator) and list-2 (Cycle)
const SEED_INSPECTIONS: InspectionResult[] = [
  {
    id: "insp-1",
    listingId: "list-1",
    status: "completed",
    originalImageUri:
      "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&q=80",
    findings: [
      {
        id: "f-1",
        label: "Minor outer bevel scuff",
        severity: "minor",
        confidence: "high",
        reviewStatus: "verified",
        description:
          "Small visual friction mark on top edge plastic casing. Display screen is 100% intact.",
        location: { x: 18, y: 12, width: 22, height: 14 },
      },
      {
        id: "f-2",
        label: "Solar panel clarity check",
        severity: "minor",
        confidence: "high",
        reviewStatus: "verified",
        description:
          "Photovoltaic cell surface is clean with no micro-cracks or delamination.",
        location: { x: 62, y: 15, width: 25, height: 16 },
      },
    ],
    modelNotes: [
      "Visual surface inspection completed via Gemini multimodal analysis.",
      "Internal battery lifespan and LCD segment circuit require physical verification.",
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "insp-2",
    listingId: "list-2",
    status: "completed",
    originalImageUri:
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
    findings: [
      {
        id: "f-3",
        label: "Chainstay paint rub",
        severity: "minor",
        confidence: "medium",
        reviewStatus: "verified",
        description:
          "Superficial chain slap marks near rear derailleur bracket. Frame tubing is structurally sound.",
        location: { x: 68, y: 64, width: 20, height: 18 },
      },
      {
        id: "f-4",
        label: "Brake cable housing wear",
        severity: "moderate",
        confidence: "medium",
        reviewStatus: "pending",
        description:
          "Outer rubber sheath on front brake line shows light weathering. Steel cable core intact.",
        location: { x: 42, y: 28, width: 16, height: 20 },
      },
    ],
    modelNotes: [
      "Tire tread depth and rim alignment verified visually.",
      "Buyer advised to test gear shifts during in-person pickup.",
    ],
    createdAt: new Date().toISOString(),
  },
];

const SEED_EWASTE: EwasteRequest[] = [
  {
    id: "ewaste-1",
    userId: DEMO_USER.id,
    deviceType: "Dead Dell Laptop (Motherboard issue)",
    description:
      "2018 Inspiron with cracked casing and fried motherboard. Battery has been safely disconnected.",
    quantity: 1,
    location: "Campus Collection Hub, Tech Block B",
    preferredSlot: "Wednesday 3:00 PM - 5:00 PM",
    notes: "Non-repairable, certified e-waste recovery requested.",
    status: "scheduled",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    estimatedCarbonSavingsKg: 34.5,
  },
  {
    id: "ewaste-2",
    userId: "seller-102",
    deviceType: "Swollen Lithium-ion Power Bank & Cables",
    description:
      "3 old USB-C charging bricks + 1 old 10,000mAh power bank showing slight bulging.",
    quantity: 4,
    location: "Hostel Block 4 Drop Box",
    preferredSlot: "Friday 10:00 AM - 1:00 PM",
    notes: "Marked for hazardous battery recycling.",
    status: "collected",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    estimatedCarbonSavingsKg: 8.2,
  },
];

// Helper to load and save
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
        if (__DEV__)
          console.log(
            "[Database] Local SQLite-equivalent storage initialized with demo seed.",
          );
      }
    } catch (e) {
      console.warn("[Database] Init warning:", e);
    }
  },

  // Listings
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

  // Reservations
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

  // E-waste
  async getEwasteRequests(): Promise<EwasteRequest[]> {
    await db.init();
    return getTable<EwasteRequest>(STORAGE_KEYS.EWASTE, SEED_EWASTE);
  },

  async createEwasteRequest(
    item: Omit<
      EwasteRequest,
      "id" | "createdAt" | "status" | "estimatedCarbonSavingsKg"
    >,
  ): Promise<EwasteRequest> {
    const all = await db.getEwasteRequests();
    const newReq: EwasteRequest = {
      ...item,
      id: `ewaste-${Date.now()}`,
      status: "submitted",
      createdAt: new Date().toISOString(),
      estimatedCarbonSavingsKg: Number(
        (
          item.quantity *
          (item.deviceType.toLowerCase().includes("laptop") ? 25 : 4.5)
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

  // Inspections
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

  async updateFindingStatus(
    listingId: string,
    findingId: string,
    newStatus: InspectionFinding["reviewStatus"],
  ): Promise<void> {
    const inspection = await db.getInspectionByListingId(listingId);
    if (!inspection) return;
    const updatedFindings = inspection.findings.map((f) =>
      f.id === findingId ? { ...f, reviewStatus: newStatus } : f,
    );
    await db.saveInspection({ ...inspection, findings: updatedFindings });
  },
};
