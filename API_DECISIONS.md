# Artifact 4: `API_DECISIONS.md`

## 1. Unified Architecture Decision: FastAPI-Mediated Persistence

### Background

The repository currently contains three conflicting data representations:

1. Complete PostgreSQL migrations (`supabase/migrations/`) designed for Supabase RLS.
2. Local mobile client persistence using `AsyncStorage` (`app/lib/database.ts`).
3. An active FastAPI backend (`backend/main.py`) paired with an SQLite database (`backend/camplx.db`) containing only an `EWasteRequest` table.

### Decision

FastAPI is designated as the sole external API gateway (`/api/v1`). PocketBase runs as the private persistence layer behind FastAPI. The mobile app communicates exclusively with FastAPI and never executes direct PocketBase queries.

```
┌─────────────────────────────────┐
│   React Native / Expo Mobile    │
│  (TanStack Query + React Hook)  │
└────────────────┬────────────────┘
                 │ HTTPS (/api/v1/*)
                 ▼
┌─────────────────────────────────┐
│      FastAPI Gateway (8000)     │
│  (Business Logic, Auth, Gemini) │
└───────┬─────────────────┬───────┘
        │ Admin API       │ SDK
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│  PocketBase   │ │  Google GenAI │
│ (Persistence) │ │ (Gemini 2.5)  │
└───────────────┘ └───────────────┘
```

**Benefits:**

- Enforces single-active reservation locks and prevents double-booking.
- Keeps the Gemini API key off mobile client devices.
- Manages multi-image uploads, bounding box rendering, and image storage behind consistent URLs.

## 2. Multi-Angle Capture vs. Panorama Stitching

### Analysis

The requirements call for multi-image product inspection. True geometric panorama stitching fails on small rotating 3D objects (e.g., calculators, bicycles) due to parallax, focal depth differences, and hand movement.

### Decision

Multi-angle capture is the primary supported workflow. The seller photographs the item from multiple viewpoints (`front`, `back`, `left`, `right`, `defect_close_up`, `label_or_serial`).

FastAPI preserves every original image in `inspection_images`. Gemini 2.5 Flash analyzes these images concurrently, identifying the main viewpoint for bounding box overlays while extracting technical specifications across all visible angles. Panorama stitching is decoupled and treated as an optional future derivative.

## 3. Defect Annotation Coordinate Order

### Analysis

Bounding box representations can lead to frontend rendering bugs when coordinate conventions are mixed (e.g., `[x, y, w, h]` vs. `[ymin, xmin, ymax, xmax]`).

### Decision

`openapi.yml` standardizes on **normalized coordinates `[ymin, xmin, ymax, xmax]` on a 0–1000 scale**:

- Matches Gemini 2.5 Flash native vision output.
- Matches existing drawing logic in `backend/main.py`:
  ```python
  ymin, xmin, ymax, xmax = defect.box_2d
  top = (ymin / 1000) * img_height
  left = (xmin / 1000) * img_width
  bottom = (ymax / 1000) * img_height
  right = (xmax / 1000) * img_width
  ```
- Matches React Native overlay calculation in `app/app/listing/[id].tsx`:
  ```typescript
  const [ymin, xmin, ymax, xmax] = def.box_2d;
  const top = `${(ymin / 1000) * 100}%`;
  const left = `${(xmin / 1000) * 100}%`;
  const boxHeight = `${((ymax - ymin) / 1000) * 100}%`;
  const boxWidth = `${((xmax - xmin) / 1000) * 100}%`;
  ```

## 4. Immutable Inspection Findings & Seller Clarification

### Analysis

Buyers need to trust AI defect assessments, but sellers must be able to dispute false positives (e.g., mistaking a cleanable smudge for a scratch).

### Decision

AI inspection findings cannot be deleted by the seller. Instead, `POST /inspections/{id}/defects/{defect_id}/dispute` records a seller clarification note alongside the finding. The mobile client displays both the AI finding and the seller rebuttal.

## 5. Pricing Intelligence vs. Asking Price

### Analysis

AI valuations should inform the seller's asking price without overriding it, especially for free donation items.

### Decision

`suggested_listing_price` and `asking_price` are stored in separate fields:

- `inspections.pricing.recommended_listing_price`: Valuation calculated from condition penalties and category baselines.
- `listings.asking_price`: Final asking price entered by the seller (required for `sell`, must be null for `donate`).

If no pricing data is available, the API returns a preliminary estimate flag rather than generating fictitious comparables.

## 6. Single-Active Reservation Hold Invariant

### Analysis

Without payment deposits, multiple buyers could attempt to reserve the same item simultaneously.

### Decision

Reservations are managed atomically by the backend:

- An item can have at most **one** reservation with `status = 'active'`.
- Duplicate reservation requests return `409 Conflict`.
- Releasing the reservation returns the listing to `active`.
- Completing the reservation moves the listing to `sold` or `donated`, archives the reservation, and triggers points/carbon telemetry updates.

## 7. E-Waste Route Optimization Mechanics

### Analysis

`backend/main.py` currently implements K-Means clustering and a TSP nearest-neighbor heuristic on latitude and longitude coordinates.

### Decision

The existing Scikit-Learn K-Means and Haversine TSP algorithms are preserved:

1. `POST /api/v1/e-waste/requests` logs pickup requests with GPS coordinates and a selected time slot.
2. `POST /api/v1/e-waste/cluster-and-optimize` partitions pending requests into collection zones and sequences the stops.
3. The response returns an ordered array of request IDs per zone for driver manifests.
4. Lifecycle updates follow the 4-stage progression: `pending` -> `scheduled` -> `collected` -> `handed_over`.

## 8. Deferred Features

To keep the implementation focused on the core marketplace during the sprint, these features are explicitly deferred:

1. **Live WebSockets:** Replaced with TanStack Query polling (10–30s intervals) for listing state, reservation holds, and e-waste manifests.
2. **Realtime Peer-to-Peer Chat:** Stored in-app message threads can be added later; the current priority is pickup holds and offline transactions.
3. **External Card Payments:** Out of scope by design (facilitate-only model).

---
