"""Sustainability schemas (openapi components). OWNER: shared."""
from pydantic import BaseModel


class SustainabilitySummaryResponse(BaseModel):
    personal_carbon_kg: float
    campus_carbon_kg: float
    items_reused_count: int
    ewaste_diverted_kg: float
    methodology_note: str


class LeaderboardStandingItem(BaseModel):
    rank: int
    user_id: str
    display_name: str
    points: int
    carbon_saved_kg: float
