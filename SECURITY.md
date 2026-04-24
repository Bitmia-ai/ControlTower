# Security Policy

Control Tower is a **local-only** web dashboard that orchestrates [RedEye](https://github.com/Bitmia-ai/RedEye) sessions on your own machine. It reads your local Claude Code transcripts, spawns Claude processes, and writes to your projects' `.redeye/` control files.

By design Control Tower binds to `127.0.0.1` only and has no authentication. **Do not expose it to a public network.**

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **dev@bitmia.ai** with:
- A description of the issue
- Steps to reproduce
- The version of Control Tower affected
- Proof-of-concept code if applicable

Or use GitHub's [private security advisories](https://github.com/Bitmia-ai/ControlTower/security/advisories/new).

## What to expect

- Acknowledgment within 72 hours
- Assessment and remediation plan within 7 days for confirmed vulnerabilities
- Credit in release notes unless you prefer to stay anonymous

## Scope

We're particularly interested in:
- Command injection through project paths, backlog items, or steering directives written to disk
- Path traversal in API routes (especially project registry, backlog, steer, answer)
- Unauthenticated execution of shell commands on the host
- Secret leakage from transcripts, session logs, or cost API output
- Arbitrary file reads/writes outside the configured project paths
- Session-manager misuse (e.g., starting/killing processes outside the allowlist)

## Out of scope

- Any attack requiring access to the host's localhost (that's the trust model)
- Vulnerabilities in Next.js, Node, or Claude Code itself (report upstream)
- Issues in third-party dependencies without a Control Tower-specific exploit path
