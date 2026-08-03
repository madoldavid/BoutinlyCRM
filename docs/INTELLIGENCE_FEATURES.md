# Boutinly Intelligence — Frontend Feature Implementation

Companion to `FRONTEND_DESIGN_PLAN.md` and `Boutinly_AI_in_CRM_Enterprise_Deep_Dive.docx`.
Implements the deep-dive's **painkiller-first** roadmap items that can be delivered
deterministically from CRM data, with explainability as a first-class output:

> *"Explainable recommendations (why, not just what)"* and *"predictive lead/deal
> scoring wired into the actual workflow (not a bolt-on dashboard)"* — both ranked
> as **must-have painkillers** for enterprise buyers.

All logic lives in `src/ai/insights.ts` — a pure, deterministic, unit-testable engine.
No external AI service is required; every score and suggestion is computed from
live CRM data with transparent rules, so the UI can always answer **"why?"**.

---

## 1. Boutinly Deal Score (0–100) with explainability

Computed live for every deal in the scoped pipeline.

### Model

| Factor | Direction | Weight |
|--------|-----------|--------|
| Stage momentum | base = stage probability × 0.6 | up to +60 |
| Close-date urgency | ≤30d → bonus; past-due → penalty; >180d → long-cycle risk | −12 … +6 |
| Stage dwell (stagnation) | >7d −5 · >14d −12 · >21d −18 | −18 … 0 |
| Owner engagement | last linked activity ≤7d +8 · ≤14d +3 · >21d −8 · none −5 | −8 … +8 |
| Next-step readiness | open task due ≤14d +6 · overdue −6 · none −2 | −6 … +6 |
| Value momentum | vs. team median (≥2× +5 · ≥1× +2 · <0.5× −3) | −3 … +5 |
| Record completeness | line items +2 · linked account +1 | 0 … +3 |

Grade bands: **≥75 Excellent · ≥55 Good · ≥35 Watch · <35 At Risk**.

### Where it appears

- **Kanban cards** — compact score badge with grade color; "stalled"/"step overdue"
  warnings; full factor summary in the hover tooltip.
- **Deal detail panel** — *Boutinly Score* card: grade badge, animated score bar,
  and the complete factor-by-factor breakdown with signed impacts (the
  explainability panel enterprise buyers ask for).
- **Deals list view** — sortable Score column with grade labels.
- **CSV export** — score column included.

## 2. Next Best Actions (AI Assistant)

`buildNextBestActions()` produces prioritized, **reasoned** suggestions from the
current user's RBAC-scoped data. Shown as the *AI Assistant — Next Best Actions*
panel at the top of Reports & Dashboards.

| Rule | Priority | Reason example |
|------|----------|----------------|
| Deal stuck ≥14 days in stage | high/medium | "Sitting in Solution Demo for 21 days — deals this stale convert at less than half the rate." |
| No activity on deal >14 days (or none ever) | high/medium | "No logged activity in 18 days — momentum is cooling." |
| Deal closes ≤14 days with no scheduled next step | high | "Closes in 6 days with no scheduled next step — book a follow-up now." |
| Overdue tasks (top 3) | high/medium | "Overdue since Jul 12." |
| Duplicate contact groups (leadership roles) | medium | "…share the same email — duplicates cost an estimated 15–25% of revenue." |
| Unenriched contacts (leadership roles) | low | "Missing a phone number and a job title." |

Every action deep-links: **Open** navigates to the module and selects the entity
(via the `boutinly:select-entity` event) so the user lands on the record, not just
the page.

## 3. Data Quality & Hygiene (duplicate detection)

`findDuplicateContacts()` groups contacts by, in order of confidence:

1. **Exact email** (normalized)
2. **Exact phone** (digits only, ≥7)
3. **First+last name on the same email domain**

### Where it appears

- **Contacts module** — amber banner: "*N contacts look like duplicates*" with a
  one-click **Review first group** action that opens the existing Merge modal
  pre-filled with the detected source/destination records.
- **Reports dashboard** — Data Quality card: duplicate / incomplete / unassigned
  counts with revenue-impact framing.
- **AI Assistant** — merge suggestions with reasons.

## 4. Forecast Confidence (variance explanation)

The Forecast view now shows **why** the number could move instead of a single
false-precise figure:

- **Committed** — value × probability for deals ≥75% likely.
- **Weighted expected** — Σ value × probability.
- **Expected range** — weighted ± 1σ from the binomial variance of stage
  probabilities (Σ v·p·(1−p)).
- **Variance %** — σ/weighted, per month and overall.

## 5. Global Keyboard Shortcuts

New `GlobalShortcuts` component (`?` cheatsheet modal, `g`+key navigation,
`n` new-record, ⌘K palette). See `FRONTEND_DESIGN_PLAN.md` Phase 4.

---

## Testing & Safety

- The engine is **pure** — `InsightContext` accepts an injectable `now` clock, so
  scores/actions are deterministic and unit-testable.
- Scores are advisory: "Scores are advisory and recomputed live from CRM data…"
  disclaimers appear in the UI.
- All data used is already RBAC-scoped client-side; the server remains the source
  of authority (see `ENTERPRISE_READINESS_PLAN.md`).
- No new runtime dependencies were added for any of this work.
