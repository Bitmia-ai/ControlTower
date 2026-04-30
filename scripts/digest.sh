#!/usr/bin/env bash
# Generates .redeye/digest.json — a pre-computed summary CTO reads each iteration.
# Reads: state.json, steering.md, inbox.md, tasks.md, schedules.md, tester-reports.md
set -euo pipefail

REDEYE=".redeye"
STATE="$REDEYE/state.json"
DIGEST="$REDEYE/digest.json"

require_jq() { command -v jq >/dev/null || { echo "jq required" >&2; exit 1; }; }
require_jq

# ── state.json fields ────────────────────────────────────────────────────────
phase=$(jq -r '.phase' "$STATE")
phase_status=$(jq -r '.phase_status' "$STATE")
iteration=$(jq -r '.iteration' "$STATE")
current_task=$(jq -r '.task_id // null' "$STATE")
worktree_path=$(jq -r '.worktree_path // null' "$STATE")
worktree_branch=$(jq -r '.worktree_branch // null' "$STATE")
confidence=$(jq -r '.health.confidence // "HIGH"' "$STATE")
env_status=$(jq -r '.health.env_status // "healthy"' "$STATE")
env_healthy=$([ "$env_status" = "healthy" ] && echo "true" || echo "false")
iterations_since_last_deploy=$(jq -r '.health.iterations_since_last_deploy // 0' "$STATE")

# Worktree enabled from config.md (default true) — check Worktree Isolation section only
worktree_enabled="true"
if python3 -c "
import re, sys
try:
    c = open('.redeye/config.md').read()
except: sys.exit(0)
m = re.search(r'## Worktree Isolation.*?(?=\n## |\Z)', c, re.DOTALL)
if m and re.search(r'Enabled.*?false', m.group(0)): sys.exit(1)
" 2>/dev/null; then
  worktree_enabled="true"
else
  worktree_enabled="false"
fi

# ── steering.md ──────────────────────────────────────────────────────────────
stop_directive="false"
pause_directive="false"
if grep -qE "^STOP" "$REDEYE/steering.md" 2>/dev/null; then stop_directive="true"; fi
if grep -qE "^PAUSE" "$REDEYE/steering.md" 2>/dev/null; then pause_directive="true"; fi

# Collect directive lines (skip STOP/PAUSE, skip blank lines before ## Directives header)
steering_json=$(python3 - <<'PYEOF'
import sys, json, re

try:
    with open(".redeye/steering.md") as f:
        content = f.read()
except FileNotFoundError:
    print("[]")
    sys.exit(0)

lines = content.splitlines()
directives = []
in_directives = False
for line in lines:
    stripped = line.strip()
    if stripped == "## Directives":
        in_directives = True
        continue
    if in_directives:
        if stripped.upper() in ("STOP", "PAUSE"):
            continue
        directives.append(line.rstrip())

# Trim leading/trailing blank lines
while directives and not directives[0].strip():
    directives.pop(0)
while directives and not directives[-1].strip():
    directives.pop()

# Collapse multiple consecutive blank lines into one
result = []
prev_blank = False
for line in directives:
    is_blank = not line.strip()
    if is_blank and prev_blank:
        continue
    result.append(line)
    prev_blank = is_blank

print(json.dumps(result))
PYEOF
)

# ── inbox.md — CEO answers pending incorporation ──────────────────────────────
ceo_answers_pending=$(python3 - <<'PYEOF'
import re, sys

try:
    with open(".redeye/inbox.md") as f:
        content = f.read()
except FileNotFoundError:
    print(0)
    sys.exit(0)

# Find Open Questions section — any question there with an Answer: line counts
open_match = re.search(
    r'## Questions \(Open\)(.*?)(?=\n## |\Z)',
    content, re.DOTALL
)
count = 0
if open_match:
    section = open_match.group(1)
    # Split into individual question blocks
    blocks = re.split(r'\n(?=### Q-\d+)', section)
    for block in blocks:
        if '**Answer:**' in block and '**Incorporated:**' not in block:
            count += 1

# Also check Answered section for items lacking Incorporated
answered_match = re.search(
    r'## Answered / Provided(.*?)(?=\n## |\Z)',
    content, re.DOTALL
)
if answered_match:
    section = answered_match.group(1)
    blocks = re.split(r'\n(?=### Q-\d+)', section)
    for block in blocks:
        if '**Answer:**' in block and '**Incorporated:**' not in block:
            count += 1

print(count)
PYEOF
)

# ── tasks.md — task counts ────────────────────────────────────────────────────
task_counts=$(python3 - <<'PYEOF'
import re

try:
    with open(".redeye/tasks.md") as f:
        content = f.read()
except FileNotFoundError:
    print("0 0 0 0")
    import sys; sys.exit(0)

sections = re.split(r'\n## ', content)
ceo_pending = 0
triaged_planned = 0
discovered_pending = 0
blocked = 0

for section in sections:
    is_ceo = section.startswith('CEO Requests')
    is_discovered = section.startswith('Discovered')
    blocks = re.split(r'\n(?=### T\d+:)', section)
    for block in blocks:
        sm = re.search(r'\*\*Status:\*\*\s*(\S+)', block)
        if not sm:
            continue
        status = sm.group(1).strip().lower().rstrip('.')
        if status in ('done', 'wontdo', 'wont-do', 'cancelled'):
            continue
        if status == 'pending':
            if is_discovered:
                discovered_pending += 1
            else:
                ceo_pending += 1
        elif status in ('triaged', 'planned', 'in-progress', 'in_progress'):
            triaged_planned += 1
        elif status == 'blocked':
            blocked += 1

print(ceo_pending, triaged_planned, discovered_pending, blocked)
PYEOF
)
read ceo_pending triaged_planned discovered_pending blocked_count <<< "$task_counts"

# ── schedules.md — overdue schedules ─────────────────────────────────────────
overdue_schedules=$(python3 - <<'PYEOF'
import re, sys
from datetime import datetime, timezone, timedelta

try:
    with open(".redeye/schedules.md") as f:
        content = f.read()
except FileNotFoundError:
    print(0)
    sys.exit(0)

now = datetime.now(timezone.utc)
count = 0
blocks = re.split(r'\n(?=### SCHED-)', content)
for block in blocks:
    freq_m = re.search(r'\*\*Frequency:\*\*\s*every\s+(\d+)\s+(day|hour|week)', block, re.IGNORECASE)
    last_m = re.search(r'\*\*Last run:\*\*\s*(\S+)', block)
    if not freq_m or not last_m:
        continue
    amount = int(freq_m.group(1))
    unit = freq_m.group(2).lower()
    last_str = last_m.group(1)
    try:
        last = datetime.fromisoformat(last_str.replace('Z', '+00:00'))
    except ValueError:
        continue
    if unit == 'hour':
        delta = timedelta(hours=amount)
    elif unit == 'week':
        delta = timedelta(weeks=amount)
    else:
        delta = timedelta(days=amount)
    if now >= last + delta:
        count += 1

print(count)
PYEOF
)

# ── tester-reports.md — new (pending-triage) bug reports ─────────────────────
tester_reports_new=$(python3 - <<'PYEOF'
import re
try:
    with open(".redeye/tester-reports.md") as f:
        content = f.read()
except FileNotFoundError:
    print(0)
    import sys; sys.exit(0)

# Count actual BUG-N blocks with pending-triage status (skip the format template)
blocks = re.findall(r'### BUG-\d+:.*?\*\*Status:\*\*\s*pending-triage', content, re.DOTALL)
print(len(blocks))
PYEOF
)

# ── state age ────────────────────────────────────────────────────────────────
state_mtime=$(python3 -c "import os; print(int(os.path.getmtime('$STATE')))")
now_ts=$(python3 -c "import time; print(int(time.time()))")
state_age_seconds=$(( now_ts - state_mtime ))

# ── crash recovery ────────────────────────────────────────────────────────────
crash_recovery="null"

# ── write digest.json ─────────────────────────────────────────────────────────
python3 - \
  "$phase" "$phase_status" "$iteration" \
  "$stop_directive" "$pause_directive" \
  "$steering_json" "$env_healthy" "$confidence" \
  "$ceo_pending" "$triaged_planned" "$discovered_pending" "$blocked_count" \
  "$overdue_schedules" "$ceo_answers_pending" "$tester_reports_new" \
  "$current_task" "$iterations_since_last_deploy" "$state_age_seconds" \
  "$worktree_path" "$worktree_branch" "$worktree_enabled" \
  "$DIGEST" <<'PYEOF'
import json, sys

args = sys.argv[1:]
def bval(s): return s == "true"
def ival(s): return int(s)
def nval(s): return None if s == "null" else s

phase, phase_status = args[0], args[1]
iteration = ival(args[2])
stop_directive, pause_directive = bval(args[3]), bval(args[4])
steering_directives = json.loads(args[5])
env_healthy, confidence = bval(args[6]), args[7]
ceo_pending, triaged_planned = ival(args[8]), ival(args[9])
discovered_pending, blocked = ival(args[10]), ival(args[11])
overdue_schedules = ival(args[12])
ceo_answers_pending = ival(args[13])
tester_reports_new = ival(args[14])
current_task = nval(args[15])
iterations_since_last_deploy = ival(args[16])
state_age_seconds = ival(args[17])
worktree_path = nval(args[18])
worktree_branch = nval(args[19])
worktree_enabled = bval(args[20])
digest_path = args[21]

digest = {
    "phase": phase,
    "phase_status": phase_status,
    "iteration": iteration,
    "stop_directive": stop_directive,
    "pause_directive": pause_directive,
    "steering_directives": steering_directives,
    "env_healthy": env_healthy,
    "confidence": confidence,
    "tasks_summary": {
        "ceo_pending": ceo_pending,
        "triaged_planned": triaged_planned,
        "discovered_pending": discovered_pending,
        "blocked": blocked
    },
    "overdue_schedules": overdue_schedules,
    "ceo_answers_pending": ceo_answers_pending,
    "tester_reports_new": tester_reports_new,
    "current_task": current_task,
    "iterations_since_last_deploy": iterations_since_last_deploy,
    "state_age_seconds": state_age_seconds,
    "crash_recovery": None,
    "validation_warnings": [],
    "worktree_path": worktree_path,
    "worktree_branch": worktree_branch,
    "worktree_enabled": worktree_enabled,
}

with open(digest_path, "w") as f:
    json.dump(digest, f, indent=2)
    f.write("\n")

print(f"digest.json written (iter={digest['iteration']}, phase={digest['phase']}/{digest['phase_status']}, ceo_answers_pending={digest['ceo_answers_pending']}, ceo_pending={digest['tasks_summary']['ceo_pending']})")
PYEOF
