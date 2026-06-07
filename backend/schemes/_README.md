# Scheme Rules Registry

This directory is the **pluggable rules registry** for the procurement decision system.

Each `.json` file in this directory defines a **procurement scheme** — a set of rules derived from a specific policy instrument, framework, direction, or procurement arrangement.

The rules engine loads all active scheme files automatically. No code changes are required to add a new scheme.

---

## How to Add a New Scheme

1. Copy the template below into a new `.json` file in this directory
2. Name the file descriptively (e.g., `labour_hire_arrangement.json`, `dpie_agency_policy.json`)
3. Fill in the required fields
4. Set `"active": true`
5. The system picks it up on the next request — no restart needed in dev mode

---

## Scheme File Template

```json
{
  "scheme_id": "UNIQUE_ID",
  "name": "Human-readable scheme name",
  "version": "YYYY-MM",
  "active": true,
  "description": "What this scheme covers and when it applies",
  "source": "Policy instrument, direction, or framework this is based on",
  "triggers": {
    "category": ["ict_saas"],
    "value": ["medium", "high", "major"],
    "overlays": ["ai"],
    "impact": ["high", "critical"]
  },
  "pre_checks": [
    {
      "id": "SCHEMEID-PC-001",
      "title": "Short title of the pre-check",
      "body": "What the user needs to check before proceeding.",
      "link": "https://optional-link.gov.au"
    }
  ],
  "obligations": [
    {
      "id": "SCHEMEID-OBL-001",
      "title": "Short obligation title",
      "body": "Plain English description of what must be done.",
      "policy": "Policy reference — Act, Direction, or Policy name and section"
    }
  ],
  "pathway_overrides": {
    "if_arrangement_exists": "Description of what to do if an arrangement covers this",
    "if_no_arrangement": "null or description of fallback"
  },
  "step_injections": [
    {
      "after_step": 0,
      "steps": [
        "Additional step to inject into the process at position after_step",
        "Another step if needed"
      ]
    }
  ],
  "approval_additions": [
    {
      "role": "Name of additional approver or reviewer",
      "note": "Why they are required"
    }
  ]
}
```

---

## Trigger Logic

The `triggers` field specifies which procurements this scheme applies to.

A scheme matches when **ALL** specified trigger keys are satisfied (AND logic).  
Within each key, **ANY** of the listed values can match (OR logic).

### Available trigger keys

| Key | Values |
|-----|--------|
| `category` | `ict_saas`, `ict_hardware`, `professional_services`, `consulting`, `goods`, `construction`, `labour_hire`, `other` |
| `value` | `micro`, `low`, `medium`, `high`, `major`, `unknown` |
| `purpose` | `new`, `renewal`, `emergency`, `pilot`, `replacement` |
| `definition` | `clear`, `mostly_clear`, `partial`, `exploratory` |
| `market` | `sole`, `limited`, `some`, `broad`, `unknown` |
| `impact` | `low`, `medium`, `high`, `critical` |
| `overlays` | `ai`, `privacy`, `critical_ict`, `construction`, `overseas`, `sme` |
| `interaction` | `minimal`, `quotes`, `tender`, `collaborative` |
| `timing` | `urgent`, `compressed`, `normal`, `extended`, `unknown` |
| `org` | `operational`, `corporate`, `executive`, `central` |
| `agency` | e.g. `nsw_transport`, `nsw_health` — matches specific agency IDs |
| `cluster` | e.g. `Transport`, `Health`, `Education` — matches all agencies in a cluster |
| `agency_type` | `department`, `agency`, `statutory_authority`, `regulator`, `independent`, `state_owned_corporation`, `public_provider` |

Agency context triggers are only activated when the user selects their agency at the start of the assessment. If no agency is selected, schemes with `agency`, `cluster`, or `agency_type` triggers will **not** match.

### Example: All procurements above medium value

```json
"triggers": {
  "value": ["medium", "high", "major"]
}
```

### Example: AI procurement only

```json
"triggers": {
  "overlays": ["ai"]
}
```

### Example: Agency-specific rule (Transport cluster, high value, SME supplier)

```json
"triggers": {
  "cluster": ["Transport"],
  "value": ["high", "major"],
  "overlays": ["sme"]
}
```

### Example: Rule for a single agency only

```json
"triggers": {
  "agency": ["nsw_health"],
  "category": ["ict_saas", "ict_hardware"],
  "value": ["medium", "high", "major"]
}
```

---

## Disabling a Scheme

Set `"active": false` to disable a scheme without deleting it.

---

## Files in This Directory

| File | Scheme | Status |
|------|--------|--------|
| `ict_whole_of_government.json` | NSW WoG ICT Scheme | Active |
| `construction_scheme.json` | NSW Construction & Infrastructure | Active |
| `goods_buy_nsw.json` | Buy.NSW Goods Marketplace | Active |
| `transport_sme_ict_policy.json` | Transport Cluster SME ICT Policy (example) | Active |
| `ict_purchasing_framework.json` | ICT Purchasing Framework (ICTA/MICTA) — PBD-2025-03 | Active |
| `ict_services_scheme.json` | ICT Services Scheme — PBD-2026-01 | Active |
| `professional_services.json` | Professional Services & Consultancy — PBD-2026-02 | Active |
| `pbd_2026_02_professional_services.json` | PBD-2026-02 Professional Services obligations (updated Apr 2026) | Active |
| `pbd_2025_05_modern_slavery.json` | PBD-2025-05 Modern Slavery Tender Clauses | Active |
| `pbd_2025_04_tender_publication.json` | PBD-2025-04 Open Tender Publication on buy.NSW | Active |
| `pbd_2024_02_local_suppliers.json` | PBD-2024-02 Local Supplier Opportunities ($7.5M+) | Active |
| `pbd_2024_01_buynsw_publication.json` | PBD-2024-01 Supply Opportunity Publication ($150k+) | Active |
| `pbd_2023_04_supplier_hub.json` | PBD-2023-04 Supplier Hub Registration Mandate | Active |
| `faster_payment_terms.json` | Faster Payment Terms Policy — Small Business (Feb 2025) | Active |
