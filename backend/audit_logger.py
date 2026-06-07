import sqlite3
import json
import os
from pathlib import Path

DB_PATH = str((Path(__file__).resolve().parent / "procurement.db").resolve())
SIMLAB_PACKAGES_PATH = (Path(__file__).resolve().parent / "simulation_lab_packages.json").resolve()


def _write_simlab_packages(records: list[dict]):
    SIMLAB_PACKAGES_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = SIMLAB_PACKAGES_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    tmp_path.replace(SIMLAB_PACKAGES_PATH)


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS decision_records (
            decision_id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            profile_json TEXT NOT NULL,
            pathway_id TEXT NOT NULL,
            pathway_label TEXT NOT NULL,
            basis_json TEXT NOT NULL,
            obligation_ids_json TEXT NOT NULL,
            scheme_ids_json TEXT NOT NULL,
            human_override INTEGER NOT NULL DEFAULT 0,
            override_decision_id TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_action_records (
            agent_action_id TEXT PRIMARY KEY,
            agent TEXT NOT NULL,
            input_reference TEXT NOT NULL,
            output_type TEXT NOT NULL,
            confidence REAL,
            review_required INTEGER NOT NULL DEFAULT 1,
            timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exception_records (
            exception_id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            submitted_by TEXT NOT NULL,
            rationale TEXT NOT NULL,
            requested_pathway TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by TEXT,
            review_timestamp TEXT,
            review_notes TEXT
        );

        CREATE TABLE IF NOT EXISTS procurements (
            procurement_id TEXT PRIMARY KEY,
            lifecycle_stage TEXT NOT NULL,
            decision_id TEXT,
            strategy_id TEXT,
            assessment_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS procurement_details (
            procurement_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            details_json TEXT NOT NULL,
            saved_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS simulation_lab_packages (
            package_id TEXT PRIMARY KEY,
            package_name TEXT NOT NULL,
            package_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sourcing_artifacts (
            procurement_id TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            artifact_json TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            PRIMARY KEY (procurement_id, artifact_type)
        );
        """)


# --- Decision records ---

def write_decision(record: dict):
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO decision_records
               (decision_id, timestamp, profile_json, pathway_id, pathway_label,
                basis_json, obligation_ids_json, scheme_ids_json, human_override, override_decision_id)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                record["decision_id"],
                record["timestamp"],
                json.dumps(record["profile"]),
                record["pathway_id"],
                record["pathway_label"],
                json.dumps(record["basis"]),
                json.dumps(record["obligation_ids"]),
                json.dumps(record["scheme_ids"]),
                1 if record.get("human_override") else 0,
                record.get("override_decision_id"),
            ),
        )


def read_decision(decision_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM decision_records WHERE decision_id = ?", (decision_id,)
        ).fetchone()
    if row is None:
        return None
    return _unpack_decision(row)


def list_decisions(limit: int = 50) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM decision_records ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_unpack_decision(r) for r in rows]


def list_assessments(limit: int = 100) -> list[dict]:
    """
    Decision records enriched with:
    - artifact_types: which sourcing artifacts have been generated
    - procurement_title: from procurement_details if saved
    All in a single JOIN query — used by the Assessments Library tab.
    """
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT
                d.decision_id, d.timestamp, d.profile_json,
                d.pathway_id, d.pathway_label, d.human_override,
                GROUP_CONCAT(sa.artifact_type) AS artifact_types,
                pd.title AS procurement_title
            FROM decision_records d
            LEFT JOIN sourcing_artifacts sa ON sa.procurement_id = d.decision_id
            LEFT JOIN procurement_details pd ON pd.procurement_id = d.decision_id
            GROUP BY d.decision_id
            ORDER BY d.timestamp DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    results = []
    for row in rows:
        profile = json.loads(row["profile_json"])
        artifact_types = row["artifact_types"].split(",") if row["artifact_types"] else []
        results.append({
            "decision_id": row["decision_id"],
            "timestamp": row["timestamp"],
            "pathway_id": row["pathway_id"],
            "pathway_label": row["pathway_label"],
            "human_override": bool(row["human_override"]),
            "procurement_title": row["procurement_title"],
            "artifact_types": artifact_types,
            "profile_summary": {
                "category": profile.get("category"),
                "value": profile.get("value"),
                "agency_name": profile.get("agency_name"),
                "overlays": profile.get("overlays", []),
            },
        })
    return results


def _unpack_decision(row) -> dict:
    return {
        "decision_id": row["decision_id"],
        "timestamp": row["timestamp"],
        "profile": json.loads(row["profile_json"]),
        "pathway_id": row["pathway_id"],
        "pathway_label": row["pathway_label"],
        "basis": json.loads(row["basis_json"]),
        "obligation_ids": json.loads(row["obligation_ids_json"]),
        "scheme_ids": json.loads(row["scheme_ids_json"]),
        "human_override": bool(row["human_override"]),
        "override_decision_id": row["override_decision_id"],
    }


# --- Agent action records ---

def write_agent_action(record: dict):
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO agent_action_records
               (agent_action_id, agent, input_reference, output_type, confidence, review_required, timestamp)
               VALUES (?,?,?,?,?,?,?)""",
            (
                record["agent_action_id"],
                record["agent"],
                record["input_reference"],
                record["output_type"],
                record.get("confidence"),
                1 if record.get("review_required", True) else 0,
                record["timestamp"],
            ),
        )


def list_agent_actions(limit: int = 100) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_action_records ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# --- Exception records ---

def write_exception(record: dict):
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO exception_records
               (exception_id, decision_id, timestamp, submitted_by, rationale,
                requested_pathway, status, reviewed_by, review_timestamp, review_notes)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                record["exception_id"],
                record["decision_id"],
                record["timestamp"],
                record["submitted_by"],
                record["rationale"],
                record["requested_pathway"],
                record.get("status", "pending"),
                record.get("reviewed_by"),
                record.get("review_timestamp"),
                record.get("review_notes"),
            ),
        )


def list_exceptions(limit: int = 50) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM exception_records ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# --- Procurement lifecycle state ---

def write_procurement_state(record: dict):
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO procurements
               (procurement_id, lifecycle_stage, decision_id, strategy_id, assessment_id, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)""",
            (
                record["procurement_id"],
                record["lifecycle_stage"],
                record.get("decision_id"),
                record.get("strategy_id"),
                record.get("assessment_id"),
                record["created_at"],
                record["updated_at"],
            ),
        )


def get_procurement_state(procurement_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM procurements WHERE procurement_id = ?", (procurement_id,)
        ).fetchone()
    return dict(row) if row else None


def list_procurements(limit: int = 50) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM procurements ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# --- Procurement details ---

def write_procurement_details(details: dict):
    """Upsert procurement details for a given procurement_id."""
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO procurement_details
               (procurement_id, title, details_json, saved_at)
               VALUES (?,?,?,?)""",
            (
                details["procurement_id"],
                details.get("title", ""),
                json.dumps(details),
                details.get("saved_at", ""),
            ),
        )


def get_procurement_details(procurement_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT details_json FROM procurement_details WHERE procurement_id = ?",
            (procurement_id,),
        ).fetchone()
    return json.loads(row["details_json"]) if row else None


# --- Rules simulation lab packages ---

def write_simulation_lab_package(record: dict):
    packages = {item["package_id"]: item for item in list_simulation_lab_packages(limit=1000)}
    packages[record["package_id"]] = record
    _write_simlab_packages(list(packages.values()))


def read_simulation_lab_package(package_id: str) -> dict | None:
    for record in list_simulation_lab_packages(limit=1000):
        if record["package_id"] == package_id:
            return record
    return None


def list_simulation_lab_packages(limit: int = 100) -> list[dict]:
    if not SIMLAB_PACKAGES_PATH.exists():
        return []
    try:
        records = json.loads(SIMLAB_PACKAGES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    records = sorted(records, key=lambda item: item.get("updated_at", ""), reverse=True)
    return records[:limit]


def delete_simulation_lab_package(package_id: str) -> bool:
    records = list_simulation_lab_packages(limit=1000)
    next_records = [item for item in records if item["package_id"] != package_id]
    if len(next_records) == len(records):
        return False
    _write_simlab_packages(next_records)
    return True


# --- Sourcing artifacts (strategy, market assessment, RFx draft, eval plan, approval summary) ---

def write_sourcing_artifact(procurement_id: str, artifact_type: str, data: dict):
    """Upsert a generated sourcing artifact keyed on (procurement_id, artifact_type)."""
    from datetime import datetime, timezone
    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO sourcing_artifacts
               (procurement_id, artifact_type, artifact_json, saved_at)
               VALUES (?,?,?,?)""",
            (
                procurement_id,
                artifact_type,
                json.dumps(data),
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def read_sourcing_artifact(procurement_id: str, artifact_type: str) -> dict | None:
    """Return a single saved artifact or None."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT artifact_json FROM sourcing_artifacts WHERE procurement_id = ? AND artifact_type = ?",
            (procurement_id, artifact_type),
        ).fetchone()
    return json.loads(row["artifact_json"]) if row else None


def read_all_sourcing_artifacts(procurement_id: str) -> dict:
    """Return all saved artifacts for a procurement, keyed by artifact_type."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT artifact_type, artifact_json FROM sourcing_artifacts WHERE procurement_id = ?",
            (procurement_id,),
        ).fetchall()
    return {row["artifact_type"]: json.loads(row["artifact_json"]) for row in rows}
