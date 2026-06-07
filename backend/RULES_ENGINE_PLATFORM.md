# Rules Engine Platform Foundation

This backend foundation treats the rules engine as the primary product and the current procurement pathway flow as one runtime consumer of it.

## Implemented in this pass

- Canonical rule model with:
  - conditions
  - effects
  - provenance
  - objectives
  - precedence / priority
- Versioned snapshot registry built from current core obligations and scheme assets
- Read-only analysis layer for:
  - gaps
  - duplicates
  - contradictions
  - workflow burden
- Deterministic simulation layer for replaying arbitrary case facts against canonical rules
- Graph projection for future workbench and modelling UIs
- Taxonomy seed defining policy objectives and trigger dimensions

## Design intent

The architecture distinguishes between:

- source policy assets
- canonical executable rules
- simulated runtime outcomes
- analytical findings about rule health

That separation is necessary if this evolves into a true policy engine rather than a prompt wrapper.

## New API surface

- `GET /api/platform/engine/overview`
- `GET /api/platform/engine/rules`
- `GET /api/platform/engine/findings`
- `GET /api/platform/engine/graph`
- `POST /api/platform/engine/simulate`
- `POST /api/platform/engine/simulation-lab/compare`

## Simulation lab

The simulation lab compares the current canonical rules snapshot against a proposed ruleset mutation package.

It supports:

- add a canonical rule
- replace an existing canonical rule
- deactivate an existing canonical rule
- replay multiple procurement scenarios
- return delta summaries for:
  - matched rules
  - obligations
  - pre-checks
  - workflow steps
  - approvals
  - advisories

This is the first backend slice aimed at real policy modelling rather than single-case outcome generation.

## What this is not yet

- not yet a human rule authoring workbench
- not yet an ML learning loop over historical procurement outcomes
- not yet a governed promotion pipeline for activating candidate rules
- not yet a replacement for the current procurement demo flow

Those are the next layers to build on top of this foundation.
