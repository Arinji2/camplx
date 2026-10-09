"""Inspections domain — session, uploads, AI analysis, pricing, disputes. OWNER: shared.

FROZEN contracts honored:
  - AI returns findings only; defect IDs, image binding, annotation rendering
    are backend-side.
  - box_2d = [ymin, xmin, ymax, xmax], normalized 0-1000.
  - Original uploads preserved untouched; annotated derivatives stored separately.
  - display_order: client sends 0-based; PB stores 1-based (zero-value quirk).
"""
from __future__ import annotations

import json

from app.core.ai_service import AnalysisResult, run_analysis
from app.core.errors import ApiError
from app.core.format import rfc3339
from app.core.media import sanitize_image_bytes
from app.core.pb import get_pb
from app.schemas.common import ItemCategoryEnum
from app.schemas.inspections import (
    DefectDisputeRequest,
    DefectItem,
    InspectionAnalysisResultResponse,
    InspectionImageRecord,
    InspectionRecordResponse,
    InspectionSessionResponse,
    PricingAppraisalResponse,
)
from app.services import annotate, pricing_service
from app.services.listing_service import _require_safe

_MAX_IMAGES = 10
_ANALYSIS_FIELDS = (
    "identified_product_name",
    "overall_condition",
    "circular_lifecycle_category",
    "analysis",
)


def _media_url(img: dict, field: str) -> str | None:
    from app.config import get_settings

    filename = img.get(field)
    if not filename:
        return None
    base = get_settings().media_base_url.rstrip("/")
    return f"{base}/api/v1/media/{img['id']}/{filename}"


def _image_out(img: dict) -> InspectionImageRecord:
    return InspectionImageRecord(
        id=img["id"],
        image_url=_media_url(img, "image_file") or "",
        annotated_image_url=_media_url(img, "annotated_image"),
        display_order=max(0, int(img.get("display_order") or 1) - 1),
        angle_label=img.get("angle_label") or "other",
    )


async def _owned_inspection(
    user: dict,
    inspection_id: str,
    *,
    missing_status: int = 404,
    missing_code: str = "INSPECTION_NOT_FOUND",
) -> dict:
    # inspection_id is not path-validated as uuid; a malformed id is "not found"
    try:
        _require_safe(inspection_id, "inspection_id")
    except ApiError as exc:
        raise ApiError(missing_status, missing_code, "Inspection not found.") from exc
    try:
        record = await get_pb().collection("inspections").get_one(inspection_id)
    except ApiError as exc:
        if exc.status_code == 404:
            raise ApiError(missing_status, missing_code, "Inspection not found.") from exc
        raise
    if record.get("creator_id") != user["id"]:
        # no existence leak for other creators
        raise ApiError(missing_status, missing_code, "Inspection not found.")
    return record


async def _images_for(inspection_id: str) -> list[dict]:
    # PB 0.40 has no reverse relation expand — query children directly
    items = await get_pb().collection("inspection_images").get_full_list(
        filter=f'inspection_id = "{inspection_id}"'
    )
    return sorted(items, key=lambda i: int(i.get("display_order") or 0))


def _defects_out(analysis: dict | None) -> list[DefectItem]:
    if not analysis:
        return []
    out = []
    for d in analysis.get("defects") or []:
        out.append(
            DefectItem(
                id=d["id"],
                image_id=d["image_id"],
                defect_type=d["defect_type"],
                severity=d["severity"],
                box_2d=d["box_2d"],
                buyer_note=d["buyer_note"],
                dispute_status=d.get("dispute_status", "none"),
                seller_dispute_note=d.get("seller_dispute_note"),
            )
        )
    return out


def _analysis_out(record: dict, images: list[dict]) -> InspectionAnalysisResultResponse | None:
    raw = record.get("analysis")
    if not raw:
        return None
    analysis = json.loads(raw) if isinstance(raw, str) else raw
    listing = analysis.get("amazon_listing") or {}
    prov = analysis.get("specification_provenance") or {}
    return InspectionAnalysisResultResponse(
        inspection_id=record["id"],
        report_version=int(record.get("report_version") or 1),
        identified_product_name=analysis.get("identified_product_name") or record.get("identified_product_name") or "",
        brand=analysis.get("brand"),
        model=analysis.get("model"),
        category=analysis.get("category") or record.get("item_category") or "other",
        overall_condition=analysis.get("overall_condition") or record.get("overall_condition") or "Good",
        circular_lifecycle_category=analysis.get("circular_lifecycle_category")
        or record.get("circular_lifecycle_category")
        or "Reusable",
        defects=_defects_out(analysis),
        amazon_listing=listing,
        images=[_image_out(i) for i in images],
        specification_provenance=prov,
    )


def _pricing_out(record: dict):
    raw = record.get("pricing")
    if not raw:
        return None
    from app.schemas.inspections import PricingIntelligence

    data = json.loads(raw) if isinstance(raw, str) else raw
    return PricingIntelligence.model_validate(data)


async def create_session(user: dict, payload) -> InspectionSessionResponse:
    record = await get_pb().collection("inspections").create(
        {
            "creator_id": user["id"],
            "item_category": str(payload.item_category),
            "seller_notes": payload.seller_notes,
            "status": "created",
            "report_version": 1,
        }
    )
    return InspectionSessionResponse(
        inspection_id=record["id"],
        status=record["status"],
        report_version=int(record["report_version"]),
        item_category=record["item_category"],
        created_at=rfc3339(record.get("created")),
    )


async def upload_image(
    user: dict,
    inspection_id: str,
    content: bytes,
    filename: str,
    display_order: int,
    angle_label: str | None,
) -> InspectionImageRecord:
    # upload contract declares 400 (not 404) for unusable inspection refs
    record = await _owned_inspection(
        user, inspection_id, missing_status=400, missing_code="INSPECTION_NOT_FOUND"
    )
    if len(await _images_for(inspection_id)) >= _MAX_IMAGES:
        raise ApiError(400, "IMAGE_LIMIT", f"At most {_MAX_IMAGES} images per inspection.")
    clean_bytes, _media_type, ext = sanitize_image_bytes(content)

    stored = await get_pb().collection("inspection_images").create_multipart(
        data={
            "inspection_id": inspection_id,
            "display_order": display_order + 1,  # 1-based storage
            "angle_label": angle_label or "other",
        },
        files={"image_file": (f"capture_{display_order + 1}.{ext}", clean_bytes, _media_type)},
    )
    if record.get("status") == "created":
        await get_pb().collection("inspections").update(inspection_id, {"status": "images_uploaded"})
    return _image_out(stored)


async def get_detail(user: dict, inspection_id: str) -> InspectionRecordResponse:
    record = await _owned_inspection(user, inspection_id)
    images = await _images_for(inspection_id)
    return InspectionRecordResponse(
        inspection_id=record["id"],
        status=record["status"],
        report_version=int(record.get("report_version") or 1),
        item_category=record["item_category"],
        seller_notes=record.get("seller_notes") or None,
        images=[_image_out(i) for i in images],
        analysis=_analysis_out(record, images),
        pricing=_pricing_out(record),
        created_at=rfc3339(record.get("created")),
        updated_at=rfc3339(record.get("updated")) or None,
    )


async def _analyze_result(record: dict, images: list[dict]) -> AnalysisResult:
    from app.schemas.common import ItemCategoryEnum as _Cat

    bytes_list = []
    for img in images:
        content, _ = await get_pb().collection("inspection_images").file_bytes(img["id"], img["image_file"])
        bytes_list.append(content)
    return await run_analysis(
        bytes_list,
        _Cat(record["item_category"]),
        record.get("seller_notes") or None,
    )


async def run_inspection_analysis(user: dict, inspection_id: str) -> InspectionAnalysisResultResponse:
    # analyze contract declares 400 (not 404) for unusable inspections
    record = await _owned_inspection(
        user, inspection_id, missing_status=400, missing_code="INSPECTION_NOT_FOUND"
    )
    images = await _images_for(inspection_id)
    if not images:
        raise ApiError(400, "NO_IMAGES", "Upload at least one image before analysis.")

    result = await _analyze_result(record, images)

    # backend binds defect ids + image (FROZEN contract)
    defects: list[dict] = []
    for n, defect in enumerate(result.defects, start=1):
        image = images[(n - 1) % len(images)]
        defects.append(
            {
                "id": f"def-{n}",
                "image_id": image["id"],
                "defect_type": defect.defect_type,
                "severity": defect.severity,
                "box_2d": defect.box_2d,
                "buyer_note": defect.buyer_note,
                "dispute_status": "none",
                "seller_dispute_note": None,
            }
        )

    # annotated derivatives per image (originals untouched)
    for image in images:
        boxes = [tuple(d["box_2d"]) for d in defects if d["image_id"] == image["id"]]
        if not boxes:
            continue
        original, _ = await get_pb().collection("inspection_images").file_bytes(image["id"], image["image_file"])
        annotated = annotate.render_annotated(original, boxes)
        await get_pb().collection("inspection_images").update_multipart(
            image["id"],
            data={},
            files={"annotated_image": (f"annotated_{image['id']}.png", annotated, "image/png")},
        )

    analysis_payload = {
        "identified_product_name": result.identified_product_name,
        "brand": result.brand,
        "model": result.model,
        "category": str(result.category),
        "overall_condition": str(result.overall_condition),
        "circular_lifecycle_category": str(result.circular_lifecycle_category),
        "defects": defects,
        "amazon_listing": result.amazon_listing.model_dump(),
        "specification_provenance": {k: str(v) for k, v in result.specification_provenance.items()},
    }
    version = int(record.get("report_version") or 1) + 1
    await get_pb().collection("inspections").update(
        inspection_id,
        {
            "status": "analyzed",
            "report_version": version,
            "identified_product_name": result.identified_product_name,
            "overall_condition": str(result.overall_condition),
            "circular_lifecycle_category": str(result.circular_lifecycle_category),
            "analysis": json.dumps(analysis_payload),
        },
    )
    refreshed = await get_pb().collection("inspections").get_one(inspection_id)
    images = await _images_for(inspection_id)
    out = _analysis_out(refreshed, images)
    assert out is not None
    return out


async def calculate_pricing_appraisal(user: dict, inspection_id: str) -> PricingAppraisalResponse:
    # pricing contract declares 400 (not 404) for unusable inspections
    record = await _owned_inspection(
        user, inspection_id, missing_status=400, missing_code="INSPECTION_NOT_FOUND"
    )
    if record.get("status") not in ("analyzed", "completed"):
        raise ApiError(400, "NOT_ANALYZED", "Run analysis before pricing appraisal.")
    raw = record.get("analysis")
    analysis = json.loads(raw) if isinstance(raw, str) else (raw or {})

    # campus comparables: active listings with a price, same category
    comparables: list[pricing_service.ComparableListingItem] = []
    if analysis.get("category"):
        data = await get_pb().collection("listings").get_full_list(
            filter=f'category = "{analysis["category"]}" && asking_price > 0 && (status = "active" || status = "sold")',
            sort="-created",
        )
        comparables = [pricing_service.comparable_from_listing(r) for r in data[:5]]

    appraisal = pricing_service.build_appraisal(
        ItemCategoryEnum(analysis.get("category") or record["item_category"]),
        analysis.get("overall_condition") or "Fair",
        comparables,
    )
    await get_pb().collection("inspections").update(
        inspection_id,
        {"status": "completed", "pricing": json.dumps(appraisal.model_dump())},
    )
    return PricingAppraisalResponse(inspection_id=inspection_id, pricing=appraisal, currency="INR")


async def dispute_defect(
    user: dict, inspection_id: str, defect_id: str, payload: DefectDisputeRequest
) -> DefectItem:
    record = await _owned_inspection(user, inspection_id)
    raw = record.get("analysis")
    analysis = json.loads(raw) if isinstance(raw, str) else (raw or {})
    defects = analysis.get("defects") or []
    target = next((d for d in defects if d.get("id") == defect_id), None)
    if target is None:
        raise ApiError(404, "DEFECT_NOT_FOUND", "Defect not found on this inspection.")
    target["dispute_status"] = "disputed_by_seller"
    target["seller_dispute_note"] = payload.seller_note
    analysis["defects"] = defects
    await get_pb().collection("inspections").update(inspection_id, {"analysis": json.dumps(analysis)})
    return DefectItem(
        id=target["id"],
        image_id=target["image_id"],
        defect_type=target["defect_type"],
        severity=target["severity"],
        box_2d=target["box_2d"],
        buyer_note=target["buyer_note"],
        dispute_status=target["dispute_status"],
        seller_dispute_note=target["seller_dispute_note"],
    )
