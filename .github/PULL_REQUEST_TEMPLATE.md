## Summary

What this PR does in 1-3 sentences.

## Linked issue

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / code cleanup
- [ ] API route change (affects external contract)
- [ ] Other:

## Checklist

- [ ] I opened an issue first (for anything larger than a typo)
- [ ] TypeScript strict passes (`npm run build`)
- [ ] No shell-string interpolation — `spawn()` with arg array for all process starts
- [ ] New API routes wrapped in `try/catch`, return `{ data }` or `{ error }`
- [ ] Atomic writes for any file that could be read concurrently
- [ ] Paths validated to stay inside the configured project directory
- [ ] Tests added / updated (unit via vitest, e2e via Playwright if UI)
- [ ] Conventional commit messages (`feat:`, `fix:`, etc.)

## Screenshots

If UI changed, include before/after.

## Testing

How you verified the change works. Manual reproduction steps are fine.
