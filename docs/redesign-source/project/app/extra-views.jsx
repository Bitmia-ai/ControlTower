/* Tasks list, history, and mobile views */

const TasksView = ({ project }) => {
  const tasks = window.TASKS;
  const inProgress = tasks.filter(t => t.status === "in-progress");
  const pending = tasks.filter(t => t.status === "pending");
  const done = tasks.filter(t => t.status === "done");

  const TaskRow = ({ t }) => (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 60px 1fr auto auto",
      alignItems: "center", gap: 14, padding: "12px 18px",
      borderBottom: "1px solid var(--line)",
    }}>
      <span className={`dot ${t.status === "in-progress" ? "mint dot-pulse" : t.status === "done" ? "mint" : ""}`} />
      <span className="mono" style={{ fontSize: 12, color: "var(--fg-2)" }}>{t.id}</span>
      <span style={{ fontSize: 13, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
      <span className={`chip ${t.priority === "P0" ? "rose" : t.priority === "P1" ? "amber" : ""}`} style={{ fontSize: 10, height: 18 }}>{t.priority}</span>
      <span className="chip" style={{ fontSize: 10, height: 18, color: "var(--fg-3)" }}>{t.section}</span>
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 40px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--fg-0)", fontWeight: 600 }}>Tasks</h2>
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{tasks.length} items · {pending.length + inProgress.length} open</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Search…" style={{ width: 220, height: 32, fontSize: 12 }} />
          <button className="btn sm"><Icon name="filter" size={12} /> Filter</button>
          <button className="btn sm primary"><Icon name="plus" size={12} /> Add task</button>
        </div>
      </div>

      {/* In progress hero */}
      {inProgress.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--mint)", borderWidth: 1 }}>
          <div style={{ padding: "10px 18px", background: "var(--mint-tint)", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="dot mint dot-pulse" />
            <span className="eyebrow" style={{ color: "var(--mint)" }}>In progress · {project.workingOn.started}</span>
          </div>
          {inProgress.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--mint)" }}>{t.id}</span>
              <span style={{ fontSize: 14, color: "var(--fg-0)", flex: 1 }}>{t.title}</span>
              <span className="chip rose" style={{ fontSize: 10, height: 18 }}>{t.priority}</span>
              <button className="btn sm ghost" style={{ color: "var(--sky)" }}>View live <Icon name="arrow" size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Backlog */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="chevDown" size={14} style={{ color: "var(--fg-2)" }} />
            <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>Backlog</span>
            <span className="chip" style={{ fontSize: 10, height: 18 }}>{pending.length}</span>
          </div>
        </div>
        {pending.map(t => <TaskRow key={t.id} t={t} />)}
      </div>

      {/* Done collapsed */}
      <div className="card">
        <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="chevDown" size={14} style={{ color: "var(--fg-2)" }} />
            <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>Done</span>
            <span className="chip" style={{ fontSize: 10, height: 18 }}>{done.length}</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Last 7 days</span>
        </div>
        {done.slice(0, 4).map(t => <TaskRow key={t.id} t={t} />)}
      </div>
    </div>
  );
};
window.TasksView = TasksView;

const HistoryView = ({ project }) => {
  const sessions = window.SESSIONS;
  const totalCost = sessions.reduce((s, x) => s + x.cost, 0);
  return (
    <div style={{ padding: "24px 28px 40px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--fg-0)", fontWeight: 600 }}>History</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Search sessions…" style={{ width: 220, height: 32, fontSize: 12 }} />
          <button className="btn sm"><Icon name="filter" size={12} /> Last 7d</button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="card" style={{ display: "flex", marginBottom: 16 }}>
        {[
          { label: "Sessions", v: sessions.length },
          { label: "Shipped", v: sessions.filter(s => s.outcome === "shipped").length, accent: "var(--mint)" },
          { label: "Total cost", v: `$${totalCost.toFixed(2)}` },
          { label: "Avg / session", v: `$${(totalCost / sessions.length).toFixed(2)}` },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "14px 18px", borderRight: i < 3 ? "1px solid var(--line)" : "none" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 18, color: s.accent || "var(--fg-0)", fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Session list */}
      <div className="card">
        {sessions.map((s, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "120px 80px 1fr auto auto auto",
            gap: 16, alignItems: "center", padding: "14px 18px",
            borderBottom: i < sessions.length - 1 ? "1px solid var(--line)" : "none",
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--fg-1)", fontWeight: 500 }}>{s.date}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{s.time}</div>
            </div>
            <span className="mono" style={{ fontSize: 12, color: "var(--fg-2)" }}>{s.task}</span>
            <span style={{ fontSize: 13, color: "var(--fg-1)" }}>{s.duration} session</span>
            <span className={`chip ${s.outcome === "shipped" ? "mint" : "amber"}`} style={{ fontSize: 10, height: 18 }}>
              {s.outcome === "shipped" && <Icon name="check" size={10} />}
              {s.outcome === "running" && <span className="dot mint dot-pulse" style={{ width: 6, height: 6 }} />}
              {s.outcome}
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--fg-2)" }}>{s.phase}</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--rose)", fontWeight: 500, minWidth: 60, textAlign: "right" }}>
              ${s.cost.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
window.HistoryView = HistoryView;

/* ===== MOBILE ===== */

const MobileShell = ({ children, tab, onTab, unread = 1, fabIcon = "plus", onFab }) => (
  <div style={{
    width: "100%", height: "100%", background: "var(--bg-0)",
    display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
  }}>
    {/* status bar */}
    <div style={{
      height: 44, paddingTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 18px", fontSize: 13, fontWeight: 600, color: "var(--fg-0)",
    }}>
      <span>9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="2" height="4"/><rect x="4" y="4" width="2" height="6"/><rect x="8" y="2" width="2" height="8"/><rect x="12" y="0" width="2" height="10"/></svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M7 8.5C9.5 6 11.5 6 13 8" /><path d="M4 5.5C7 2 9 2 11 5" /><path d="M1 2.5C5 -2 11 -2 14 2" /><circle cx="7" cy="9" r="0.7" fill="currentColor"/></svg>
        <div style={{ width: 24, height: 11, border: "1.2px solid currentColor", borderRadius: 3, position: "relative", padding: 1 }}>
          <div style={{ width: "70%", height: "100%", background: "currentColor", borderRadius: 1 }} />
          <div style={{ position: "absolute", right: -3, top: 3, width: 2, height: 5, background: "currentColor", borderRadius: 1 }} />
        </div>
      </div>
    </div>
    {children}
    {/* FAB */}
    {onFab && (
      <button onClick={onFab} className="btn primary" style={{
        position: "absolute", right: 18, bottom: 92, width: 56, height: 56, borderRadius: "50%",
        boxShadow: "0 12px 32px oklch(0 0 0 / 0.4)",
      }}>
        <Icon name={fabIcon} size={22} />
      </button>
    )}
    {/* Bottom tab bar */}
    <div style={{
      borderTop: "1px solid var(--line)", background: "var(--bg-1)",
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
      paddingBottom: 18,
    }}>
      {[
        { key: "home", label: "Projects", icon: "home" },
        { key: "inbox", label: "Inbox", icon: "inbox", badge: unread },
        { key: "live", label: "Live", icon: "activity" },
        { key: "settings", label: "More", icon: "more" },
      ].map(t => (
        <button
          key={t.key}
          onClick={() => onTab(t.key)}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "10px 0",
            color: tab === t.key ? "var(--fg-0)" : "var(--fg-3)",
            position: "relative",
          }}
        >
          <div style={{ position: "relative" }}>
            <Icon name={t.icon} size={20} strokeWidth={tab === t.key ? 2 : 1.6} />
            {t.badge > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -6,
                background: "var(--amber)", color: "var(--bg-0)",
                fontSize: 9, fontWeight: 700,
                minWidth: 14, height: 14, padding: "0 3px", borderRadius: 999,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{t.badge}</span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: tab === t.key ? 600 : 500 }}>{t.label}</span>
        </button>
      ))}
    </div>
  </div>
);
window.MobileShell = MobileShell;

const MobileHome = ({ onProject, onTab, tab }) => {
  const projects = window.PROJECTS;
  const totalToday = projects.reduce((s, p) => s + p.sessionCost, 0);
  const running = projects.filter(p => p.running).length;
  const needsInput = projects.filter(p => p.questions > 0).length;

  return (
    <MobileShell tab={tab || "home"} onTab={onTab} unread={needsInput} onFab={() => {}}>
      {/* App bar */}
      <div style={{ padding: "8px 18px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Fleet</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>Projects</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost icon" style={{ position: "relative" }}>
            <Icon name="bell" size={18} />
            {needsInput > 0 && <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 999, background: "var(--amber)", border: "2px solid var(--bg-0)" }} />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 18px 24px" }} className="scrollbar">
        {/* Glance card */}
        <div className="card" style={{ padding: 14, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Running</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot mint dot-pulse" />
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)" }}>{running}</span>
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Open Q</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: needsInput > 0 ? "var(--amber)" : "var(--fg-0)" }}>{needsInput}</div>
          </div>
          <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Today</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)" }}>${totalToday.toFixed(2)}</div>
          </div>
        </div>

        {/* Inbox preview */}
        {needsInput > 0 && (
          <div onClick={() => onTab("inbox")} className="card" style={{ marginBottom: 14, cursor: "pointer", borderColor: "var(--amber)" }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, background: "var(--amber-tint)" }}>
              <Icon name="inbox" size={16} style={{ color: "var(--amber)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{window.QUESTIONS.length} questions need you</div>
                <div style={{ fontSize: 11, color: "var(--fg-2)" }}>haze · oldest 12h ago</div>
              </div>
              <Icon name="chev" size={14} style={{ color: "var(--amber)" }} />
            </div>
          </div>
        )}

        <div className="eyebrow" style={{ marginBottom: 8 }}>Projects</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => onProject(p.id)} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`dot ${p.running ? "mint dot-pulse" : p.questions > 0 ? "amber" : ""}`} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>{p.name}</span>
                {p.questions > 0 && <span className="chip amber" style={{ fontSize: 10, height: 18 }}>{p.questions} Q</span>}
                <span style={{ marginLeft: "auto", fontSize: 11, color: p.running ? "var(--mint)" : "var(--fg-3)", fontWeight: 500 }}>
                  {p.running ? p.phase.toUpperCase() : "Idle"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: p.running ? "var(--mint)" : "var(--fg-2)" }}>{p.workingOn.id}</span>
                <span style={{ fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.workingOn.title}</span>
              </div>
              <PhasePipeline phase={p.phase} running={p.running} compact />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {p.running ? (
                  <button onClick={e => e.stopPropagation()} className="btn sm rose-outline" style={{ flex: 1 }}><Icon name="stop" size={11} /> Stop</button>
                ) : (
                  <button onClick={e => e.stopPropagation()} className="btn sm mint" style={{ flex: 1 }}><Icon name="play" size={11} /> Start</button>
                )}
                <button onClick={e => e.stopPropagation()} className="btn sm" style={{ flex: 1 }}><Icon name="plus" size={11} /> Task</button>
                <button onClick={e => e.stopPropagation()} className="btn sm" style={{ flex: 1 }}><Icon name="steer" size={11} /> Steer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
};
window.MobileHome = MobileHome;

const MobileInbox = ({ onTab, tab }) => (
  <MobileShell tab={tab || "inbox"} onTab={onTab} unread={window.QUESTIONS.length}>
    <div style={{ padding: "8px 18px 14px" }}>
      <div className="eyebrow" style={{ marginBottom: 2 }}>What needs you</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>Inbox</h1>
      <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>{window.QUESTIONS.length} questions · 0 blockers</div>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: "0 18px 24px" }} className="scrollbar">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {window.QUESTIONS.map(q => (
          <div key={q.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="q" size={14} style={{ color: "var(--amber)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{q.project} · {q.task}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-3)" }}>{q.age}</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 500, marginBottom: 6, lineHeight: 1.35 }}>
              {q.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 12, lineHeight: 1.4 }}>
              {q.context}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm primary" style={{ flex: 1 }}>Answer</button>
              <button className="btn sm" style={{ flex: 1 }}>Snooze</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </MobileShell>
);
window.MobileInbox = MobileInbox;

const MobileProject = ({ projectId, onTab, onBack, tab }) => {
  const project = window.PROJECTS[projectId] || window.PROJECTS[0];
  return (
    <MobileShell tab={tab || "home"} onTab={onTab} unread={1}>
      <div style={{ padding: "4px 18px 14px" }}>
        <button onClick={onBack} className="btn ghost sm" style={{ marginBottom: 8, marginLeft: -8, color: "var(--fg-2)" }}>
          <Icon name="arrowLeft" size={12} /> Projects
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`dot ${project.running ? "mint dot-pulse" : project.questions > 0 ? "amber" : ""}`} style={{ width: 12, height: 12 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>{project.name}</h1>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{project.path}</span>
          {project.schedule?.enabled && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--red)" }}>
              <Icon name="schedule" size={11} /> {project.schedule.summary}
            </span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 18px 24px" }} className="scrollbar">
        {/* Working on hero */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className={`dot ${project.running ? "mint dot-pulse" : "amber"}`} />
            <span className="eyebrow">{project.running ? "Working on" : "Paused"}</span>
            <span className={`chip ${project.running ? "mint" : "amber"}`} style={{ marginLeft: "auto", fontSize: 10, height: 18 }}>
              {project.phase.toUpperCase()}
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--mint)" }}>{project.workingOn.id}</span>
          <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 500, marginTop: 4, marginBottom: 12, lineHeight: 1.35 }}>
            {project.workingOn.title}
          </div>
          <PhasePipeline phase={project.phase} running={project.running} compact />
          <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 6 }}>
            {project.running ? `Started ${project.workingOn.started}` : "Resume to continue"}
          </div>
        </div>

        {/* Big action button */}
        {project.running ? (
          <button className="btn rose-outline lg" style={{ width: "100%", marginBottom: 8 }}>
            <Icon name="stop" size={14} /> Stop session
          </button>
        ) : (
          <button className="btn mint lg" style={{ width: "100%", marginBottom: 8 }}>
            <Icon name="play" size={14} /> Start session
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button className="btn"><Icon name="steer" size={13} /> Steer</button>
          <button className="btn"><Icon name="plus" size={13} /> Add task</button>
        </div>

        {/* Schedule */}
        {project.schedule?.enabled ? (
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--red)" }}><Icon name="schedule" size={14} /></span>
                <div className="eyebrow">Schedule</div>
              </div>
              <span className="chip red">On</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 500 }}>{project.schedule.summary}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{project.schedule.cron}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--red)" }}>Next run · {project.schedule.nextRun}</div>
          </div>
        ) : (
          <button className="btn" style={{ width: "100%", marginBottom: 12, color: "var(--fg-2)", borderStyle: "dashed" }}>
            <Icon name="schedule" size={13} /> Add schedule
          </button>
        )}

        {/* Stats */}
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 12 }}>
          <div style={{ padding: "12px 10px" }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>Today</div>
            <div className="mono" style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>${project.sessionCost.toFixed(2)}</div>
          </div>
          <div style={{ padding: "12px 10px", borderLeft: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>Velocity</div>
            <div className="mono" style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>{project.velocity}/wk</div>
          </div>
          <div style={{ padding: "12px 10px", borderLeft: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>Backlog</div>
            <div className="mono" style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>{project.backlog}</div>
          </div>
        </div>

        {/* Recent shipped */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Recently shipped</div>
        <div className="card" style={{ marginBottom: 12 }}>
          {window.RECENT.slice(0, 3).map((r, i) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              borderBottom: i < 2 ? "1px solid var(--line)" : "none",
            }}>
              <Icon name="check" size={12} style={{ color: "var(--mint)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{r.id}</span>
              <span style={{ fontSize: 12, color: "var(--fg-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
};
window.MobileProject = MobileProject;
