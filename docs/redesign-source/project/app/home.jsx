/* Desktop home — inbox-first redesign */

const TopBar = ({ theme, onTheme, unread = 1 }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 28px", borderBottom: "1px solid var(--line)",
    background: "var(--bg-0)", position: "sticky", top: 0, zIndex: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ color: "var(--fg-0)", display: "flex", margin: "-12px 0" }}><Logo size={48} /></span>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>
          Control Tower
        </span>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--red)", textTransform: "uppercase", fontWeight: 500 }}>
          on RedEye
        </span>
      </div>
    </div>
    <div style={{ position: "relative", flex: 1, maxWidth: 420, marginLeft: 40 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }}><Icon name="search" size={14} /></span>
      <input
        placeholder="Search projects, tasks, sessions…"
        style={{ paddingLeft: 34, height: 36, background: "var(--bg-1)" }}
      />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
        <span className="kbd">⌘</span><span className="kbd">K</span>
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button className="btn ghost icon" title="Activity"><Icon name="activity" size={16} /></button>
      <button className="btn ghost icon" title="Notifications" style={{ position: "relative" }}>
        <Icon name="bell" size={16} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999,
            background: "var(--red)", border: "2px solid var(--bg-0)",
          }} />
        )}
      </button>
      <button className="btn ghost icon" onClick={onTheme} title="Theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </div>
  </div>
);
window.TopBar = TopBar;

const InboxItem = ({ q, onAnswer, onSnooze }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "start",
    padding: "14px 18px", borderBottom: "1px solid var(--line)",
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8, background: "var(--amber-tint)",
      color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
    }}>
      <Icon name="q" size={16} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>{q.project}</span>
        <span style={{ color: "var(--fg-3)" }}>·</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{q.task}</span>
        <span style={{ color: "var(--fg-3)" }}>·</span>
        <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{q.age} ago</span>
      </div>
      <div style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 500, marginBottom: 4 }}>
        {q.title}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{q.context}</div>
    </div>
    <div style={{ display: "flex", gap: 6 }}>
      <button className="btn sm ghost" onClick={onSnooze}>Snooze</button>
      <button className="btn sm primary" onClick={onAnswer}>Answer</button>
    </div>
  </div>
);
window.InboxItem = InboxItem;

const InboxCard = ({ questions, onOpen }) => (
  <div className="card" style={{ borderColor: "var(--amber-tint)" }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 18px", borderBottom: "1px solid var(--line)",
      background: "var(--amber-tint)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--amber)" }}><Icon name="inbox" size={18} /></span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>
          Needs your input
        </h3>
        <span className="chip amber">{questions.length} open</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--fg-2)" }}>Oldest 12h</span>
        <button className="btn sm ghost">Mark all read</button>
      </div>
    </div>
    <div>
      {questions.map(q => <InboxItem key={q.id} q={q} onAnswer={onOpen} onSnooze={() => {}} />)}
    </div>
  </div>
);
window.InboxCard = InboxCard;

const ProjectCardNew = ({ p, onClick, onToggle, focus }) => {
  const statusColor = p.running ? "mint" : p.questions > 0 ? "amber" : "fg-3";
  const statusLabel = p.running ? "Running" : p.questions > 0 ? "Needs input" : "Idle";

  const sessionBars = [3, 5, 2, 6, 4, 8, 7, 5, 9, 6];

  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        cursor: "pointer", display: "flex", flexDirection: "column",
        transition: "transform .15s, border-color .15s",
        outline: focus ? "2px solid var(--sky)" : "none",
        outlineOffset: 2,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--line-strong)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--line)"}
    >
      {/* Top: status row */}
      <div style={{ padding: "16px 18px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span className={`dot ${p.running ? "mint dot-pulse" : p.questions > 0 ? "amber" : ""}`} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>
              {p.name}
            </h3>
            {p.questions > 0 && (
              <span className="chip amber" style={{ height: 18, fontSize: 10 }}>
                {p.questions} Q
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: `var(--${statusColor === "fg-3" ? "fg-3" : statusColor})`, fontWeight: 500 }}>
            {statusLabel}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{p.path}</span>
          {p.schedule?.enabled && (
            <span title={`Schedule: ${p.schedule.summary}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--red)", flex: "none" }}>
              <Icon name="schedule" size={11} />
              <span style={{ fontSize: 10 }}>{p.schedule.summary}</span>
            </span>
          )}
        </div>
      </div>

      {/* Working on */}
      <div style={{ padding: "0 18px 12px" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Working on</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, color: p.running ? "var(--mint)" : "var(--fg-2)", fontWeight: 500 }}>{p.workingOn.id}</span>
          <span style={{ fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {p.workingOn.title}
          </span>
        </div>
      </div>

      {/* Phase pipeline */}
      <div style={{ padding: "0 18px 14px" }}>
        <PhasePipeline phase={p.phase} running={p.running} compact />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--fg-3)" }}>
          <span style={{ color: p.running ? "var(--mint)" : "var(--fg-3)", fontWeight: 500 }}>
            {p.running ? p.phase.toUpperCase() : "—"}
          </span>
          <span>{p.running && p.workingOn.started}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}>
        <div style={{ padding: "10px 12px", borderRight: "1px solid var(--line)" }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Today</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>${p.sessionCost.toFixed(2)}</div>
        </div>
        <div style={{ padding: "10px 12px", borderRight: "1px solid var(--line)" }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Velocity</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            {p.velocity}/wk
            {p.velocityTrend === "up" && <span style={{ color: "var(--mint)", fontSize: 10 }}>↑</span>}
          </div>
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Backlog</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>{p.backlog}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 12px",
        borderTop: "1px solid var(--line)",
      }}>
        {p.running ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="btn sm rose-outline"
            style={{ flex: 1 }}
          >
            <Icon name="stop" size={12} /> Stop
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="btn sm mint"
            style={{ flex: 1 }}
          >
            <Icon name="play" size={12} /> Start
          </button>
        )}
        <button onClick={e => e.stopPropagation()} className="btn sm" style={{ flex: 1 }}>
          <Icon name="plus" size={12} /> Add task
        </button>
        <button onClick={e => e.stopPropagation()} className="btn sm" style={{ flex: 1 }}>
          <Icon name="steer" size={12} /> Steer
        </button>
        <button onClick={e => e.stopPropagation()} className="btn sm icon ghost" title="More">
          <Icon name="more" size={14} />
        </button>
      </div>
    </div>
  );
};
window.ProjectCardNew = ProjectCardNew;

const FleetSummary = ({ projects }) => {
  const running = projects.filter(p => p.running).length;
  const idle = projects.filter(p => !p.running && p.questions === 0).length;
  const needsInput = projects.filter(p => p.questions > 0).length;
  const totalCostToday = projects.reduce((s, p) => s + p.sessionCost, 0);
  const totalShipped = projects.reduce((s, p) => s + p.done, 0);

  const Stat = ({ label, value, accent, sub }) => (
    <div style={{ flex: 1, padding: "16px 20px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: accent || "var(--fg-0)", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="card" style={{ display: "flex", alignItems: "stretch", marginBottom: 0 }}>
      <Stat
        label="Running"
        value={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="dot mint dot-pulse" /> {running}
        </span>}
        sub={`of ${projects.length} projects`}
      />
      <div style={{ width: 1, background: "var(--line)" }} />
      <Stat
        label="Needs input"
        value={needsInput}
        accent={needsInput > 0 ? "var(--amber)" : undefined}
        sub={needsInput > 0 ? "Oldest 12h ago" : "All clear"}
      />
      <div style={{ width: 1, background: "var(--line)" }} />
      <Stat
        label="Scheduled runs"
        value={<span style={{ color: "var(--red)" }}>2</span>}
        sub={<span style={{ color: "var(--fg-2)" }}>Next: tonight 9pm</span>}
      />
      <div style={{ width: 1, background: "var(--line)" }} />
      <Stat
        label="Today's spend"
        value={<span className="mono">${totalCostToday.toFixed(2)}</span>}
        sub="Across fleet"
      />
      <div style={{ width: 1, background: "var(--line)" }} />
      <Stat
        label="Shipped (7d)"
        value={<span style={{ color: "var(--mint)" }}>+11</span>}
        sub={<span style={{ color: "var(--mint)" }}>↑ 22% vs prior</span>}
      />
    </div>
  );
};
window.FleetSummary = FleetSummary;
