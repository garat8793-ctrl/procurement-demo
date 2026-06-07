"""
Rules engine — evaluates core obligations and stacks scheme-specific rules.
Deterministic: same profile always produces the same obligations.
"""

import json
from pathlib import Path
from models import ProcurementProfile, Obligation, PreCheck, ObligationResult, MatchedScheme, StepInjection, ProcessStep
from scheme_loader import load_schemes, match_schemes

DATA_DIR = Path(__file__).parent / "data"


def _load_core_obligations() -> list[dict]:
    with open(DATA_DIR / "obligations.json", encoding="utf-8") as f:
        return json.load(f)


def _trigger_matches(profile: ProcurementProfile, trigger: dict) -> bool:
    """Check if a core obligation trigger matches the profile."""
    for key, values in trigger.items():
        if key == "value":
            if profile.value not in values:
                return False
        elif key == "purpose":
            if profile.purpose not in values:
                return False
        elif key == "timing":
            if profile.timing not in values:
                return False
        elif key == "market":
            if profile.market not in values:
                return False
        elif key == "impact":
            if profile.impact not in values:
                return False
        elif key == "definition":
            if profile.definition not in values:
                return False
        elif key == "overlays":
            # Any overlay in list must be present in profile
            if not any(o in profile.overlays for o in values):
                return False
        elif key == "category":
            if profile.category not in values:
                return False
    return True


def _multi_trigger_matches(profile: ProcurementProfile, trigger: dict) -> bool:
    """
    For triggers with multiple keys, ALL keys must match (AND logic).
    But within each key, ANY of the values can match (OR logic).
    """
    return _trigger_matches(profile, trigger)


def evaluate_obligations(profile: ProcurementProfile) -> ObligationResult:
    """
    Two-stage evaluation:
    1. Core obligations from obligations.json
    2. Scheme-specific obligations from matching schemes
    Returns merged, deduplicated obligations with source attribution.
    """
    seen_ids = set()
    obligations = []
    pre_checks = []
    step_injections = []

    # --- Stage 1: Core obligations ---
    core_rules = _load_core_obligations()
    for rule in sorted(core_rules, key=lambda r: r.get("priority", 99)):
        if not rule.get("active", True):
            continue
        if _multi_trigger_matches(profile, rule.get("trigger", {})):
            if rule["id"] not in seen_ids:
                seen_ids.add(rule["id"])
                obligations.append(Obligation(
                    id=rule["id"],
                    title=rule["title"],
                    body=rule["body"],
                    policy=rule.get("policy", ""),
                    source="core",
                ))

    # --- Stage 2: Scheme obligations ---
    all_schemes = load_schemes()
    matched = match_schemes(profile, all_schemes)
    matched_scheme_info = []

    for scheme in matched:
        matched_scheme_info.append(MatchedScheme(
            scheme_id=scheme["scheme_id"],
            name=scheme["name"],
        ))

        # Pre-checks from scheme
        for pc in scheme.get("pre_checks", []):
            if pc.get("audience") == "supplier":
                continue
            if pc["id"] not in seen_ids:
                seen_ids.add(pc["id"])
                pre_checks.append(PreCheck(
                    id=pc["id"],
                    title=pc["title"],
                    body=pc["body"],
                    link=pc.get("link"),
                    source=scheme["scheme_id"],
                    citation=pc.get("citation"),
                ))

        for injection in scheme.get("step_injections", []):
            step_items = []
            for raw_step in injection["steps"]:
                if isinstance(raw_step, dict):
                    # Support both "citations" (list) and "citation" (single string from ingestion)
                    if raw_step.get("citations"):
                        step_citations = raw_step["citations"]
                    elif raw_step.get("citation"):
                        step_citations = [raw_step["citation"]]
                    else:
                        step_citations = [scheme.get("source")] if scheme.get("source") else []
                    step_items.append(ProcessStep(
                        text=raw_step["text"],
                        citations=step_citations,
                        source_name=scheme["name"],
                    ))
                else:
                    step_items.append(ProcessStep(
                        text=raw_step,
                        citations=[scheme.get("source")] if scheme.get("source") else [],
                        source_name=scheme["name"],
                    ))
            step_injections.append(StepInjection(
                after_step=injection["after_step"],
                steps=step_items,
                source=scheme["scheme_id"],
                source_name=scheme["name"],
            ))

        # Obligations from scheme
        for obl in scheme.get("obligations", []):
            if not obl.get("active", True):
                continue
            if obl.get("audience") == "supplier":
                continue
            if obl["id"] not in seen_ids:
                seen_ids.add(obl["id"])
                obligations.append(Obligation(
                    id=obl["id"],
                    title=obl["title"],
                    body=obl["body"],
                    policy=obl.get("policy", ""),
                    source=scheme["scheme_id"],
                    citation=obl.get("citation"),
                ))

    return ObligationResult(
        obligations=obligations,
        pre_checks=pre_checks,
        matched_schemes=matched_scheme_info,
        step_injections=step_injections,
    )
