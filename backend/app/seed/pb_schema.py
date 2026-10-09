"""PocketBase collection bootstrap — idempotent create-or-update.

Run: python -m app.seed.pb_schema
Security: every collection is deny-all ("" = no public API access); FastAPI's
superuser token is the only writer. openapi.yml wins over POCKETBASE_SCHEMA.md.
"""
import asyncio

from app.core.errors import ApiError
from app.core.pb import get_pb

DENY = ""  # empty rule => nobody via public API

CATEGORIES = ["electronics", "books", "cycles", "furniture", "hostel_essentials", "other"]
CONDITIONS = ["Like New", "Good", "Fair", "Needs Repair"]
LIFECYCLES = ["Reusable", "Repairable", "End-of-life"]
LISTING_STATUS = ["active", "reserved", "sold", "donated", "inactive"]
ANGLE_LABELS = [
    "front", "back", "left", "right", "top", "bottom",
    "defect_close_up", "label_or_serial", "other",
]
DEVICE_CATEGORIES = [
    "laptops_and_computers", "phones_and_tablets", "batteries_and_power_banks",
    "chargers_and_cables", "printers_and_peripherals", "audio_and_accessories",
    "other_electronics",
]
EWASTE_STATUS = ["pending", "scheduled", "collected", "handed_over"]
NOTIF_TYPES = ["like", "reservation", "request", "message", "system"]
NOTIF_TARGETS = ["listing", "reservation", "need_request", "chat"]

IMAGE_MIME = ["image/jpeg", "image/png"]
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _text(name: str, required: bool = False, max_len: int = 0) -> dict:
    field = {"name": name, "type": "text", "required": required}
    if max_len:
        field["max"] = max_len
    return field


def _number(name: str, required: bool = False) -> dict:
    return {"name": name, "type": "number", "required": required}


def _bool(name: str, required: bool = False) -> dict:
    return {"name": name, "type": "bool", "required": required}


def _select(name: str, values: list[str], required: bool = False) -> dict:
    return {"name": name, "type": "select", "required": required, "values": values, "maxSelect": 1}


def _relation(name: str, target: str, required: bool = False, max_select: int = 1) -> dict:
    return {
        "name": name, "type": "relation", "required": required,
        "collectionId": target, "maxSelect": max_select, "minSelect": 0,
    }


def _file(name: str, mime: list[str], max_bytes: int, required: bool = False) -> dict:
    return {
        "name": name, "type": "file", "required": required,
        "mimeTypes": mime, "maxSize": max_bytes, "maxSelect": 1,
    }


def _json(name: str, required: bool = False) -> dict:
    return {"name": name, "type": "json", "required": required}


def _autodate(name: str, on_create: bool, on_update: bool = False) -> dict:
    return {"name": name, "type": "autodate", "onCreate": on_create, "onUpdate": on_update}


# order matters: relations only point backwards
COLLECTIONS: list[dict] = [
    {
        "name": "campuses",
        "fields": [
            _text("name", required=True),
            _text("city", required=True),
            _bool("active"),
        ],
        "indexes": [],
    },
    {
        # NOTE: PB ships a default AUTH `users` collection — first bootstrap must
        # run on an empty instance (or delete it) so this lands as a deny-all base
        # collection with no password/auth surface.
        "name": "users",
        "fields": [
            _text("email", required=True),
            _text("display_name", required=True),
            _text("avatar_url"),
            _relation("campus_id", "campuses", required=True),
            _bool("verified_student"),
            _number("points"),
            _number("cumulative_carbon_g"),
        ],
        "indexes": ["CREATE UNIQUE INDEX idx_users_email ON users (email)"],
    },
    {
        "name": "inspections",
        "fields": [
            _relation("creator_id", "users", required=True),
            _select("item_category", CATEGORIES, required=True),
            _text("seller_notes"),
            _select("status", ["created", "images_uploaded", "analyzed", "completed"], required=True),
            _number("report_version", required=True),
            _text("identified_product_name"),
            _select("overall_condition", CONDITIONS),
            _select("circular_lifecycle_category", LIFECYCLES),
            _json("analysis"),
            _json("defects"),
            _json("pricing"),
            _json("amazon_listing"),
            _json("specification_provenance"),
            _autodate("created", on_create=True),
            _autodate("updated", on_create=True, on_update=True),
        ],
        "indexes": [],
    },
    {
        "name": "inspection_images",
        "fields": [
            _relation("inspection_id", "inspections", required=True),
            _file("image_file", IMAGE_MIME, MAX_IMAGE_BYTES, required=True),
            # required number rejects 0 (PB/Go zero-value) — display_order is 1-based
            _number("display_order", required=True),
            _select("angle_label", ANGLE_LABELS, required=True),
            _file("annotated_image", IMAGE_MIME, MAX_IMAGE_BYTES),
        ],
        "indexes": [],
    },
    {
        "name": "listings",
        "fields": [
            _relation("seller_id", "users", required=True),
            _relation("campus_id", "campuses", required=True),
            _relation("inspection_id", "inspections"),
            _select("listing_type", ["sell", "donate"], required=True),
            _text("title", required=True, max_len=160),
            _text("description"),
            _text("brand"),
            _text("model"),
            _select("category", CATEGORIES, required=True),
            _select("condition", CONDITIONS, required=True),
            _number("asking_price"),
            _select("status", LISTING_STATUS, required=True),
            _number("carbon_savings_g"),
            _json("technical_specifications"),
            _json("specification_provenance"),
            _relation("images", "inspection_images", max_select=10),
            _autodate("created", on_create=True),
        ],
        "indexes": [
            "CREATE INDEX idx_listings_campus_status ON listings (campus_id, status)",
            "CREATE INDEX idx_listings_category ON listings (category)",
        ],
    },
    {
        "name": "reservations",
        "fields": [
            _relation("listing_id", "listings", required=True),
            _relation("buyer_id", "users", required=True),
            _relation("campus_id", "campuses", required=True),
            _select("status", ["active", "released", "completed"], required=True),
            _autodate("created", on_create=True),
        ],
        # core invariant: at most ONE active hold per listing (409 backstop)
        "indexes": [
            "CREATE UNIQUE INDEX idx_reservations_single_active "
            "ON reservations (listing_id) WHERE status = 'active'"
        ],
    },
    {
        "name": "wishlists",
        "fields": [
            _relation("user_id", "users", required=True),
            _relation("listing_id", "listings", required=True),
        ],
        "indexes": ["CREATE UNIQUE INDEX idx_wishlists_pair ON wishlists (user_id, listing_id)"],
    },
    {
        "name": "ewaste_requests",
        "fields": [
            _relation("student_id", "users", required=True),
            _text("description", required=True),
            _select("device_category", DEVICE_CATEGORIES, required=True),
            _select("lifecycle_assessment", LIFECYCLES, required=True),
            _number("quantity", required=True),
            _number("latitude", required=True),
            _number("longitude", required=True),
            _text("location_name", required=True),
            _text("preferred_slot", required=True),
            _select("status", EWASTE_STATUS, required=True),
            _number("zone_cluster_id"),
            _number("pickup_sequence_order"),
            _number("estimated_carbon_kg"),
            _text("handler_notes"),
            _text("certified_partner_id"),
            _autodate("created", on_create=True),
        ],
        "indexes": ["CREATE INDEX idx_ewaste_status ON ewaste_requests (status)"],
    },
    {
        "name": "need_requests",
        "fields": [
            _relation("requester_id", "users", required=True),
            _relation("campus_id", "campuses", required=True),
            _text("title", required=True, max_len=160),
            _text("note"),
            _select("category", CATEGORIES, required=True),
            _select("urgency", ["low", "normal", "urgent"], required=True),
            _select("status", ["open", "fulfilled", "cancelled"], required=True),
            _autodate("created", on_create=True),
        ],
        "indexes": [],
    },
    {
        "name": "notifications",
        "fields": [
            _relation("user_id", "users", required=True),
            _select("type", NOTIF_TYPES, required=True),
            _text("actor_name", required=True, max_len=120),
            _text("message", required=True, max_len=500),
            _bool("read"),
            _select("target_entity_type", NOTIF_TARGETS),
            _text("target_entity_id"),
            _autodate("created", on_create=True),
        ],
        "indexes": ["CREATE INDEX idx_notifications_user ON notifications (user_id, read)"],
    },
]


async def ensure_collections() -> dict[str, str]:
    """Create-or-update all collections. Returns {name: collection_id}.

    COLLECTIONS order guarantees every relation target is resolved before use.
    """
    pb = get_pb()
    ids: dict[str, str] = {}

    for spec in COLLECTIONS:
        name = spec["name"]
        fields = []
        for field in spec["fields"]:
            field = dict(field)
            if field["type"] == "relation":
                field["collectionId"] = await _collection_id(field["collectionId"], ids)
            fields.append(field)
        payload = {
            "name": name,
            "type": "base",
            "listRule": DENY, "viewRule": DENY,
            "createRule": DENY, "updateRule": DENY, "deleteRule": DENY,
            "fields": fields,
            "indexes": spec["indexes"],
        }
        ids[name] = await _upsert(pb, name, payload)
    return ids


async def _collection_id(name: str, ids: dict[str, str]) -> str:
    if name not in ids:
        raise RuntimeError(f"collection {name} must be defined before use")
    return ids[name]


async def _upsert(pb, name: str, payload: dict) -> str:
    """GET -> PATCH(update rules/indexes/fields) or POST(create)."""
    try:
        existing = await pb._request("GET", f"/api/collections/{name}")
    except ApiError as exc:
        if exc.status_code != 404:
            raise
        rec = await pb._request("POST", "/api/collections", json=payload)
        return rec["id"]
    patch = {**payload, "id": existing["id"]}
    try:
        rec = await pb._request("PATCH", f"/api/collections/{name}", json=patch)
        return rec["id"]
    except ApiError:
        # field schema conflicts on update: keep existing fields, refresh rules+indexes
        rec = await pb._request(
            "PATCH",
            f"/api/collections/{name}",
            json={
                "id": existing["id"],
                "listRule": DENY, "viewRule": DENY,
                "createRule": DENY, "updateRule": DENY, "deleteRule": DENY,
                "indexes": payload["indexes"],
            },
        )
        return rec["id"]


async def seed_campus() -> str:
    """Ensure default pilot campus exists; returns its id."""
    pb = get_pb()
    found = await pb.collection("campuses").get_list(filter="name = 'Dr. D. Y. Patil Vidyapeeth (DPU Pune)'")
    if found.get("items"):
        return found["items"][0]["id"]
    rec = await pb.collection("campuses").create(
        {"name": "Dr. D. Y. Patil Vidyapeeth (DPU Pune)", "city": "Pune", "active": True}
    )
    return rec["id"]


async def bootstrap() -> dict[str, str]:
    ids = await ensure_collections()
    ids["campuses_seed"] = await seed_campus()
    return ids


if __name__ == "__main__":
    result = asyncio.run(bootstrap())
    print("collections ready:")
    for k, v in result.items():
        print(f"  {k}: {v}")
