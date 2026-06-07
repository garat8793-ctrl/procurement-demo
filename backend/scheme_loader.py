"""
Pluggable scheme registry loader.
Scans the schemes/ directory and loads all active .json scheme files.
New schemes are dropped in and picked up automatically — no code changes needed.
"""

import json
import os
from pathlib import Path
from models import ProcurementProfile


SCHEMES_DIR = Path(__file__).parent / "schemes"

VALUE_ORDER = ["micro", "low", "medium", "high", "major", "unknown"]
IMPACT_ORDER = ["low", "medium", "high", "critical"]


def load_schemes(schemes_dir: Path = SCHEMES_DIR, active_only: bool = True) -> list[dict]:
    """Load and validate all .json scheme files from the schemes directory."""
    schemes = []
    for path in sorted(schemes_dir.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                scheme = json.load(f)
            if active_only and not scheme.get("active", False):
                continue
            if scheme.get("audience") == "supplier":
                continue
            schemes.append(scheme)
        except Exception as e:
            print(f"[scheme_loader] Warning: failed to load {path.name}: {e}")
    return schemes


def _value_gte(profile_value: str, threshold_values: list[str]) -> bool:
    """Check if the profile value is in the threshold list."""
    if not profile_value:
        return False
    return profile_value in threshold_values


def _profile_matches_triggers(profile: ProcurementProfile, triggers: dict) -> bool:
    """
    Check if a profile matches all trigger conditions in a scheme.
    AND logic across keys, OR logic within each key's value list.
    """
    for key, allowed_values in triggers.items():
        if not allowed_values:
            continue
        if key == "category":
            if profile.category not in allowed_values:
                return False
        elif key == "value":
            if profile.value not in allowed_values:
                return False
        elif key == "purpose":
            if profile.purpose not in allowed_values:
                return False
        elif key == "definition":
            if profile.definition not in allowed_values:
                return False
        elif key == "market":
            if profile.market not in allowed_values:
                return False
        elif key == "impact":
            if profile.impact not in allowed_values:
                return False
        elif key == "overlays":
            # At least one overlay must match
            if not any(o in profile.overlays for o in allowed_values):
                return False
        elif key == "interaction":
            if profile.interaction not in allowed_values:
                return False
        elif key == "timing":
            if profile.timing not in allowed_values:
                return False
        elif key == "org":
            if profile.org not in allowed_values:
                return False
        # ── Agency context triggers ──────────────────────────────────────
        elif key == "agency":
            # Match on specific agency_id(s), e.g. ["nsw_transport", "nsw_sydney_trains"]
            if profile.agency_id not in allowed_values:
                return False
        elif key == "cluster":
            # Match on cluster name(s), e.g. ["Transport", "Health"]
            if profile.cluster not in allowed_values:
                return False
        elif key == "agency_type":
            # Match on agency type, e.g. ["department", "regulator"]
            if profile.agency_type not in allowed_values:
                return False
        # ── Extended profile fields ──────────────────────────────────────
        elif key == "ai_component":
            # allowed_values is a bool (True/False)
            if profile.ai_component != allowed_values:
                return False
        elif key == "data_sensitivity":
            if profile.data_sensitivity not in allowed_values:
                return False
        elif key == "market_maturity":
            if profile.market_maturity not in allowed_values:
                return False
        elif key == "delivery_criticality":
            if profile.delivery_criticality not in allowed_values:
                return False
        # ── SME / supplier flags (via overlays) ─────────────────────────
        # "sme" lives in overlays — handled by the overlays key above.
    return True


def match_schemes(profile: ProcurementProfile, schemes: list[dict] = None) -> list[dict]:
    """Return all schemes whose triggers match the current profile."""
    if schemes is None:
        schemes = load_schemes()
    return [s for s in schemes if _profile_matches_triggers(profile, s.get("triggers", {}))]
