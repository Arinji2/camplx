import { apiRequest } from "./client";
import { mockStorage, MOCK_USER } from "./mockData";
import type {
  AuthSessionResponse,
  CompleteReservationRequest,
  CompletedTransactionResponse,
  CreateEWasteSubmissionRequest,
  CreateInspectionSessionRequest,
  CreateListingRequest,
  CreateNeedRequestPayload,
  DefectDisputeRequest,
  DefectItem,
  DemoSessionRequest,
  EWasteOptimizationPlanResponse,
  EWasteRequestRecord,
  InspectionAnalysisResultResponse,
  InspectionImageRecord,
  InspectionRecordResponse,
  InspectionSessionResponse,
  LeaderboardStandingItem,
  ListingDetailResponse,
  ListingSummary,
  MyReservationItem,
  NeedMatchResult,
  NeedRequestRecord,
  NotificationItem,
  PaginatedListingsResponse,
  PricingAppraisalResponse,
  ReservationRecord,
  SellerProfileWithListingsResponse,
  SustainabilitySummaryResponse,
  UpdateEWasteStatusRequest,
  UpdateListingRequest,
  UserProfileResponse,
  UserProfileUpdateRequest,
} from "@/types/api";

// ── Auth & Identity ──────────────────────────────────────────────────────────
export const authApi = {
  async createDemoSession(
    payload: DemoSessionRequest,
  ): Promise<AuthSessionResponse> {
    try {
      return await apiRequest<AuthSessionResponse>("/auth/demo-session", {
        method: "POST",
        body: payload,
      });
    } catch {
      return {
        token: "demo_token_camplx",
        user: {
          ...MOCK_USER,
          email: payload.email,
          display_name: payload.display_name || MOCK_USER.display_name,
        },
      };
    }
  },

  async getCurrentUserProfile(): Promise<UserProfileResponse> {
    try {
      return await apiRequest<UserProfileResponse>("/auth/me");
    } catch {
      return MOCK_USER;
    }
  },

  async updateCurrentUserProfile(
    payload: UserProfileUpdateRequest,
  ): Promise<UserProfileResponse> {
    try {
      return await apiRequest<UserProfileResponse>("/auth/me", {
        method: "PATCH",
        body: payload,
      });
    } catch {
      return { ...MOCK_USER, ...payload };
    }
  },
};

// ── Listings ─────────────────────────────────────────────────────────────────
export const listingsApi = {
  async listMarketplaceListings(params?: {
    category?: string;
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedListingsResponse> {
    try {
      const q = new URLSearchParams();
      if (params?.category) q.append("category", params.category);
      if (params?.search) q.append("search", params.search);
      if (params?.status) q.append("status", params.status);
      if (params?.page) q.append("page", String(params.page));
      if (params?.per_page) q.append("per_page", String(params.per_page));

      return await apiRequest<PaginatedListingsResponse>(
        `/listings?${q.toString()}`,
      );
    } catch {
      // Local fallback
      const all = await mockStorage.getListings();
      let filtered = all.filter((l) =>
        params?.status ? l.status === params.status : l.status === "active",
      );
      if (params?.category) {
        filtered = filtered.filter((l) => l.category === params.category);
      }
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.title.toLowerCase().includes(s) ||
            l.description?.toLowerCase().includes(s),
        );
      }
      const summaries: ListingSummary[] = filtered.map((l) => ({
        id: l.id,
        seller_id: l.seller_id,
        title: l.title,
        brand: l.brand,
        model: l.model,
        category: l.category,
        condition: l.condition,
        listing_type: l.listing_type,
        asking_price: l.asking_price,
        status: l.status,
        carbon_savings_g: l.carbon_savings_g,
        primary_image_url: l.images[0]?.image_url || "",
        created_at: l.created_at,
      }));

      return {
        items: summaries,
        total: summaries.length,
        page: params?.page || 1,
        per_page: params?.per_page || 20,
      };
    }
  },

  async getListingDetail(id: string): Promise<ListingDetailResponse> {
    try {
      return await apiRequest<ListingDetailResponse>(`/listings/${id}`);
    } catch {
      const found = await mockStorage.getListingById(id);
      if (!found) {
        throw new Error("Listing not found");
      }
      return found;
    }
  },

  async createMarketplaceListing(
    payload: CreateListingRequest,
  ): Promise<ListingDetailResponse> {
    try {
      return await apiRequest<ListingDetailResponse>("/listings", {
        method: "POST",
        body: payload,
      });
    } catch {
      const id = `list-${Date.now()}`;
      const newListing: ListingDetailResponse = {
        id,
        seller_id: MOCK_USER.id,
        seller_name: MOCK_USER.display_name,
        campus_id: MOCK_USER.campus_id,
        title: payload.title,
        brand: payload.brand,
        model: payload.model,
        description: payload.description,
        category: payload.category,
        condition: payload.condition,
        listing_type: payload.listing_type,
        asking_price: payload.asking_price,
        status: "active",
        carbon_savings_g: payload.category === "cycles" ? 90000 : 5000,
        technical_specifications: payload.technical_specifications || {},
        specification_provenance: payload.specification_provenance || {},
        images: payload.image_urls.map((url, i) => ({
          id: `img-${Date.now()}-${i}`,
          image_url: url,
          display_order: i,
          angle_label: "front",
        })),
        created_at: new Date().toISOString(),
      };
      await mockStorage.saveListing(newListing);
      return newListing;
    }
  },

  async updateMarketplaceListing(
    id: string,
    payload: UpdateListingRequest,
  ): Promise<ListingDetailResponse> {
    return await apiRequest<ListingDetailResponse>(`/listings/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deleteMarketplaceListing(id: string): Promise<void> {
    await apiRequest<void>(`/listings/${id}`, { method: "DELETE" });
  },

  async getSellerPublicProfileAndListings(
    sellerId: string,
  ): Promise<SellerProfileWithListingsResponse> {
    try {
      return await apiRequest<SellerProfileWithListingsResponse>(
        `/sellers/${sellerId}/listings`,
      );
    } catch {
      const all = await mockStorage.getListings();
      const sellerListings = all.filter(
        (l) => l.seller_id === sellerId && l.status === "active",
      );
      return {
        seller: {
          id: sellerId,
          display_name:
            sellerId === MOCK_USER.id
              ? MOCK_USER.display_name
              : "Campus Seller",
          avatar_url: null,
          verified_student: true,
          campus_id: MOCK_USER.campus_id,
          campus_name: MOCK_USER.campus_name,
          points: 380,
          cumulative_carbon_g: 28000,
        },
        listings: sellerListings.map((l) => ({
          id: l.id,
          seller_id: l.seller_id,
          title: l.title,
          brand: l.brand,
          model: l.model,
          category: l.category,
          condition: l.condition,
          listing_type: l.listing_type,
          asking_price: l.asking_price,
          status: l.status,
          primary_image_url: l.images[0]?.image_url || "",
          created_at: l.created_at,
        })),
      };
    }
  },
};

// ── Inspection & Appraisal ───────────────────────────────────────────────────
export const inspectionsApi = {
  async createInspectionSession(
    payload: CreateInspectionSessionRequest,
  ): Promise<InspectionSessionResponse> {
    try {
      return await apiRequest<InspectionSessionResponse>("/inspections", {
        method: "POST",
        body: payload,
      });
    } catch {
      return {
        inspection_id: `insp-${Date.now()}`,
        status: "created",
        report_version: 1,
        item_category: payload.item_category,
        created_at: new Date().toISOString(),
      };
    }
  },

  async getInspectionDetail(
    inspectionId: string,
  ): Promise<InspectionRecordResponse> {
    return await apiRequest<InspectionRecordResponse>(
      `/inspections/${inspectionId}`,
    );
  },

  async uploadInspectionImage(
    inspectionId: string,
    input: {
      uri: string;
      mimeType?: string | null;
      fileName?: string;
      displayOrder: number;
      angleLabel?: string;
    },
  ): Promise<InspectionImageRecord> {
    const form = new FormData();
    // React Native's fetch expects a `{ uri, name, type }` descriptor rather
    // than a browser `File`; Metro rewrites the uri at upload time.
    form.append("image", {
      uri: input.uri,
      name: input.fileName || `inspection-${input.displayOrder}.jpg`,
      type: input.mimeType || "image/jpeg",
    } as any);
    form.append("display_order", String(input.displayOrder));
    if (input.angleLabel) {
      form.append("angle_label", input.angleLabel);
    }

    try {
      return await apiRequest<InspectionImageRecord>(
        `/inspections/${inspectionId}/images`,
        { method: "POST", body: form, isFormData: true },
      );
    } catch {
      // Offline / backend down: register the photo under its local uri so the
      // capture carousel still renders and the flow can resume later.
      return {
        id: `img-${Date.now()}-${input.displayOrder}`,
        image_url: input.uri,
        display_order: input.displayOrder,
        angle_label: input.angleLabel || "other",
      };
    }
  },

  async runInspectionAnalysis(
    inspectionId: string,
  ): Promise<InspectionAnalysisResultResponse> {
    return await apiRequest<InspectionAnalysisResultResponse>(
      `/inspections/${inspectionId}/analyze`,
      {
        method: "POST",
      },
    );
  },

  async calculatePricingAppraisal(
    inspectionId: string,
  ): Promise<PricingAppraisalResponse> {
    return await apiRequest<PricingAppraisalResponse>(
      `/inspections/${inspectionId}/pricing`,
      {
        method: "POST",
      },
    );
  },

  async disputeDefectFinding(
    inspectionId: string,
    defectId: string,
    payload: DefectDisputeRequest,
  ): Promise<DefectItem> {
    return await apiRequest<DefectItem>(
      `/inspections/${inspectionId}/defects/${defectId}/dispute`,
      {
        method: "POST",
        body: payload,
      },
    );
  },
};

// ── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  async getActiveListingReservation(
    listingId: string,
  ): Promise<ReservationRecord | null> {
    try {
      return await apiRequest<ReservationRecord>(
        `/listings/${listingId}/reservations`,
      );
    } catch {
      const all = await mockStorage.getReservations();
      return (
        all.find((r) => r.listing_id === listingId && r.status === "active") ||
        null
      );
    }
  },

  async createListingReservation(
    listingId: string,
  ): Promise<ReservationRecord> {
    try {
      return await apiRequest<ReservationRecord>(
        `/listings/${listingId}/reservations`,
        {
          method: "POST",
        },
      );
    } catch {
      const record: ReservationRecord = {
        id: `res-${Date.now()}`,
        listing_id: listingId,
        buyer_id: MOCK_USER.id,
        buyer_name: MOCK_USER.display_name,
        status: "active",
        created_at: new Date().toISOString(),
      };
      await mockStorage.addReservation(record);
      return record;
    }
  },

  async listMyReservations(): Promise<MyReservationItem[]> {
    try {
      return await apiRequest<MyReservationItem[]>("/reservations/my");
    } catch {
      const all = await mockStorage.getReservations();
      const myRes = all.filter((r) => r.buyer_id === MOCK_USER.id);
      const listings = await mockStorage.getListings();

      return myRes.map((r) => {
        const l = listings.find((item) => item.id === r.listing_id);
        return {
          reservation: r,
          listing: {
            id: l?.id || r.listing_id,
            seller_id: l?.seller_id || "seller-unknown",
            title: l?.title || "Reserved Item",
            category: l?.category || "electronics",
            condition: l?.condition || "Good",
            listing_type: l?.listing_type || "sell",
            asking_price: l?.asking_price ?? null,
            status: l?.status || "reserved",
            primary_image_url: l?.images[0]?.image_url || "",
            created_at: l?.created_at || new Date().toISOString(),
          },
        };
      });
    }
  },

  async releaseReservation(reservationId: string): Promise<ReservationRecord> {
    return await apiRequest<ReservationRecord>(
      `/reservations/${reservationId}/release`,
      {
        method: "POST",
      },
    );
  },

  async completeReservation(
    reservationId: string,
    payload: CompleteReservationRequest,
  ): Promise<CompletedTransactionResponse> {
    return await apiRequest<CompletedTransactionResponse>(
      `/reservations/${reservationId}/complete`,
      {
        method: "POST",
        body: payload,
      },
    );
  },
};

// ── Need It Want-Board ────────────────────────────────────────────────────────
export const needRequestsApi = {
  async listNeedItRequests(): Promise<NeedRequestRecord[]> {
    try {
      return await apiRequest<NeedRequestRecord[]>("/need-requests");
    } catch {
      return [
        {
          id: "req-1",
          requester_id: MOCK_USER.id,
          requester_name: MOCK_USER.display_name,
          title: "Graphing calculator for finals week (Casio / TI)",
          category: "electronics",
          note: "Needed before Monday morning engineering exam.",
          urgency: "urgent",
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: "req-2",
          requester_id: "user-201",
          requester_name: "Priya Nair",
          title: "Standard first-year engineering drawing kit",
          category: "hostel_essentials",
          note: "Drafting board & T-scale required.",
          urgency: "normal",
          created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
      ];
    }
  },

  async createNeedItRequest(
    payload: CreateNeedRequestPayload,
  ): Promise<NeedRequestRecord> {
    return await apiRequest<NeedRequestRecord>("/need-requests", {
      method: "POST",
      body: payload,
    });
  },

  async deleteNeedItRequest(requestId: string): Promise<void> {
    await apiRequest<void>(`/need-requests/${requestId}`, { method: "DELETE" });
  },

  async getMatchesForNeedRequest(
    requestId: string,
  ): Promise<NeedMatchResult[]> {
    try {
      return await apiRequest<NeedMatchResult[]>(
        `/need-requests/${requestId}/matches`,
      );
    } catch {
      const all = await mockStorage.getListings();
      const first = all[0];
      if (!first) return [];
      return [
        {
          listing: {
            id: first.id,
            seller_id: first.seller_id,
            title: first.title,
            category: first.category,
            condition: first.condition,
            listing_type: first.listing_type,
            asking_price: first.asking_price,
            status: first.status,
            primary_image_url: first.images[0]?.image_url || "",
            created_at: first.created_at,
          },
          match_reason: "Keyword and category matched active campus listing.",
        },
      ];
    }
  },
};

// ── Wishlist ─────────────────────────────────────────────────────────────────
export const wishlistApi = {
  async getMyWishlist(): Promise<ListingSummary[]> {
    try {
      return await apiRequest<ListingSummary[]>("/wishlist");
    } catch {
      return [];
    }
  },

  async addToWishlist(listingId: string): Promise<void> {
    await apiRequest<void>("/wishlist", {
      method: "POST",
      body: { listing_id: listingId },
    });
  },

  async removeFromWishlist(listingId: string): Promise<void> {
    await apiRequest<void>(`/wishlist/${listingId}`, { method: "DELETE" });
  },
};

// ── E-Waste Collection & Optimization ─────────────────────────────────────────
export const ewasteApi = {
  async listEWasteRequests(): Promise<EWasteRequestRecord[]> {
    try {
      return await apiRequest<EWasteRequestRecord[]>("/e-waste/requests");
    } catch {
      return [
        {
          id: "ewaste-1",
          student_id: MOCK_USER.id,
          description: "Dell Inspiron with dead motherboard & bulging battery",
          device_category: "laptops_and_computers",
          lifecycle_assessment: "End-of-life",
          quantity: 1,
          latitude: 18.6251,
          longitude: 73.8198,
          location_name: "Tech Block B, DPU Campus",
          preferred_slot: "Morning (10:00 AM - 1:00 PM)",
          status: "scheduled",
          zone_cluster_id: 0,
          pickup_sequence_order: 1,
          estimated_carbon_kg: 34.5,
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: "ewaste-2",
          student_id: "user-99",
          description: "Swollen Lithium-ion Power Bank & 3 Frayed USB Cables",
          device_category: "batteries_and_power_banks",
          lifecycle_assessment: "End-of-life",
          quantity: 4,
          latitude: 18.6272,
          longitude: 73.8184,
          location_name: "Hostel Block 4 Reception",
          preferred_slot: "Afternoon (2:00 PM - 5:00 PM)",
          status: "pending",
          estimated_carbon_kg: 8.2,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
      ];
    }
  },

  async submitEWasteRequest(
    payload: CreateEWasteSubmissionRequest,
  ): Promise<EWasteRequestRecord> {
    try {
      return await apiRequest<EWasteRequestRecord>("/e-waste/requests", {
        method: "POST",
        body: payload,
      });
    } catch {
      return {
        id: `ewaste-${Date.now()}`,
        student_id: MOCK_USER.id,
        description: payload.description,
        device_category: payload.device_category,
        lifecycle_assessment: payload.lifecycle_assessment || "End-of-life",
        quantity: payload.quantity,
        latitude: payload.latitude,
        longitude: payload.longitude,
        location_name: payload.location_name,
        preferred_slot: payload.preferred_slot,
        status: "pending",
        estimated_carbon_kg: payload.quantity * 15,
        created_at: new Date().toISOString(),
      };
    }
  },

  async optimizeEWasteCollectionRoutes(
    zonesNeeded = 2,
  ): Promise<EWasteOptimizationPlanResponse> {
    try {
      return await apiRequest<EWasteOptimizationPlanResponse>(
        `/e-waste/cluster-and-optimize?zones_needed=${zonesNeeded}`,
        { method: "POST" },
      );
    } catch {
      return {
        message: "Clustering complete and shortest TSP routes sequenced.",
        total_stops_optimized: 3,
        routes_generated: {
          "Zone 0 (Hostel & Tech Quadrant)": ["ewaste-1"],
          "Zone 1 (Library Sector)": ["ewaste-2"],
        },
      };
    }
  },

  async updateEWasteLifecycleStatus(
    requestId: string,
    payload: UpdateEWasteStatusRequest,
  ): Promise<EWasteRequestRecord> {
    return await apiRequest<EWasteRequestRecord>(
      `/e-waste/${requestId}/lifecycle`,
      {
        method: "PATCH",
        body: payload,
      },
    );
  },
};

// ── Sustainability & Leaderboard ─────────────────────────────────────────────
export const sustainabilityApi = {
  async getSustainabilitySummary(): Promise<SustainabilitySummaryResponse> {
    try {
      return await apiRequest<SustainabilitySummaryResponse>(
        "/sustainability/summary",
      );
    } catch {
      return {
        personal_carbon_kg: 32.5,
        campus_carbon_kg: 1840.2,
        items_reused_count: 142,
        ewaste_diverted_kg: 124.8,
        methodology_note:
          "Directional CO2e avoided calculated against standard virgin production baselines.",
      };
    }
  },

  async getCampusLeaderboard(
    campusId?: string,
  ): Promise<LeaderboardStandingItem[]> {
    try {
      const q = campusId ? `?campus_id=${campusId}` : "";
      return await apiRequest<LeaderboardStandingItem[]>(`/leaderboard${q}`);
    } catch {
      return [
        {
          rank: 1,
          user_id: MOCK_USER.id,
          display_name: MOCK_USER.display_name,
          points: 420,
          carbon_saved_kg: 32.5,
        },
        {
          rank: 2,
          user_id: "user-201",
          display_name: "Priya Nair",
          points: 385,
          carbon_saved_kg: 29.8,
        },
        {
          rank: 3,
          user_id: "user-202",
          display_name: "Sneha Patel",
          points: 310,
          carbon_saved_kg: 24.1,
        },
      ];
    }
  },
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  async getMyNotifications(): Promise<NotificationItem[]> {
    try {
      return await apiRequest<NotificationItem[]>("/notifications");
    } catch {
      return [
        {
          id: "n-1",
          type: "reservation",
          actor_name: "Priya Nair",
          message: "Priya Nair reserved your Casio Scientific Calculator.",
          read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "n-2",
          type: "message",
          actor_name: "Rohan Deshmukh",
          message: "Rohan sent a message about Firefox Mountain Cycle.",
          read: false,
          created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ];
    }
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await apiRequest<void>(`/notifications/${id}/read`, { method: "POST" });
  },

  async markAllNotificationsAsRead(): Promise<void> {
    await apiRequest<void>("/notifications/read-all", { method: "POST" });
  },
};
