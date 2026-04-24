# Inbox

## Questions (Open)



## Credentials Needed

_(No credential requests yet.)_

## Answered / Provided

### Q-004: Should Stop / Pause be graceful-only, or also offer a Force Stop (hard kill) button?
- **From:** VP Engineering (BL-034/035/036 plan, iter 44)
- **Context:** Current `Stop` button calls `stopSession()` (SIGTERM the child `claude --print` process), which doesn't actually halt the ralph-loop — the loop re-spawns claude. The `/redeye:stop` slash command is graceful: writes a `STOP` directive to `.redeye/steering.md` and the CTO exits at the next phase boundary (5–15 min). Plan: realign the Stop button to this graceful behavior (matches user intent for a clean shutdown). A Force Stop (hard kill) could be added later for stalled/unresponsive sessions.
- **Default:** Graceful only for now. Add "Stopping…" / "Pausing…" button feedback plus a caption explaining the team will finish the current phase. Defer Force Stop to a future backlog item unless CEO explicitly asks for it this cycle.
- **Answer:** also force stop
- **Incorporated:** 2026-04-24 (iter 48) — Differs from default. CEO wants Force Stop button. Created adjustment BL-037 (P1): "Add Force Stop button (hard kill) for unresponsive sessions — complements graceful stop."

### Q-005: BL-027 detail-page cost is already shipped — restyle or leave as-is?
- **From:** VP Engineering (BL-027 plan, iter 46)
- **Context:** BL-020 T7 already shipped "Cost (est.)" on the backlog detail page as a `<dl>` field (verified in `app/project/[id]/backlog/[taskId]/page.tsx` lines 273–278). The BL-027 backlog entry re-requests it, which may mean the CEO missed it or wants a different treatment (e.g. inline next to the title).
- **Default:** Leave detail page as-is; BL-027 focuses only on the list-page gap. If the CEO wants a restyle, file a follow-up item. Proceeding with this default.
- **Answer:** this field is not visible in the UI. check with playwright. i just checked.
- **Incorporated:** 2026-04-24 (iter 48) — Differs from default. CEO reports cost field missing from UI despite code being present. Created investigation BL-038 (P1): "BL-027 cost visibility bug — detail-page cost field not rendering despite code present; verify data flow in item_costs population."


### Q-003: Should Live tab show historical transcript when no session is running?
- **From:** VP Engineering (BL-013 plan)
- **Context:** Currently the Live tab shows "No active session" when nothing is running. Since we now have access to Claude's transcript files, we could show the most recent transcript as a read-only historical view with a banner saying "Viewing last session transcript." This would make the tab useful even between sessions.
- **Default:** No, keep current behavior (empty state when not running). This is a separate enhancement, not part of the P0 bug fix. Proceeding with this default.
- **Answer:** No
- **Incorporated:** 2026-04-24 (iter 42) — Matches default. No adjustment needed. BL-013 already shipped with empty-state behavior.


### Q-002: Theme toggle style preference
- **From:** VP Engineering (BL-009 plan)
- **Context:** The ThemeToggle placed in the header can be styled as (a) a small cycling icon button — one click goes Light → Dark → System, using lucide-react Sun/Moon/Monitor icons — minimal footprint; or (b) a 3-segment pill control (Light | Dark | System) always visible showing current mode.
- **Default:** Icon cycle button (minimal header footprint). Proceeding with this unless told otherwise.
- **Answer:** agreed with icon cycle button
- **Incorporated:** 2026-04-24 (iter 42) — Matches default. No adjustment needed. BL-009 shipped with icon cycle toggle.


### Q-001: Should ProjectNav extraction change the project layout significantly?
- **From:** VP Engineering
- **Context:** Currently each page duplicates the nav, back link, and project header. Extracting to layout means the layout needs to fetch project data (name, running status) to render the header. This adds a fetch call in the layout.
- **Default:** Yes, extract to layout. The layout will fetch project name/status via a lightweight client-side hook. Pages will still fetch their own detailed data. Proceeding with this default unless told otherwise.
- **Answer:** extract the layout but test it all looks good
- **Incorporated:** 2026-04-24 (iter 42) — Matches default (extract layout). Test requirement noted; existing Playwright smoke verification is sufficient. No new backlog item needed.


_(Answered questions and provided credentials will be moved here.)_
