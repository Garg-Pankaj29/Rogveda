"""
ROGVEDA — Power Service (Phase 20)

Detects laptop power status via psutil and exposes a manual override
setting (Auto / Always On / Always Off) persisted in SQLite.

Used by batch_service to throttle pacing when on battery, without
ever changing analysis logic or correctness.
"""

import logging
from typing import Optional

from app.db.database import SessionLocal
from app.db.models import AppSetting

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────
SETTING_KEY = "power_saver_mode"
VALID_MODES = ("auto", "always_on", "always_off")
DEFAULT_MODE = "auto"

# Throttling parameters
THROTTLE_CHUNK_SIZE = 5      # molecules per chunk when throttled
THROTTLE_PAUSE_SECONDS = 0.3  # pause between chunks when throttled


# ── Battery Detection ─────────────────────────────────────────

def _read_battery() -> dict:
    """
    Read battery status from psutil.
    Returns { power_source, battery_percent }.
    Gracefully handles machines with no battery sensor.
    """
    try:
        import psutil
        battery = psutil.sensors_battery()
    except ImportError:
        logger.warning("psutil not installed — cannot detect battery status")
        return {"power_source": "no_battery_sensor", "battery_percent": None}
    except Exception as e:
        logger.warning("psutil battery read failed: %s", e)
        return {"power_source": "no_battery_sensor", "battery_percent": None}

    if battery is None:
        # Desktop machine or VM with no battery
        return {"power_source": "no_battery_sensor", "battery_percent": None}

    # If power_plugged is explicitly False, it's on battery. If True or None, assume plugged in/unthrottled.
    power_source = "on_battery" if battery.power_plugged is False else "plugged_in"

    return {
        "power_source": power_source,
        "battery_percent": round(battery.percent) if battery.percent is not None else None,
    }


# ── Settings Persistence ─────────────────────────────────────

def get_power_saver_setting() -> str:
    """Read the power saver mode from the DB. Defaults to 'auto'."""
    with SessionLocal() as db:
        row = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
        if row and row.value in VALID_MODES:
            return row.value
    return DEFAULT_MODE


def set_power_saver_setting(value: str) -> str:
    """
    Persist the power saver mode. Must be one of: auto, always_on, always_off.
    Returns the saved value.
    """
    if value not in VALID_MODES:
        raise ValueError(f"Invalid power saver mode '{value}'. Must be one of: {', '.join(VALID_MODES)}")

    with SessionLocal() as db:
        row = db.query(AppSetting).filter(AppSetting.key == SETTING_KEY).first()
        if row:
            row.value = value
        else:
            row = AppSetting(key=SETTING_KEY, value=value)
            db.add(row)
        db.commit()

    logger.info("Power saver mode set to: %s", value)
    return value


# ── Combined Power Mode ──────────────────────────────────────

def get_power_mode() -> dict:
    """
    Returns the full power mode info used by batch_service and the frontend.

    {
        "power_source": "plugged_in" | "on_battery" | "no_battery_sensor",
        "battery_percent": int | None,
        "power_saver_setting": "auto" | "always_on" | "always_off",
        "is_throttled": bool
    }
    """
    battery = _read_battery()
    setting = get_power_saver_setting()

    # Determine throttle state
    if setting == "always_on":
        is_throttled = True
    elif setting == "always_off":
        is_throttled = False
    else:  # auto
        # Throttle only when actually on battery; desktops/VMs never throttle
        is_throttled = (battery["power_source"] == "on_battery")

    return {
        "power_source": battery["power_source"],
        "battery_percent": battery["battery_percent"],
        "power_saver_setting": setting,
        "is_throttled": is_throttled,
    }
