import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ListingDetailResponse,
  ListingSummary,
  UserProfileResponse,
  EWasteRequestRecord,
  NeedRequestRecord,
  ReservationRecord,
} from "@/types/api";

export const MOCK_USER: UserProfileResponse = {
  id: "a0000000-0000-0000-0000-000000000001",
  email: "aarav.sharma@dpu.edu.in",
  display_name: "Aarav Sharma",
  avatar_url: null,
  verified_student: true,
  campus_id: "11111111-1111-1111-1111-111111111111",
  campus_name: "Dr. D. Y. Patil Vidyapeeth (DPU Pune)",
  points: 420,
  cumulative_carbon_g: 32500,
};

export const SEED_LISTINGS: ListingDetailResponse[] = [
  {
    id: "list-1",
    seller_id: "seller-101",
    seller_name: "Karan Mehta",
    campus_id: MOCK_USER.campus_id,
    title: "Casio FX-991EX ClassWiz Scientific Calculator",
    brand: "Casio",
    model: "FX-991EX ClassWiz",
    description:
      "Original Casio FX-991EX ClassWiz with dual solar & battery power. Natural textbook LCD display with clean keys and snap-on case.",
    category: "electronics",
    condition: "Like New",
    listing_type: "sell",
    asking_price: 950,
    status: "active",
    carbon_savings_g: 3500,
    technical_specifications: {
      Display: "Natural Textbook LCD",
      Functions: "552 Functions",
      Power: "Solar + LR44 Battery",
    },
    images: [
      {
        id: "img-1",
        image_url:
          "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&q=80",
        display_order: 0,
        angle_label: "front",
      },
    ],
    inspection: {
      inspection_id: "insp-1",
      report_version: 1,
      identified_product_name: "Casio FX-991EX ClassWiz Scientific Calculator",
      brand: "Casio",
      model: "FX-991EX",
      category: "electronics",
      overall_condition: "Like New",
      circular_lifecycle_category: "Reusable",
      defects: [
        {
          id: "def-1",
          image_id: "img-1",
          defect_type: "Bezel Scuff",
          severity: "Cosmetic Minor",
          box_2d: [120, 160, 260, 420],
          buyer_note:
            "Light surface scuff on outer border plastic. Glass display untouched.",
          dispute_status: "none",
        },
      ],
      amazon_listing: {
        title: "Casio FX-991EX ClassWiz Scientific Calculator (552 Functions)",
        key_features_bullets: [
          "High-resolution natural textbook display with QR Code visualization.",
          "552 scientific functions including matrix, vector, and calculus operations.",
          "Dual power source ensuring exam reliability.",
        ],
        technical_specifications: {
          Brand: "Casio",
          Model: "FX-991EX",
        },
        seller_condition_summary:
          "Pristine LCD display with minor outer plastic friction mark.",
      },
      images: [
        {
          id: "img-1",
          image_url:
            "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&q=80",
          display_order: 0,
          angle_label: "front",
        },
      ],
      specification_provenance: {
        Brand: "visually_verified",
        Model: "visually_verified",
      },
    },
    pricing_intelligence: {
      data_sufficiency: "sufficient",
      estimated_retail_new: 1495,
      typical_used_market_price: 1050,
      condition_penalty_amount: 100,
      recommended_min_price: 850,
      recommended_listing_price: 950,
      recommended_max_price: 1100,
      pricing_rationale:
        "High semester exam demand on campus; 36% discount off bookstore price.",
      comparables_count: 3,
      comparables: [],
    },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "list-2",
    seller_id: MOCK_USER.id,
    seller_name: MOCK_USER.display_name,
    campus_id: MOCK_USER.campus_id,
    title: "Firefox Target 29T Mountain Commuter Cycle",
    brand: "Firefox",
    model: "Target 29T",
    description:
      "Alloy MTB with front suspension fork and dual mechanical disc brakes. Ideal for daily transit between hostel and lecture halls.",
    category: "cycles",
    condition: "Good",
    listing_type: "sell",
    asking_price: 4800,
    status: "active",
    carbon_savings_g: 90000,
    images: [
      {
        id: "img-2",
        image_url:
          "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
        display_order: 0,
        angle_label: "front",
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "list-3",
    seller_id: "seller-102",
    seller_name: "Sneha Patel",
    campus_id: MOCK_USER.campus_id,
    title: "Higher Engineering Mathematics – B.S. Grewal (44th Ed)",
    category: "books",
    condition: "Good",
    listing_type: "sell",
    asking_price: 420,
    status: "active",
    carbon_savings_g: 1500,
    images: [
      {
        id: "img-3",
        image_url:
          "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
        display_order: 0,
        angle_label: "front",
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: "list-4",
    seller_id: "seller-103",
    seller_name: "Rohan Deshmukh",
    campus_id: MOCK_USER.campus_id,
    title: "Hostel Study Lamp + 4-Socket Power Spike Guard",
    category: "hostel_essentials",
    condition: "Good",
    listing_type: "donate",
    asking_price: null,
    status: "active",
    carbon_savings_g: 5000,
    images: [
      {
        id: "img-4",
        image_url:
          "https://images.unsplash.com/photo-1534942940226-4a6c23b2074d?w=800&q=80",
        display_order: 0,
        angle_label: "front",
      },
    ],
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

const STORAGE_KEYS = {
  LISTINGS: "camplx.fallback.listings",
  RESERVATIONS: "camplx.fallback.reservations",
  EWASTE: "camplx.fallback.ewaste",
  NEEDS: "camplx.fallback.needs",
  WISHLIST: "camplx.fallback.wishlist",
};

export const mockStorage = {
  async getListings(): Promise<ListingDetailResponse[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LISTINGS);
      if (!raw) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.LISTINGS,
          JSON.stringify(SEED_LISTINGS),
        );
        return SEED_LISTINGS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_LISTINGS;
    }
  },

  async saveListing(listing: ListingDetailResponse): Promise<void> {
    const list = await mockStorage.getListings();
    const updated = [listing, ...list.filter((l) => l.id !== listing.id)];
    await AsyncStorage.setItem(STORAGE_KEYS.LISTINGS, JSON.stringify(updated));
  },

  async getListingById(id: string): Promise<ListingDetailResponse | null> {
    const list = await mockStorage.getListings();
    return list.find((l) => l.id === id) || null;
  },

  async getReservations(): Promise<ReservationRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RESERVATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async addReservation(res: ReservationRecord): Promise<void> {
    const all = await mockStorage.getReservations();
    await AsyncStorage.setItem(
      STORAGE_KEYS.RESERVATIONS,
      JSON.stringify([res, ...all]),
    );
  },

  async getEWaste(): Promise<EWasteRequestRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.EWASTE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async saveEWaste(item: EWasteRequestRecord): Promise<void> {
    const all = await mockStorage.getEWaste();
    await AsyncStorage.setItem(
      STORAGE_KEYS.EWASTE,
      JSON.stringify([item, ...all]),
    );
  },
};
