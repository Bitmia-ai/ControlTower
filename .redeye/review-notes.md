# Review Notes — BL-013 Live Tab Fix (Iteration 40, Cycle 1)

**Reviewer:** Code Review agent (Sonnet 4.6)
**Date:** 2026-04-24
**Tier:** M (10+ code files, SSE/network surface)
**Result:** APPROVE — 0 Critical / 0 Major / 4 Minor

---

## Summary

BL-013 fixes the Live tab so it connects to the SSE stream for CLI-spawned sessions
(not only CT-spawned ones). Five sub-tasks were implemented:

- T1: New `GET /api/projects/[id]/transcript-status` endpoint
- T2: `live/page.tsx` gates on transcript availability, not `running`
- T3: Session boundary sentinel `__session_boundary__` in stream + viewer
- T4: Playwright visual verification (screenshots saved)
- T5: Regression — 281 tests pass, build green

---

## Findings

### Minor M1 — `TranscriptStatus` interface duplicated between route and page

`app/api/projects/[id]/transcript-status/route.ts` exports `TranscriptStatus`
but `app/project/[id]/live/page.tsx` redeclares it locally instead of importing
from the route. Should import from `@/app/api/projects/[id]/transcript-status/route`
or move the type to `@/lib/redeye-types.ts`.

**Risk:** Type drift between server and client if the shape changes.
**Fix:** Import the exported type or lift to shared types file.

---

### Minor M2 — `isLoading` condition is overly narrow

```ts
const isLoading = transcriptStatus === null && running === null;
```

If `checkTranscriptStatus` resolves before `checkSessionStatus` (both fire
concurrently), `transcriptStatus` becomes non-null while `running` is still
`null`. In that window `isLoading` is `false` and the condition falls through
to the empty-state branch `!hasTranscript && running === false` — which is also
false since `running !== false`. The viewer renders with zero events, which is
fine but shows the transcript viewer shell briefly before content appears.
Low-impact since both fetches complete in under 100ms normally, but worth
documenting as a known flash.

**Risk:** Brief empty-viewer flash on initial load — cosmetic only.
**Fix or document:** Either gate `isLoading` on `transcriptStatus === null || running === null`
(OR instead of AND) or accept the flash and document it.

---

### Minor M3 — `eslint-disable` suppresses a legitimate hook dependency warning

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [transcriptStatus?.available, connect]);
```

The full `transcriptStatus` object is read inside the effect (e.g. the `return`
cleanup reads `esRef.current`). The suppression is safe here because the effect
only needs to re-run when `available` flips — but the comment doesn't explain
why it's intentional. Without the comment future engineers may restore the full
dep and introduce unnecessary reconnects.

**Risk:** Confusion / accidental revert by future engineer.
**Fix:** Add a one-line comment: `// intentional: only re-run when availability changes, not on every poll`.

---

### Minor M4 — `resolveTranscriptFile` returns stale CLI transcripts with no age cutoff

`transcript-status/route.ts` calls `resolveTranscriptFile`, which returns the
most-recently-modified CLI JSONL regardless of how old it is. The spec (Problem
section) says the empty state should appear "when no transcript is < 10 minutes
old", but `available` can be `true` with `ageSeconds` of hours or days. The
banner does handle it gracefully ("Last session"), but the controls (Auto-scroll,
Reconnect, Clear) remain visible and the EventSource connects to a cold file.

The spec AD-2 and AD-3 don't enforce a hard cutoff on `available` — only the
banner distinguishes age. So this is within spec but arguably wrong for UX.

**Risk:** User sees controls and a connected (but silent) EventSource for a
day-old transcript. Not a correctness bug per the spec.
**Fix (optional):** Apply a max-age threshold (e.g. 10 min) to `available`
in `transcript-status/route.ts`, or raise as a follow-up backlog item.

---

## Spec Compliance Checklist

| AD | Description | Status |
|----|-------------|--------|
| AD-1 | Decouple Live tab from `running` | DONE |
| AD-2 | `transcript-status` endpoint | DONE |
| AD-3 | Always-on EventSource when transcript exists | DONE |
| AD-4 | "New session" separator on file-switch | DONE |
| AD-5 | Playwright visual verification | DONE (screenshots under screenshots/) |

All 5 sub-tasks implemented. All acceptance criteria met.

---

## Security

No new auth surfaces. The endpoint reads filesystem paths that are already used
by the SSE stream route. No user-controlled input is passed to `fs` calls —
project path comes from the validated project index. No issues.

---

## Recommendation: DEPLOY

All findings are Minor. The implementation is correct, tests are comprehensive
(12 new unit tests, 281 total pass), and Playwright screenshots confirm the
Live tab shows transcript content.
