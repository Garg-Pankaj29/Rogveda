"""
ROGVEDA — Power/Settings API Router (Phase 20)

GET  /api/power/status   — current power mode + throttle state
GET  /api/power/setting  — current power saver setting
POST /api/power/setting  — update power saver setting
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import power_service

router = APIRouter(
    prefix="/api/power",
    tags=["power"],
)


@router.get("/status")
def get_power_status():
    """Return full power mode info: source, battery %, setting, throttle state."""
    return power_service.get_power_mode()


@router.get("/setting")
def get_power_setting():
    """Return the current power saver setting."""
    return {"power_saver_setting": power_service.get_power_saver_setting()}


class PowerSettingRequest(BaseModel):
    mode: str  # "auto", "always_on", "always_off"


@router.post("/setting")
def set_power_setting(request: PowerSettingRequest):
    """Update the power saver setting."""
    try:
        saved = power_service.set_power_saver_setting(request.mode)
        return {"power_saver_setting": saved}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
