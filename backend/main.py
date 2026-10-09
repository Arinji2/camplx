import os
import json
import logging
import base64
from typing import Dict, List, Optional
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
import io
import numpy as np
from sklearn.cluster import KMeans
from sqlalchemy.orm import Session
from database import get_db, EWasteRequest, LifecycleStatus

logger = logging.getLogger(__name__)

load_dotenv()

# Initialize Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in environment variables.")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(
    title="Camplx Circular Marketplace Backend",
    description="AI Image Inspection, Defect Detection, Dynamic Pricing, and Amazon-style Listing Generation",
    version="1.0.0"
)

# Enable CORS for React Native Local Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC SCHEMAS -----------------

class DefectAnnotation(BaseModel):
    defect_type: str = Field(description="Type of issue: Scratch, Dent, Screen Crack, Discoloration, Port Damage, Heavy Wear")
    severity: str = Field(description="Cosmetic Minor, Moderate, or Severe/Functional")
    box_2d: List[int] = Field(
        min_length=4,
        max_length=4,
        description="Bounding box coordinates normalized to [ymin, xmin, ymax, xmax] on a 0-1000 scale"
    )
    buyer_note: str = Field(description="Clear explanation of the flaw for buyer transparency")

class PricingIntelligence(BaseModel):
    estimated_retail_new: float = Field(description="Estimated original or current retail price in INR")
    typical_used_market_price: float = Field(description="Current average pre-owned market rate in INR for good condition")
    condition_penalty_amount: float = Field(description="Depreciation value deducted due to visible defects in INR")
    recommended_min_price: float = Field(description="Lower boundary of fair campus asking price in INR")
    recommended_listing_price: float = Field(description="Optimal asking price recommendation in INR")
    recommended_max_price: float = Field(description="Upper boundary for negotiation in INR")
    pricing_rationale: str = Field(description="Why this price was recommended based on model, age, and condition")

class AmazonStyleDescription(BaseModel):
    title: str = Field(description="Structured, search-optimized title (e.g. Brand + Model + Key Spec + Condition)")
    key_features_bullets: List[str] = Field(description="4-5 Amazon-style bullet points highlighting specs, utility, and honest condition")
    technical_specifications: Dict[str, str] = Field(description="Key-value pairs of technical specifications extracted or inferred (Brand, Model, Color, Category, etc.), with values represented as strings")
    seller_condition_summary: str = Field(description="Concise condition assessment summary for the product page")

# ProductAnalysisResponse must be defined FIRST
class ProductAnalysisResponse(BaseModel):
    identified_product_name: str
    category: str
    overall_condition: str = Field(description="Like New, Good, Fair, or Needs Repair")
    circular_lifecycle_category: str = Field(
        description="Reusable (marketplace sale/donation), Repairable (refurbishment), or End-of-life (e-waste recovery)"
    )
    defects: List[DefectAnnotation]
    pricing: PricingIntelligence
    amazon_listing: AmazonStyleDescription

# AnnotatedProductResponse references ProductAnalysisResponse, so it comes SECOND
class AnnotatedProductResponse(BaseModel):
    analysis: ProductAnalysisResponse
    annotated_image_base64: str

class EWasteSubmission(BaseModel):
    student_id: str
    item_category: str
    quantity: int
    latitude: float
    longitude: float

class StatusUpdate(BaseModel):
    status: LifecycleStatus

# ----------------- STEP 2: CLUSTER & OPTIMIZE ALGORITHMS -----------------

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates geographical distance between two points in km."""
    R = 6371.0 
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2)**2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c

def optimize_tsp_route(locations):
    """Nearest-neighbor algorithm to sequence pickups efficiently."""
    if not locations: 
        return []
    unvisited = locations.copy()
    current = unvisited.pop(0)
    ordered_ids = [current['id']]

    while unvisited:
        nearest = min(unvisited, key=lambda loc: haversine_distance(
            current['lat'], current['lon'], loc['lat'], loc['lon']
        ))
        ordered_ids.append(nearest['id'])
        unvisited.remove(nearest)
        current = nearest
        
    return ordered_ids

# ----------------- E-WASTE ENDPOINTS -----------------

@app.post("/api/e-waste/submit")
def submit_ewaste_request(request: EWasteSubmission, db: Session = Depends(get_db)):
    """Step 1: Students submit requests with coordinates."""
    new_request = EWasteRequest(
        student_id=request.student_id,
        item_category=request.item_category,
        quantity=request.quantity,
        latitude=request.latitude,
        longitude=request.longitude
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return {"message": "Request logged", "id": new_request.id}


@app.post("/api/e-waste/cluster-and-optimize")
def run_clustering_and_routing(zones_needed: int = 2, db: Session = Depends(get_db)):
    """
    Step 2: Groups nearby PENDING requests into zones using K-Means, 
    generates a collection order, and upgrades status to SCHEDULED.
    """
    all_requests = db.query(EWasteRequest).all()
    
    if len(all_requests) < zones_needed:
        # Fallback if fewer requests than zones
        zones_needed = max(1, len(all_requests))

    if not all_requests:
        return {"error": "No requests available to cluster."}

    coords = np.array([[req.latitude, req.longitude] for req in all_requests])
    
    # 1. Cluster into geographic zones
    kmeans = KMeans(n_clusters=zones_needed, n_init=10, random_state=42)
    labels = kmeans.fit_predict(coords)

    for i, req in enumerate(all_requests):
        req.zone_cluster_id = int(labels[i])
        
    db.commit()

    # 2. Optimize routes within each cluster zone
    optimized_routes = {}
    for zone in range(zones_needed):
        zone_reqs = [r for r in all_requests if r.zone_cluster_id == zone]
        loc_data = [{'id': r.id, 'lat': r.latitude, 'lon': r.longitude} for r in zone_reqs]
        
        sequence = optimize_tsp_route(loc_data)
        optimized_routes[f"Zone {zone}"] = sequence
        
        for order_index, req_id in enumerate(sequence):
            req_to_update = next(r for r in zone_reqs if r.id == req_id)
            req_to_update.pickup_sequence_order = order_index + 1
            req_to_update.status = LifecycleStatus.SCHEDULED

    db.commit()
    return {
        "message": "Clustering complete and routes optimized.",
        "routes_generated": optimized_routes
    }


@app.patch("/api/e-waste/{request_id}/lifecycle")
def update_lifecycle_status(request_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    """Step 3: Track lifecycle (e.g., driver marks as COLLECTED, partner marks as HANDED_OVER)."""
    db_req = db.query(EWasteRequest).filter(EWasteRequest.id == request_id).first()
    
    if not db_req:
        return {"error": "Request not found"}
        
    db_req.status = payload.status
    db.commit()
    
    return {
        "message": "Lifecycle updated successfully", 
        "id": db_req.id, 
        "new_status": db_req.status
    }

# ----------------- SYSTEM INSTRUCTION -----------------

SYSTEM_PROMPT = """
You are an expert AI quality inspector, electronics appraiser, and e-commerce copywriter for Camplx, a circular campus marketplace.

Analyze the uploaded product image in detail:
1. Product Identification: Identify brand, model, and category accurately.
2. Defect Inspection: Inspect for scratches, scuffs, screen bleeds, dents, sticker marks, and broken ports.
   - For every defect detected, output a normalized bounding box [ymin, xmin, ymax, xmax] on a scale of 0 to 1000 so the mobile app can highlight it.
3. Pricing Appraisal (India Campus Context in INR ₹):
   - Estimate current realistic pre-owned market value.
   - Deduct value realistically based on the detected scratches and cosmetic flaws.
4. Amazon-Style Listing Generation:
   - Create a clean title formatted as: "[Brand] [Model] - [Key Spec/Attribute] ([Condition Grade])".
   - Create 4 to 5 bullet points in standard "About this item" e-commerce format.
   - Extract key-value technical specifications.
5. Circular Economy Routing:
   - Categorize into "Reusable", "Repairable", or "End-of-life" (e-waste).

Return only a JSON object with exactly these fields and value types:
{
  "identified_product_name": "string",
  "category": "string",
  "overall_condition": "string",
  "circular_lifecycle_category": "string",
  "defects": [{"defect_type": "string", "severity": "string", "box_2d": [0, 0, 0, 0], "buyer_note": "string"}],
  "pricing": {
    "estimated_retail_new": 0,
    "typical_used_market_price": 0,
    "condition_penalty_amount": 0,
    "recommended_min_price": 0,
    "recommended_listing_price": 0,
    "recommended_max_price": 0,
    "pricing_rationale": "string"
  },
  "amazon_listing": {
    "title": "string",
    "key_features_bullets": ["string"],
    "technical_specifications": {"specification name": "string value"},
    "seller_condition_summary": "string"
  }
}
Use an empty defects array when no defects are visible. Represent every technical specification value as a string.
"""

# ----------------- API ENDPOINTS -----------------

@app.post("/api/inspect-and-list", response_model=AnnotatedProductResponse)
async def inspect_and_generate_listing(
    image: UploadFile = File(...),
    seller_notes: Optional[str] = Form(None),
    campus_location: Optional[str] = Form("Main Campus")
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    try:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        draw_image = pil_image.copy()

        user_content = [
            pil_image,
            f"Inspect this item for sale on our campus marketplace. Seller Notes: '{seller_notes or 'None provided'}'. Campus: '{campus_location}'."
        ]

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        if not response.text or not response.text.strip():
            raise HTTPException(status_code=502, detail="AI analysis provider returned an empty response.")
        
        try:
            ai_analysis = ProductAnalysisResponse.model_validate_json(response.text)
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.exception("Gemini returned an invalid product inspection response")
            raise HTTPException(status_code=502, detail="AI analysis provider returned an invalid response.") from exc

        # Draw bounding boxes on the image
        draw = ImageDraw.Draw(draw_image)
        img_width, img_height = draw_image.size

        for defect in ai_analysis.defects:
            ymin, xmin, ymax, xmax = defect.box_2d
            top = (ymin / 1000) * img_height
            left = (xmin / 1000) * img_width
            bottom = (ymax / 1000) * img_height
            right = (xmax / 1000) * img_width

            draw.rectangle([left, top, right, bottom], outline="red", width=5)

        buffered = io.BytesIO()
        draw_image.save(buffered, format="JPEG", quality=85)
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return AnnotatedProductResponse(
            analysis=ai_analysis,
            annotated_image_base64=img_base64
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Product inspection failed")
        raise HTTPException(status_code=500, detail=f"AI Analysis failed: {str(e)}")
