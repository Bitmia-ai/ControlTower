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
- **Last run:** 1970-01-01T00:00:00Z
- **Task:**
  1. Run `npm audit` and report vulnerabilities to `.redeye/tester-reports.md`
  2. Check for outdated packages with `npm outdated`
  3. File backlog items for any high/critical vulnerabilities found
- **Assigned to:** CTO
