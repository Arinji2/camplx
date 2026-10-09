"""Clean demo seed — wipe records (schema intact), seed campus users + listings.

Usage: .venv/bin/python -m app.seed.demo_data
"""
from __future__ import annotations

import asyncio

from app.core.pb import get_pb
from app.seed.pb_schema import bootstrap

# wipe order respects relations (children first)
_COLLECTIONS = [
    "notifications",
    "wishlists",
    "reservations",
    "listings",
    "inspection_images",
    "inspections",
    "ewaste_requests",
    "need_requests",
    "users",
    "campuses",
]

_DEMO_USERS = [
    ("aarav.sharma@dpu.edu.in", "Aarav Sharma", 420, 32_500),
    ("priya.nair@dpu.edu.in", "Priya Nair", 310, 24_000),
    ("rohan.desai@dpu.edu.in", "Rohan Desai", 180, 11_200),
    ("sara.khan@dpu.edu.in", "Sara Khan", 95, 6_400),
]


async def wipe() -> None:
    pb = get_pb()
    for name in _COLLECTIONS:
        for record in await pb.collection(name).get_full_list():
            await pb.collection(name).delete(record["id"])


async def seed() -> None:
    pb = get_pb()
    await bootstrap()
    campus_id = (await pb.collection("campuses").get_list(per_page=1))["items"][0]["id"]

    ids: dict[str, str] = {}
    for email, name, points, carbon_g in _DEMO_USERS:
        record = await pb.collection("users").create(
            {
                "email": email,
                "display_name": name,
                "campus_id": campus_id,
                "verified_student": True,
                "points": points,
                "cumulative_carbon_g": carbon_g,
            }
        )
        ids[email] = record["id"]

    seller_id = ids["aarav.sharma@dpu.edu.in"]
    # one inspection + image so listings can carry media
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (64, 64), "#ddd").save(buf, format="PNG")
    png = buf.getvalue()

    samples = [
        ("Casio FX-991EX ClassWiz Scientific Calculator", "electronics", "sell", 950, "Like New", "Casio", "FX-991EX"),
        ("Study Table (Hostel Oak Finish)", "furniture", "sell", 700, "Good", None, None),
        ("Python Crash Course (3rd Edition)", "books", "donate", None, "Good", "No Starch Press", None),
        ("Hercules Roadeo Cycle", "cycles", "sell", 4500, "Fair", "Hercules", "Roadeo"),
        ("Boat Rockerz Headphones", "electronics", "donate", None, "Needs Repair", "Boat", None),
    ]
    for title, category, listing_type, price, condition, brand, model in samples:
        insp = await pb.collection("inspections").create(
            {"creator_id": seller_id, "item_category": category, "status": "images_uploaded", "report_version": 1}
        )
        img = await pb.collection("inspection_images").create_multipart(
            data={"inspection_id": insp["id"], "display_order": 1, "angle_label": "front"},
            files={"image_file": ("front.png", png, "image/png")},
        )
        await pb.collection("listings").create(
            {
                "seller_id": seller_id,
                "campus_id": campus_id,
                "inspection_id": insp["id"],
                "listing_type": listing_type,
                "title": title,
                "brand": brand,
                "model": model,
                "category": category,
                "condition": condition,
                "asking_price": price,
                "status": "active",
                "carbon_savings_g": {"electronics": 3500, "cycles": 8000, "furniture": 6000, "books": 400}.get(category, 1000),
                "images": [img["id"]],
            }
        )

    print(f"Seeded {len(_DEMO_USERS)} users, {len(samples)} listings on campus {campus_id}")


async def main() -> None:
    await wipe()
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
