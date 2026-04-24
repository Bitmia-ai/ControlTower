---
name: Bug report
about: Something doesn't work as expected
title: ''
labels: bug
---

**What happened?**
A clear description of what went wrong.

**Expected behavior**
What you expected to happen instead.

**Reproduction steps**
1. Started Control Tower with `npm run dev`
2. Added project at `...`
3. Clicked `...`
4. Observed `...`

**Screenshots**
If the bug is visual, attach a screenshot. The dashboard makes this easy.

**Logs / state**
- Output of `curl -s http://localhost:3200/api/projects | jq '.'`
- Any errors in the browser console or the `npm run dev` terminal
- Content of the relevant project's `.redeye/state.json` if applicable

**Environment**
- OS:
- Node version (`node --version`):
- npm version (`npm --version`):
- Control Tower commit (`git rev-parse HEAD`):
- Claude Code version (`claude --version`):
- RedEye plugin version (`claude plugin list | grep redeye`):

**Additional context**
Anything else that might help diagnose the issue.
