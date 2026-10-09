"""Auth & Identity schemas (openapi components). OWNER: shared."""
from pydantic import BaseModel, EmailStr, Field, model_validator


class _RejectExplicitNulls(BaseModel):
    """Contract treats null as wrong type — clients omit fields instead."""

    @model_validator(mode="before")
    @classmethod
    def _reject_null_values(cls, data):
        if isinstance(data, dict):
            for key, value in data.items():
                if value is None:
                    raise ValueError(f"{key} must not be null; omit the field instead.")
        return data


class DemoSessionRequest(_RejectExplicitNulls):
    email: EmailStr
    display_name: str | None = Field(default=None, min_length=2, max_length=80)


class UserProfileResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    verified_student: bool
    campus_id: str
    campus_name: str | None = None
    points: int
    cumulative_carbon_g: int
    avatar_url: str | None = None


class AuthSessionResponse(BaseModel):
    token: str
    user: UserProfileResponse


class UserProfileUpdateRequest(_RejectExplicitNulls):
    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    avatar_url: str | None = Field(default=None, max_length=500)
