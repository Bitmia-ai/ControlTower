# Spec: T107 + T097 — Description field parsing and stale responsive test

## Tasks

### T107 (P0): Task detail page does not render Description field

**Root cause:** `parseTasks()` in `lib/redeye-parsers.ts` does not extract the `**Description:**` field from tasks.md entries. The field is absent from the `TaskItem` type and never returned by the GET API.

**Fix plan (4 sub-tasks, all S-tier):**

#### T1: Parser — extract `**Description:**` field (multi-line)

In `lib/redeye-parsers.ts`, `parseTasks()`:

- The `**Description:**` field can span multiple lines (paragraphs, code blocks, lists). It continues until the next `- **FieldName:**` marker or the next `### T` heading.
- Add a helper function `pickMultilineField(body: string, fieldName: string): string | undefined` that:
  1. Finds `- **{fieldName}:**` in body
  2. Captures everything from the remainder of that line through to the next `- **` field marker or end of body
  3. Returns the captured text trimmed
- Use `pickMultilineField(body, "Description")` in the `parseTasks` item-builder to populate `description`.
- Keep existing `pickField` for single-line fields — do not touch it.

Regex sketch:
```ts
function pickMultilineField(body: string, fieldName: string): string | undefined {
  const re = new RegExp(`- \\*\\*${fieldName}:\\*\\*[ \\t]*\\n?([\\s\\S]*?)(?=\\n- \\*\\*|\\n### |$)`);
  const match = body.match(re);
  if (!match) return undefined;
  // Also check for inline value on same line as field marker
  const inlineRe = new RegExp(`- \\*\\*${fieldName}:\\*\\*[ \\t]*([^\\n]+)`);
  const inlineMatch = body.match(inlineRe);
  const multiline = match[1]?.trim();
  const inline = inlineMatch?.[1]?.trim();
  // Prefer multiline if it has content, else inline
  return multiline || inline || undefined;
}
```

#### T2: Type — add `description` field to `TaskItem`

In `lib/redeye-types.ts`, add to `TaskItem` interface:
```ts
/** Full description text from `**Description:**` field — may be multi-paragraph markdown. */
description?: string;
```

#### T3: Parser — include `description` in returned items

In `parseTasks()`, in the `items.push({...})` call, add:
```ts
description: pickMultilineField(body, "Description"),
```

#### T4: UI — render Description on task detail page

In `app/project/[id]/tasks/[taskId]/task-detail-client.tsx`:

- After the `{item.summary && <TaskSummarySection .../>}` block and before the `{item.details && ...}` block, add a Description section:

```tsx
{item.description && (
  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
      Description
    </h3>
    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-gray-700 dark:text-zinc-300">
      <MarkdownRenderer>{item.description}</MarkdownRenderer>
    </div>
  </div>
)}
```

- No API route changes needed — the GET route returns the full `TaskItem`, which will now include `description` once the parser and type are updated.

#### T5: Tests — parser unit tests

In `lib/__tests__/redeye-parsers.test.ts` (or a new test file if that doesn't exist), add tests for `parseTasks()` covering:

1. Task with a single-line `**Description:**` field → `description` field populated
2. Task with a multi-paragraph description (two paragraphs separated by blank line) → full text captured
3. Task with description containing a markdown list → list text captured
4. Task with NO `**Description:**` field → `description` is `undefined`
5. Task with description ending at next `- **` field marker (e.g. `- **Priority:**`) → capture stops correctly

---

### T097 (P0): Fix or delete stale ControlsCard responsive test

**Root cause:** `components/__tests__/responsive.test.tsx` line 102–114, test "ControlsCard button row uses flex-wrap for narrow viewports", asserts `container.querySelectorAll("div.flex.flex-wrap").length > 0`. T083 intentionally removed `flex-wrap` from ControlsCard to fix button alignment at the 300px rail width. The test is stale.

**Decision:** Delete the test. The responsive intent (narrow-viewport usability) is still valid but is served by the touch-target test on line 86–100 ("ControlsCard Start button has min-h-[44px]"). Removing `flex-wrap` was the correct fix — the buttons stay in a row with proper spacing; wrapping at 300px would cause layout problems.

**Fix plan (1 sub-task, XS-tier):**

Remove lines 102–114 from `components/__tests__/responsive.test.tsx`:
```ts
  it("ControlsCard button row uses flex-wrap for narrow viewports", () => {
    const { container } = render(
      <ControlsCard
        running={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onPause={vi.fn()}
      />
    );
    // Look for any flex-wrap container inside the controls card
    const wrappers = container.querySelectorAll("div.flex.flex-wrap");
    expect(wrappers.length).toBeGreaterThan(0);
  });
```

After the removal, the `describe("T057 responsive classes")` block should have 4 tests, all passing.

---

## Acceptance Criteria

1. `GET /api/projects/1/tasks/T085` returns `description: "<...long text...>"` (not null)
2. Task detail page at `/project/1/tasks/T085` renders the Description section below the title card
3. Description text is rendered as markdown (bold, links, code blocks work)
4. `npx vitest run` passes with no regressions
5. The stale flex-wrap test is gone
6. At least 5 new parser unit tests for the `description` field

## Files to touch

- `lib/redeye-parsers.ts` — add `pickMultilineField`, use in `parseTasks`
- `lib/redeye-types.ts` — add `description?: string` to `TaskItem`
- `app/project/[id]/tasks/[taskId]/task-detail-client.tsx` — render Description section
- `components/__tests__/responsive.test.tsx` — delete stale test
- `lib/__tests__/redeye-parsers.test.ts` (or equivalent) — add 5 new tests
