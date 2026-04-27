# T104: Prepare npm package for npx-able install

**Status:** Spec (iter 127)  
**Priority:** P3  
**Type:** feature

## Goal

Make the package ready for `npm publish` without actually publishing. The CEO will publish manually. Deliver a confirmed-working `npm pack` tarball + clear publish instructions.

## Key Decision: No `output: "standalone"` for now

The T104 description mentions `output: "standalone"` in next.config.ts. However, standalone mode has significant caveats in this repo:

1. `scripts/patch-next.mjs` patches `node_modules/next/dist/build/utils.js` directly — this patch must run post-install, and the standalone bundle copies node_modules into `.next/standalone/node_modules/` which means the patch path `../node_modules/next/...` breaks in the installed location.
2. The `postinstall` hook runs on the _published_ package's `node_modules`, not the user's source tree.
3. Standalone output changes how `next start` works — it serves from `.next/standalone/server.js`, not the project root. This would require changing the `start` script to `node .next/standalone/server.js`.
4. Standalone bundles `.next/standalone` at ~50-100 MB typically — well over the 10 MB tarball target.

**Decision:** Skip `output: "standalone"`. Instead, ship source + config (the "install and build" model), which matches how most Next.js packages are distributed. Users clone/install, run `npm run build`, then `npm start`. This is documented in README already.

## Sub-tasks

### S1: package.json — `bin` entry + `files` whitelist + `prepublishOnly` + `private: false` toggle

Add to `package.json`:

```json
{
  "bin": {
    "control-tower": "bin/control-tower.mjs"
  },
  "files": [
    "app/",
    "components/",
    "lib/",
    "public/",
    "scripts/",
    "bin/",
    "proxy.ts",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md"
  ],
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

Keep `"private": true` — documenting that the CEO toggles it manually before publishing. Do not flip it in code (avoids accidental publish). Add a comment in CONTRIBUTING.md's Publishing section explaining the step.

Exclude: `node_modules/`, `.next/`, `e2e/`, `docs/`, `vitest.config.ts`, `playwright.config.ts`, `*.test.ts`, `.redeye/`, `.claude/`, `.worktrees/`, `.github/`.

### S2: Create `bin/control-tower.mjs`

The bin script should:
1. Check if `.next/` exists in the install location (user ran `npm run build`)
2. If yes, run `next start --hostname 127.0.0.1 --port 3200`
3. If no, print a helpful message:
   ```
   Control Tower: build not found. Please run `npm run build` first.
   Usage:
     cd /path/to/project
     npm run build
     npm start       # or: npx control-tower
   ```
4. Use `import { execSync } from 'child_process'` or spawn `next start` via the local next binary

The script must use ESM (`type: "module"` is NOT set in package.json — so use `.mjs` extension and explicit ESM imports). It must find the `next` binary relative to its own location:

```js
#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const nextBin = join(projectRoot, 'node_modules', '.bin', 'next');
const nextDir = join(projectRoot, '.next');

if (!existsSync(nextDir)) {
  console.error('Control Tower: .next/ build directory not found.');
  console.error('Run: npm run build');
  process.exit(1);
}

const child = spawn(nextBin, ['start', '--hostname', '127.0.0.1', '--port', '3200'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
```

### S3: Update CONTRIBUTING.md — "Publishing" section

Add a new section at the end of CONTRIBUTING.md:

```markdown
## Publishing to npm

> The package is publish-ready but not yet on npm. Publishing is a manual CEO step.

1. Ensure you are on the `main` branch with all tests passing.
2. Toggle `"private"` from `true` to `false` in `package.json`.
3. Run `npm pack --dry-run` to inspect the tarball contents and verify size.
4. Run `npm pack` to create the tarball locally and smoke-test:
   ```sh
   mkdir /tmp/ct-test && cd /tmp/ct-test
   npm install /path/to/control-tower-0.2.0.tgz
   cd node_modules/control-tower
   npm run build
   npm start   # or: npx control-tower
   ```
5. When satisfied: `npm publish --access public`
6. Restore `"private": true` on `main` after publish (prevents accidental re-publish).
```

### S4: Run `npm pack --dry-run` in verification

During BUILD, run `npm pack --dry-run 2>&1` and capture the output to verify:
- `bin/control-tower.mjs` is included
- `app/`, `lib/`, `components/` are included
- `node_modules/`, `.next/`, `e2e/`, `docs/` are NOT included
- Total size is reasonable (< 2 MB uncompressed source — no `.next/` build artifacts)

This is a verification step, not a deliverable. Do not commit the .tgz.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `bin`, `files`, `prepublishOnly` |
| `bin/control-tower.mjs` | New — CLI launcher |
| `CONTRIBUTING.md` | Add Publishing section |

## Tests

No new vitest unit tests needed (bin script is a thin launcher with no logic to unit test). The `npm pack --dry-run` output serves as the functional verification.

The existing test suite (923 tests, 440 passing) must remain stable.

## Review Criteria

- `npm pack --dry-run` output shows correct file list (no node_modules, no .next, no e2e)
- tarball size < 2 MB
- `bin/control-tower.mjs` is executable and findable at `which control-tower` after `npm install -g`
- `private: true` remains in package.json (do not publish)
- No regressions in vitest

## Out of Scope

- `output: "standalone"` in next.config.ts (see decision above)
- Actually publishing to npm
- Changing `private: false` in committed code
