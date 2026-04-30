/* Project detail: Now view (replaces mission control) */

const ProjectShell = ({ project, tab, onTab, onBack, onOpenSchedule, children }) => {
  const tabs = [
    { key: "now", label: "Now", icon: "bolt" },
    { key: "tasks", label: "Tasks", icon: "tasks", badge: project.backlog },
    { key: "history", label: "History", icon: "history" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Project bar */}
      <div style={{
        padding: "16px 28px 0", borderBottom: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}>
        <button onClick={onBack} className="btn ghost sm" style={{ marginBottom: 10, marginLeft: -8, color: "var(--fg-2)" }}>
          <Icon name="arrowLeft" size={12} /> All projects
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span className={`dot ${project.running ? "mint dot-pulse" : project.questions > 0 ? "amber" : ""}`} style={{ width: 12, height: 12 }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>{project.name}</h1>
            <span className="mono" style={{ fontSize: 12, color: "var(--fg-3)" }}>{project.path}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm primary"><Icon name="plus" size={13} /> Add task</button>
            <button className="btn sm ghost"><Icon name="eye" size={14} /> Live</button>
            <button className="btn sm ghost" onClick={onOpenSchedule} style={{ color: project.schedule?.enabled ? "var(--red)" : undefined }}>
              <Icon name="schedule" size={14} /> {project.schedule?.enabled ? `Schedule: ${project.schedule.summary}` : "Add schedule"}
            </button>
            <button className="btn sm ghost"><Icon name="settings" size={14} /></button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 38, padding: "0 14px",
                borderBottom: tab === t.key ? "2px solid var(--mint)" : "2px solid transparent",
                color: tab === t.key ? "var(--fg-0)" : "var(--fg-2)",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 500,
                marginBottom: -1,
              }}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.badge > 0 && (
                <span className="chip" style={{ height: 18, fontSize: 10, padding: "0 6px", background: "var(--bg-3)" }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
};
window.ProjectShell = ProjectShell;

const NowView = ({ project, onSteer, onAdd, onOpenSchedule }) => {
  const sparkValues = [3, 5, 2, 6, 4, 7, 5, 9, 6, 8, 7, 11];

  return (
    <div style={{ padding: "24px 28px 40px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

        {/* Hero: Working on */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`dot ${project.running ? "mint dot-pulse" : "amber"}`} />
              <span className="eyebrow">{project.running ? "Working on" : "Paused on"}</span>
              {project.running && <span style={{ fontSize: 11, color: "var(--fg-3)" }}>· {project.workingOn.started}</span>}
            </div>
            <span className={`chip ${project.running ? "mint" : "amber"}`}>
              <Icon name={project.running ? "bolt" : "pause"} size={10} /> {project.phase.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
            <span className="mono" style={{ fontSize: 14, color: "var(--mint)", fontWeight: 500 }}>{project.workingOn.id}</span>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
              {project.workingOn.title}
            </h2>
          </div>
          <PhasePipeline phase={project.phase} running={project.running} />
        </div>

        {/* Up next + Recently shipped */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Up next</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{project.upNext.id}</span>
              <span style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.4 }}>{project.upNext.title}</span>
            </div>
            <button className="btn sm ghost" style={{ width: "100%", marginTop: 12, justifyContent: "space-between", color: "var(--sky)" }}>
              View backlog ({project.backlog}) <Icon name="chev" size={12} />
            </button>
          </div>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="eyebrow">Recently shipped</div>
              <span style={{ fontSize: 11, color: "var(--mint)" }}>+6 this week</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {window.RECENT.slice(0, 4).map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="check" size={12} style={{ color: "var(--mint)" }} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)", flex: "none" }}>{r.id}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>${r.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live transcript preview */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="dot mint dot-pulse" />
              <div className="eyebrow">Live transcript</div>
              <span style={{ fontSize: 11, color: "var(--fg-3)" }}>round 4 · phase deploy</span>
            </div>
            <button className="btn sm ghost" style={{ color: "var(--sky)" }}>Open full <Icon name="arrow" size={12} /></button>
          </div>
          <div className="mono" style={{ fontSize: 12, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }} className2="scrollbar">
            {window.TRANSCRIPT.slice(0, 6).map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 4, flex: "none",
                  background: line.kind === "tool" ? "var(--sky-tint)" : line.kind === "thought" ? "var(--violet-tint)" : line.kind === "result" ? "var(--mint-tint)" : "var(--bg-3)",
                  color: line.kind === "tool" ? "var(--sky)" : line.kind === "thought" ? "var(--violet)" : line.kind === "result" ? "var(--mint)" : "var(--fg-2)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>{line.kind}</span>
                {line.tool && <span style={{ color: "var(--fg-1)", fontWeight: 500 }}>{line.tool}</span>}
                <span style={{ color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {line.args || line.body}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Controls */}
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Controls</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {project.running ? (
              <button className="btn rose-outline" style={{ gridColumn: "1 / -1" }}>
                <Icon name="stop" size={14} /> Stop session
              </button>
            ) : (
              <button className="btn mint" style={{ gridColumn: "1 / -1" }}>
                <Icon name="play" size={14} /> Start session
              </button>
            )}
            <button className="btn sm" disabled={!project.running} style={{ opacity: project.running ? 1 : 0.5 }}>
              <Icon name="pause" size={12} /> Pause
            </button>
            <button className="btn sm" onClick={onSteer}>
              <Icon name="steer" size={12} /> Steer
            </button>
            <button className="btn sm" onClick={onAdd}>
              <Icon name="plus" size={12} /> Add task
            </button>
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 10, color: "var(--fg-3)", display: "flex", justifyContent: "space-between" }}>
            <span>Shortcuts</span>
            <span style={{ display: "flex", gap: 4 }}>
              <span className="kbd">S</span><span className="kbd">P</span><span className="kbd">A</span>
            </span>
          </div>
        </div>

        {/* Schedule — per-project */}
        <ScheduleCard schedule={project.schedule} onOpen={onOpenSchedule} />

        {/* Cost */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div className="eyebrow">Cost · today</div>
            <span style={{ fontSize: 10, color: "var(--mint)" }}>↑ healthy</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--fg-0)" }}>${project.sessionCost.toFixed(2)}</span>
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>session</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 12 }}>
            ${project.burnRate.toFixed(2)}/session · est. ${(project.burnRate * 7).toFixed(2)} this week
          </div>
          <Spark values={sparkValues} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--fg-3)" }}>
            <span>Apr 17</span>
            <span>Apr 28</span>
          </div>
        </div>

        {/* Health */}
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Health</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="dot mint" />
            <span style={{ fontSize: 14, color: "var(--mint)", fontWeight: 600 }}>Healthy</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--fg-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Shipped</span><span className="mono" style={{ color: "var(--fg-1)" }}>{project.done}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Backlog</span><span className="mono" style={{ color: "var(--fg-1)" }}>{project.backlog}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Blockers</span><span className="mono" style={{ color: "var(--mint)" }}>0</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Last merge</span><span style={{ color: "var(--fg-1)" }}>2h ago</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.NowView = NowView;

const ScheduleCard = ({ schedule, onOpen }) => {
  // Demo: a project may have multiple schedules. Use schedule as the primary; add a dimmed second when present.
  const extras = schedule?.enabled ? [{ summary: "Friday digest", cron: "0 17 * * 5", nextRun: "Fri 5pm" }] : [];
  if (!schedule || !schedule.enabled) {
    return (
      <div className="card" style={{ padding: 14, borderStyle: "dashed", borderColor: "var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="eyebrow">Schedule</div>
          <span className="chip" style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--fg-3)" }}>Off</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 12, lineHeight: 1.5 }}>
          Run sessions automatically on a cadence. Useful for projects you want to nudge forward without checking in.
        </div>
        <button className="btn sm full" onClick={onOpen}>
          <Icon name="plus" size={12} /> Add schedule
        </button>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--red)" }}><Icon name="schedule" size={13} /></span>
          <div className="eyebrow">Schedules · {1 + extras.length}</div>
        </div>
        <button className="btn ghost icon sm" onClick={onOpen} title="Add schedule"><Icon name="plus" size={12} /></button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-0)", marginBottom: 2 }}>
        {schedule.summary}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 12 }}>
        {schedule.cron}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--fg-3)" }}>Next run</span>
          <span style={{ color: "var(--red)", fontWeight: 500 }}>{schedule.nextRun}</span>
        </div>
        {schedule.lastRun && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--fg-3)" }}>Last run</span>
            <span style={{ color: "var(--fg-1)" }}>{schedule.lastRun.when} · <span style={{ color: "var(--mint)" }}>{schedule.lastRun.outcome}</span></span>
          </div>
        )}
      </div>
      {extras.map((x, i) => (
        <div key={i} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--fg-1)" }}>{x.summary}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{x.cron}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--fg-2)" }}>{x.nextRun}</span>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={onOpen}><Icon name="settings" size={11} /> Manage</button>
        <button className="btn sm ghost" style={{ flex: 1, color: "var(--fg-2)" }}>Pause all</button>
      </div>
    </div>
  );
};
window.ScheduleCard = ScheduleCard;
