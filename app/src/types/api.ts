export type ItemCategory =
  | "electronics"
  | "books"
  | "cycles"
  | "furniture"
  | "hostel_essentials"
  | "other";

export type ListingType = "sell" | "donate";

export type ListingStatus =
  | "active"
  | "reserved"
  | "sold"
  | "donated"
  | "inactive";

export type ConditionGrade = "Like New" | "Good" | "Fair" | "Needs Repair";

export type LifecycleCategory = "Reusable" | "Repairable" | "End-of-life";

export type EWasteDeviceCategory =
  | "laptops_and_computers"
  | "phones_and_tablets"
  | "batteries_and_power_banks"
  | "chargers_and_cables"
  | "printers_and_peripherals"
  | "audio_and_accessories"
  | "other_electronics";

export type ReservationStatus = "active" | "released" | "completed";

export type NeedUrgency = "low" | "normal" | "urgent";

export type EWasteLifecycleStatus =
  | "pending"
  | "scheduled"
  | "collected"
  | "handed_over";

export type DataSufficiency = "sufficient" | "limited" | "insufficient";

export type ComparableSourceType =
  | "internal_camplx_active"
  | "internal_camplx_sold"
  | "external_marketplace"
  | "catalog_benchmark";

export type AttributeProvenance =
  | "visually_verified"
  | "seller_supplied"
  | "catalog_inferred"
  | "ai_estimated";

export type ErrorResponse = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type HealthStatusResponse = {
  status: string;
  timestamp: string;
  database_connected: boolean;
  ai_service_available: boolean;
};

export type DemoSessionRequest = {
  email: string;
  display_name?: string;
};

export type UserProfileResponse = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  verified_student: boolean;
  campus_id: string;
  campus_name: string;
  points: number;
  cumulative_carbon_g: number;
};

export type UserProfileUpdateRequest = {
  /** Minimum 2 characters per `openapi.yml`. */
  display_name?: string;
  avatar_url?: string | null;
};

export type AuthSessionResponse = {
  token: string;
  user: UserProfileResponse;
};

export type PublicSellerProfileResponse = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  verified_student: boolean;
  campus_id: string;
  campus_name: string;
  points: number;
  cumulative_carbon_g: number;
};

export type InspectionImageRecord = {
  id: string;
  image_url: string;
  annotated_image_url?: string | null;
  display_order: number;
  angle_label: string;
};

export type DefectItem = {
  id: string;
  image_id: string;
  defect_type: string;
  severity: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  buyer_note: string;
  dispute_status: "none" | "disputed_by_seller" | "resolved";
  seller_dispute_note?: string | null;
};

export type DefectDisputeRequest = {
  /** Seller's clarification note, recorded alongside the immutable AI finding. */
  seller_note: string;
};

export type ComparableListingItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  condition: ConditionGrade;
  source_type: ComparableSourceType;
  source_name: string;
  source_url?: string | null;
  observed_at: string;
};

export type PricingIntelligence = {
  data_sufficiency: DataSufficiency;
  insufficient_data_reason?: string | null;
  estimated_retail_new?: number | null;
  typical_used_market_price?: number | null;
  condition_penalty_amount?: number | null;
  recommended_min_price?: number | null;
  recommended_listing_price: number | null;
  recommended_max_price?: number | null;
  pricing_rationale: string;
  comparables_count: number;
  comparables: ComparableListingItem[];
};

export type AmazonStyleListing = {
  title: string;
  key_features_bullets: string[];
  technical_specifications: Record<string, string>;
  seller_condition_summary: string;
};

export type CreateInspectionSessionRequest = {
  item_category: ItemCategory;
  seller_notes?: string;
};

export type InspectionSessionResponse = {
  inspection_id: string;
  status: "created" | "images_uploaded" | "analyzed" | "completed";
  report_version: number;
  item_category: ItemCategory;
  created_at: string;
};

export type InspectionAnalysisResultResponse = {
  inspection_id: string;
  report_version: number;
  identified_product_name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  overall_condition: ConditionGrade;
  circular_lifecycle_category: LifecycleCategory;
  defects: DefectItem[];
  amazon_listing: AmazonStyleListing;
  images: InspectionImageRecord[];
  specification_provenance: Record<string, AttributeProvenance>;
};

export type InspectionRecordResponse = {
  inspection_id: string;
  status: "created" | "images_uploaded" | "analyzed" | "completed";
  report_version: number;
  item_category: ItemCategory;
  seller_notes?: string | null;
  images: InspectionImageRecord[];
  analysis?: InspectionAnalysisResultResponse | null;
  pricing?: PricingIntelligence | null;
  created_at: string;
  updated_at?: string;
};

export type PricingAppraisalResponse = {
  inspection_id: string;
  pricing: PricingIntelligence;
  currency: string;
};

export type CreateListingRequest = {
  title: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  category: ItemCategory;
  condition: ConditionGrade;
  listing_type: ListingType;
  asking_price?: number | null;
  inspection_id?: string | null;
  technical_specifications?: Record<string, string>;
  specification_provenance?: Record<string, AttributeProvenance>;
  image_urls: string[];
};

export type UpdateListingRequest = {
  title?: string;
  description?: string | null;
  asking_price?: number | null;
  status?: "active" | "inactive";
};

export type ListingSummary = {
  id: string;
  seller_id: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  category: ItemCategory;
  condition: ConditionGrade;
  listing_type: ListingType;
  asking_price?: number | null;
  status: ListingStatus;
  carbon_savings_g?: number;
  primary_image_url: string;
  created_at: string;
};

export type ListingDetailResponse = {
  id: string;
  seller_id: string;
  seller_name: string;
  campus_id: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  category: ItemCategory;
  condition: ConditionGrade;
  listing_type: ListingType;
  asking_price?: number | null;
  status: ListingStatus;
  carbon_savings_g?: number;
  technical_specifications?: Record<string, string>;
  specification_provenance?: Record<string, AttributeProvenance>;
  images: InspectionImageRecord[];
  inspection?: InspectionAnalysisResultResponse | null;
  pricing_intelligence?: PricingIntelligence | null;
  active_reservation?: ReservationRecord | null;
  created_at: string;
};

export type PaginatedListingsResponse = {
  items: ListingSummary[];
  total: number;
  page: number;
  per_page: number;
};

export type SellerProfileWithListingsResponse = {
  seller: PublicSellerProfileResponse;
  listings: ListingSummary[];
};

export type ReservationRecord = {
  id: string;
  listing_id: string;
  buyer_id: string;
  buyer_name: string;
  status: ReservationStatus;
  created_at: string;
};

export type MyReservationItem = {
  reservation: ReservationRecord;
  listing: ListingSummary;
};

export type CompleteReservationRequest = {
  outcome: "sold" | "donated";
};

export type CompletedTransactionResponse = {
  reservation_id: string;
  listing_id: string;
  final_status: "sold" | "donated";
  carbon_savings_g: number;
  points_awarded: number;
};

export type CreateNeedRequestPayload = {
  title: string;
  category: ItemCategory;
  note?: string | null;
  urgency?: NeedUrgency;
};

export type NeedRequestRecord = {
  id: string;
  requester_id: string;
  requester_name: string;
  title: string;
  note?: string | null;
  category: ItemCategory;
  urgency: NeedUrgency;
  created_at: string;
};

export type NeedMatchResult = {
  listing: ListingSummary;
  match_reason: string;
};

export type CreateEWasteSubmissionRequest = {
  description: string;
  device_category: EWasteDeviceCategory;
  lifecycle_assessment?: LifecycleCategory;
  quantity: number;
  latitude: number;
  longitude: number;
  location_name: string;
  preferred_slot: string;
};

export type EWasteRequestRecord = {
  id: string;
  student_id: string;
  description: string;
  device_category: EWasteDeviceCategory;
  lifecycle_assessment: LifecycleCategory;
  quantity: number;
  latitude: number;
  longitude: number;
  location_name: string;
  preferred_slot: string;
  status: EWasteLifecycleStatus;
  zone_cluster_id?: number | null;
  pickup_sequence_order?: number | null;
  estimated_carbon_kg: number;
  created_at: string;
};

export type UpdateEWasteStatusRequest = {
  status: EWasteLifecycleStatus;
  handler_notes?: string | null;
  certified_partner_id?: string | null;
};

export type EWasteOptimizationPlanResponse = {
  message: string;
  total_stops_optimized: number;
  routes_generated: Record<string, string[]>;
};

export type SustainabilitySummaryResponse = {
  personal_carbon_kg: number;
  campus_carbon_kg: number;
  items_reused_count: number;
  ewaste_diverted_kg: number;
  methodology_note: string;
};

export type LeaderboardStandingItem = {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  carbon_saved_kg: number;
};

export type NotificationItem = {
  id: string;
  type: "like" | "reservation" | "request" | "message" | "system";
  actor_name: string;
  message: string;
  read: boolean;
  target_entity_type?:
    | "listing"
    | "reservation"
    | "need_request"
    | "chat"
    | null;
  target_entity_id?: string | null;
  created_at: string;
};
