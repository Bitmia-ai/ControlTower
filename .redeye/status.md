# Status — BL-073 build complete

**Iteration:** 100
**Phase:** REVIEW (ready)
**Backlog item:** BL-073 — steer tab, directives need to be rendered with markdown
**Spec:** docs/specs/BL-073-steer-markdown.md

## Sub-tasks
- task-1 (done): Replace plain-text directive renderer in `DirectiveRow` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` inside a Tailwind Typography `prose-sm prose-zinc dark:prose-invert max-w-none` container with tightened spacing tokens.
- task-2 (done): Added test asserting **bold** / inline `code` / `[link]` / unordered list render correctly inside the directive row. Date badge extraction still works for multi-line markdown directives.

## Files modified
- `/Users/casa/ControlTower/app/project/[id]/steer/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/steer/page.test.tsx`
- `/Users/casa/ControlTower/docs/specs/BL-073-steer-markdown.md` (new)
- `/Users/casa/ControlTower/.redeye/state.json` (spec_file, phase, iteration log)

## Verification
- `npx vitest run` — 692/692 tests pass (1 new test added)
- `npm run build` — clean (after switching `s` flag to `[\s\S]` to satisfy pre-ES2018 TS target)

## Notes / concerns
- No new dependencies — `react-markdown` and `remark-gfm` were already in `package.json` and used by the backlog detail page. Mirrors that pattern exactly.
- Initial implementation used the regex `s` flag for the date-extraction regex; TS rejected it (target below ES2018), switched to `[\s\S]*?` which behaves identically.
- Input textarea intentionally left as plain text — only the *display* of stored directives gets markdown rendering. Matches spec.
