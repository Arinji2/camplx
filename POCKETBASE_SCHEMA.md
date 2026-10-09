# Artifact 2: `POCKETBASE_SCHEMA.md`

## 1. PocketBase Integration & Architecture Boundary

- **FastAPI as Trusted Backend:** PocketBase runs as the private persistence layer (`127.0.0.1:8090`).
- **Access Rule Policy:** Public API access is disabled (`@request.auth.id != ""` or locked with Admin Token). The React Native client never accesses PocketBase directly; all mobile calls go through FastAPI, which uses a PocketBase Admin/Service Account.
- **File Assets:** Uploaded original inspection images and generated bounding box derivatives are stored in PocketBase File fields and served through FastAPI's media endpoints.

## 2. Collection Definitions

### `campuses`

| Field Name | Type        | Constraints / Rules                                     | Description                                  |
| :--------- | :---------- | :------------------------------------------------------ | :------------------------------------------- |
| `id`       | `text` (PK) | 15 alphanumeric characters (PB standard) or UUID string | Campus unique ID                             |
| `name`     | `text`      | Required                                                | e.g. "Dr. D. Y. Patil Vidyapeeth (DPU Pune)" |
| `city`     | `text`      | Required                                                | e.g. "Pune"                                  |
| `active`   | `bool`      | Default `true`                                          | Campus pilot toggle                          |

### `users` (Auth Collection)

| Field Name            | Type        | Constraints / Rules                              | Description                      |
| :-------------------- | :---------- | :----------------------------------------------- | :------------------------------- |
| `id`                  | `text` (PK) | Auto / Stable UUID                               | User unique ID                   |
| `email`               | `email`     | Required, Unique                                 | Institutional student email      |
| `display_name`        | `text`      | Required                                         | Full student name                |
| `campus_id`           | `relation`  | Relation to `campuses.id`, Cascade Delete: false | Affiliated university campus     |
| `verified_student`    | `bool`      | Server managed, Default: `true`                  | Domain-verified badge flag       |
| `points`              | `number`    | Server managed, Default: `0`                     | Gamification rewards score       |
| `cumulative_carbon_g` | `number`    | Server managed, Default: `0`                     | Avoided carbon telemetry (grams) |
| `avatar`              | `file`      | MIME: image/\*, Max: 5MB                         | Profile photograph               |

### `inspections`

| Field Name                    | Type        | Constraints / Rules                                                         | Description                                       |
| :---------------------------- | :---------- | :-------------------------------------------------------------------------- | :------------------------------------------------ |
| `id`                          | `text` (PK) | Auto ID                                                                     | Inspection session identifier                     |
| `creator_id`                  | `relation`  | Relation to `users.id`                                                      | Student conducting appraisal                      |
| `category`                    | `select`    | `electronics`, `books`, `cycles`, `furniture`, `hostel_essentials`, `other` | Target item taxonomy                              |
| `seller_notes`                | `text`      | Optional                                                                    | Contextual wear description                       |
| `identified_product_name`     | `text`      | Model generated                                                             | Brand, series, and item extraction                |
| `overall_condition`           | `select`    | `Like New`, `Good`, `Fair`, `Needs Repair`                                  | Final evaluated grade                             |
| `circular_lifecycle_category` | `select`    | `Reusable`, `Repairable`, `End-of-life`                                     | Circular taxonomy assignment                      |
| `defects`                     | `json`      | Array of `DefectItem` objects                                               | Normalized coordinates `[ymin, xmin, ymax, xmax]` |
| `pricing`                     | `json`      | Structured `PricingIntelligence` object                                     | Valuations in INR                                 |
| `amazon_listing`              | `json`      | Structured `AmazonStyleListing` object                                      | Bullet points & technical specifications          |
| `annotated_image`             | `file`      | MIME: image/jpeg                                                            | Image with rendered bounding boxes                |
| `status`                      | `select`    | `created`, `images_uploaded`, `analyzed`, `completed`                       | Workflow state machine                            |

### `inspection_images`

| Field Name      | Type        | Constraints / Rules                                                                              | Description                   |
| :-------------- | :---------- | :----------------------------------------------------------------------------------------------- | :---------------------------- |
| `id`            | `text` (PK) | Auto ID                                                                                          | Photo asset identifier        |
| `inspection_id` | `relation`  | Relation to `inspections.id`, Cascade Delete: true                                               | Owning inspection session     |
| `image_file`    | `file`      | MIME: image/jpeg, image/png, Max: 15MB                                                           | Original image file           |
| `display_order` | `number`    | Default: `0`                                                                                     | Sequence ordering in gallery  |
| `angle_label`   | `select`    | `front`, `back`, `left`, `right`, `top`, `bottom`, `defect_close_up`, `label_or_serial`, `other` | Multi-angle capture angle tag |

### `listings`

| Field Name         | Type        | Constraints / Rules                                                         | Description                      |
| :----------------- | :---------- | :-------------------------------------------------------------------------- | :------------------------------- |
| `id`               | `text` (PK) | Auto ID                                                                     | Marketplace listing ID           |
| `seller_id`        | `relation`  | Relation to `users.id`                                                      | Owning student                   |
| `campus_id`        | `relation`  | Relation to `campuses.id`                                                   | Scoped university campus         |
| `inspection_id`    | `relation`  | Relation to `inspections.id`, Optional                                      | Associated AI quality inspection |
| `listing_type`     | `select`    | `sell`, `donate`                                                            | Intent classification            |
| `title`            | `text`      | Required                                                                    | Search-optimized product title   |
| `description`      | `text`      | Optional                                                                    | Seller condition description     |
| `category`         | `select`    | `electronics`, `books`, `cycles`, `furniture`, `hostel_essentials`, `other` | Campus category classification   |
| `condition`        | `select`    | `Like New`, `Good`, `Fair`, `Needs Repair`                                  | Condition grading tag            |
| `asking_price`     | `number`    | Nullable if `listing_type == 'donate'`                                      | Final seller price in INR        |
| `status`           | `select`    | `active`, `reserved`, `sold`, `donated`, `inactive`                         | Availability status              |
| `carbon_savings_g` | `number`    | Directional estimate baseline                                               | Avoided CO2e in grams            |
| `images`           | `relation`  | Multiple relations to `inspection_images.id`                                | Listing photo gallery            |

### `reservations`

| Field Name           | Type        | Constraints / Rules                                    | Description                      |
| :------------------- | :---------- | :----------------------------------------------------- | :------------------------------- |
| `id`                 | `text` (PK) | Auto ID                                                | Hold agreement ID                |
| `listing_id`         | `relation`  | Relation to `listings.id`                              | Target listing                   |
| `buyer_id`           | `relation`  | Relation to `users.id`                                 | Reserving peer                   |
| `campus_id`          | `relation`  | Relation to `campuses.id`                              | Campus boundary verification     |
| `status`             | `select`    | `active`, `released`, `completed`                      | Hold state machine               |
| _Single Active Rule_ | _Index_     | Unique index on `listing_id` where `status = 'active'` | Enforces single reservation hold |

### `need_requests`

| Field Name     | Type        | Constraints / Rules              | Description                        |
| :------------- | :---------- | :------------------------------- | :--------------------------------- |
| `id`           | `text` (PK) | Auto ID                          | Demand record ID                   |
| `requester_id` | `relation`  | Relation to `users.id`           | Student requesting item            |
| `campus_id`    | `relation`  | Relation to `campuses.id`        | Campus location                    |
| `title`        | `text`      | Required                         | Item requested                     |
| `note`         | `text`      | Optional                         | Course, condition, or budget notes |
| `category`     | `select`    | Standard taxonomy                | Desired category                   |
| `urgency`      | `select`    | `low`, `normal`, `urgent`        | Priority badge indicator           |
| `status`       | `select`    | `open`, `fulfilled`, `cancelled` | Request status                     |

### `wishlists`

| Field Name        | Type        | Constraints / Rules                             | Description               |
| :---------------- | :---------- | :---------------------------------------------- | :------------------------ |
| `id`              | `text` (PK) | Auto ID                                         | Bookmark ID               |
| `user_id`         | `relation`  | Relation to `users.id`                          | Owner                     |
| `listing_id`      | `relation`  | Relation to `listings.id`, Cascade Delete: true | Saved marketplace listing |
| _Composite Index_ | _Index_     | Unique (`user_id`, `listing_id`)                | Prevents duplicate saves  |

### `ewaste_requests`

| Field Name            | Type        | Constraints / Rules                                | Description                            |
| :-------------------- | :---------- | :------------------------------------------------- | :------------------------------------- |
| `id`                  | `text` (PK) | Auto ID                                            | E-waste submission ID                  |
| `student_id`          | `relation`  | Relation to `users.id`                             | Submitting student                     |
| `description`         | `text`      | Required                                           | Device type & failure mode             |
| `item_category`       | `select`    | `End-of-life`, `Repairable`                        | Recovery route indicator               |
| `quantity`            | `number`    | Minimum: `1`                                       | Count of units                         |
| `latitude`            | `number`    | Float coordinate                                   | Pickup node latitude                   |
| `longitude`           | `number`    | Float coordinate                                   | Pickup node longitude                  |
| `location_name`       | `text`      | Campus collection station                          | e.g. "Tech Block B Collection Station" |
| `preferred_slot`      | `text`      | Selected time window                               | Morning, Afternoon, Weekend            |
| `status`              | `select`    | `pending`, `scheduled`, `collected`, `handed_over` | 4-stage lifecycle                      |
| `zone_cluster_id`     | `number`    | Nullable, set by K-Means                           | Geometric cluster index                |
| `pickup_sequence`     | `number`    | Nullable, set by TSP solver                        | Order within zone pickup run           |
| `estimated_carbon_kg` | `number`    | Automated displacement baseline                    | Diverted carbon (kg)                   |

### `notifications`

| Field Name           | Type        | Constraints / Rules                                   | Description                  |
| :------------------- | :---------- | :---------------------------------------------------- | :--------------------------- |
| `id`                 | `text` (PK) | Auto ID                                               | In-app notification record   |
| `user_id`            | `relation`  | Relation to `users.id`                                | Target recipient             |
| `type`               | `select`    | `like`, `reservation`, `request`, `message`, `system` | Visual icon discriminator    |
| `actor_name`         | `text`      | Triggering student name                               | Rendered in notification row |
| `message`            | `text`      | Explanatory description                               | Content text                 |
| `read`               | `bool`      | Default: `false`                                      | Read/unread flag             |
| `target_entity_type` | `text`      | `listing`, `reservation`, `need_request`, `chat`      | Deep-link routing target     |
| `target_entity_id`   | `text`      | Associated record ID                                  | Deep-link resource ID        |

---

---
