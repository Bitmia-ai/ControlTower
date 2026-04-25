# Scheduled Tasks

_(Define recurring tasks here. Minimum frequency: 1 hour.)_

## Format
Each task follows:
### SCHED-{id}: {title}
- **Frequency:** every {duration}
- **Last run:** {ISO timestamp}
- **Task:**
  1. {step}
  2. {step}
- **Assigned to:** {role(s)}

---

### SCHED-1: Weekly dependency audit
- **Frequency:** every 7 days
- **Last run:** 2026-04-25T21:44:00Z
- **Task:**
  1. Run `npm audit` and report vulnerabilities to `.redeye/tester-reports.md`
  2. Check for outdated packages with `npm outdated`
  3. File backlog items for any high/critical vulnerabilities found
- **Assigned to:** CTO

### SCHED-2: Test Schedule
- **Frequency:** weekly
- **Last run:** 2026-04-25T21:44:00Z
- **Task:**
  1. Step 1
  2. Step 2
- **Assigned to:** CTO
