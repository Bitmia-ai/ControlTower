# T153 — Pin postcss ^8.5.10 via npm overrides to resolve npm audit moderate XSS (GHSA-qx2v-qp2m-jg93)

**Status:** planned  
**Priority:** P0  
**Type:** security  
**Iteration planned:** 173

---

## Context

`npm audit --omit=dev` (as of iter 173) reports 2 moderate-severity findings:

```
postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
https://github.com/advisories/GHSA-qx2v-qp2m-jg93
node_modules/next/node_modules/postcss
  next  >=9.3.4-canary.0
  Depends on vulnerable versions of postcss
```

Next 16.2.4 ships a **nested** copy of postcss 8.4.31 at
`node_modules/next/node_modules/postcss`. A root-level postcss 8.5.10 already
exists (hoisted for `@tailwindcss/postcss`) but npm does **not** deduplicate
the nested one automatically — next pins its own copy.

The npm-recommended fix (`npm audit fix --force`) would downgrade next to
9.3.3, which is a breaking change. The correct approach is to add an npm
[`overrides`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
field to package.json, which forces **all** postcss resolutions — including
next's nested copy — to >=8.5.10.

---

## Architecture Decisions

### AD-1: Use npm overrides, not resolutions

`package.json` `"overrides"` is the npm-native (v8.3+) mechanism for pinning
transitive dependencies. It replaces the Yarn `"resolutions"` field and is
the approach npm recommends. The change is a single JSON key addition.

### AD-2: Pin to `^8.5.10`, not an exact version

`^8.5.10` means "8.5.10 or any compatible patch/minor above it". This keeps
future patch security releases picked up automatically without requiring
another override bump, while bounding out any hypothetical breaking 9.x
change.

### AD-3: No next upgrade

Upgrading next is out of scope — it is a breaking change and creates unrelated
risk in the same cycle. The override achieves the acceptance criteria without
touching any application code.

### AD-4: CHANGELOG entry required

T153 acceptance criteria explicitly requires a CHANGELOG entry. Entry goes
under `[Unreleased]` using the `### Security` heading (Keep a Changelog
convention for security fixes).

### AD-5: No new tests needed

There is no application logic to test. The acceptance criteria is satisfied by
`npm audit --omit=dev` returning 0 findings and `npm run build` + `npm test`
passing. The sub-task verification step serves as the test strategy.

---

## Sub-task Decomposition

### ST-1 — Add `"overrides": { "postcss": "^8.5.10" }` to package.json

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none |
| Agent type | Dev (sonnet) |
| Test strategy | `npm install` then `npm audit --omit=dev` must return 0 findings |
| Acceptance criteria | `package.json` contains `"overrides": { "postcss": "^8.5.10" }`; `npm install` runs cleanly; `node_modules/next/node_modules/postcss` is either absent (deduplicated) or version >=8.5.10 |
| Status | done |

**Implementation note:** Edit `package.json` to add the overrides block, then
run `npm install` to regenerate `package-lock.json`. Do NOT manually edit
`package-lock.json`.

### ST-2 — Verify npm audit clean + build + unit tests pass

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1 |
| Agent type | Dev (sonnet) |
| Test strategy | Run `npm audit --omit=dev`, `npm run build`, `npx vitest run` |
| Acceptance criteria | `npm audit --omit=dev` exits 0 with 0 findings; `npm run build` exits 0; all 1388 (or more) vitest tests pass |
| Status | done |

### ST-3 — Add CHANGELOG entry under [Unreleased]

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-2 |
| Agent type | Dev (sonnet) |
| Test strategy | Manual review — changelog entry must be present and accurate |
| Acceptance criteria | `CHANGELOG.md` `[Unreleased]` section contains a `### Security` subsection with an entry mentioning the postcss override and GHSA-qx2v-qp2m-jg93 |
| Status | done |

---

## Overall Acceptance Criteria

1. `npm audit --omit=dev` returns exit code 0 with 0 moderate/high/critical findings.
2. `package.json` contains `"overrides": { "postcss": "^8.5.10" }`.
3. `npm run build` exits 0.
4. All vitest tests pass (>=1388/1388).
5. `CHANGELOG.md` mentions the postcss override under `[Unreleased] ### Security`.

---

## Questions

None. Approach is clear and defaults are safe.
