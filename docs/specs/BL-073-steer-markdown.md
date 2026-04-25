# BL-073 — Render steer directives with markdown

**Backlog item:** BL-073 — steer tab, directives need to be rendered with markdown

## Problem
The steer tab (`app/project/[id]/steer/page.tsx`) currently renders directive text as plain text via a `<p>` element. CEO writes directives that include markdown (bold, lists, links, code blocks) which displays as raw characters.

## Approach
Use the already-installed `react-markdown` + `remark-gfm` libraries (same pattern used in `app/project/[id]/backlog/[taskId]/page.tsx`). No new deps.

## Sub-tasks
- [x] task-1 (done): Replace the `<p>` directive renderer in `DirectiveRow` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` wrapped in a Tailwind Typography `prose` container styled for the design system (`prose-sm prose-zinc dark:prose-invert max-w-none`). Strip leading newlines from the directive text. Input textarea stays plain text — only display changes.
- [x] task-2 (done): Update `app/project/[id]/steer/page.test.tsx` so existing assertions still pass (text matchers may need slight adjustment because react-markdown wraps content in `<p>`/heading elements). Add a new test asserting that `**bold**` markdown renders as a `<strong>` element.

## Out of scope
- Editing/deleting directives (BL-072)
- Changing the input UX
