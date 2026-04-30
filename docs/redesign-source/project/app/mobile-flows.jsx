/* Mobile-only flows: Onboarding, Add Project, Answer Question, Schedule, Steer, Live */

const { useState: useMobileState } = React;

/* ===== Mobile sheet shell — fullscreen modal in a phone frame ===== */
const MobileSheet = ({ children, title, subtitle, onClose, leading, trailing }) => (
  <div style={{
    position: "absolute", inset: 0, background: "var(--bg-0)",
    display: "flex", flexDirection: "column", zIndex: 10,
  }}>
    {/* Status bar */}
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

    {/* Top bar */}
    <div style={{
      padding: "8px 14px 14px",
      display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ width: 60, display: "flex", justifyContent: "flex-start" }}>
        {leading || (
          <button onClick={onClose} className="btn ghost sm" style={{ marginLeft: -6, color: "var(--fg-2)" }}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ width: 60, display: "flex", justifyContent: "flex-end" }}>
        {trailing}
      </div>
    </div>

    {children}
  </div>
);
window.MobileSheet = MobileSheet;

/* ============================================================
   1. MOBILE ONBOARDING — 6 steps as fullscreen sheets
   ============================================================ */

const MOB_STEPS = [
  { key: "repo", label: "Repository" },
  { key: "name", label: "Project name" },
  { key: "vision", label: "Vision" },
  { key: "task", label: "First task" },
  { key: "deploy", label: "Deploy" },
  { key: "init", label: "Initialize" },
];

const MobileOnboarding = ({ onClose }) => {
  const [stepIdx, setStepIdx] = useMobileState(0);
  const [name, setName] = useMobileState("composer-ui");
  const [repo, setRepo] = useMobileState("solana/composer-ui");
  const [vision, setVision] = useMobileState("");
  const [task, setTask] = useMobileState("");
  const stepKey = MOB_STEPS[stepIdx].key;
  const isLast = stepIdx === MOB_STEPS.length - 1;

  return (
    <MobileSheet
      title={MOB_STEPS[stepIdx].label}
      subtitle={`Step ${stepIdx + 1} of ${MOB_STEPS.length}`}
      onClose={onClose}
      trailing={!isLast && (
        <button className="btn ghost sm" onClick={() => setStepIdx(Math.min(MOB_STEPS.length - 1, stepIdx + 1))} style={{ color: "var(--fg-2)", fontSize: 12 }}>
          Skip
        </button>
      )}
    >
      {/* Stepper rail */}
      <div style={{ padding: "10px 18px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {MOB_STEPS.map((s, i) => (
            <div key={s.key} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= stepIdx ? "var(--mint)" : "var(--line)",
            }} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 18px 24px" }} className="scrollbar">
        {stepKey === "repo" && <MobOBRepo repo={repo} setRepo={setRepo} />}
        {stepKey === "name" && <MobOBName name={name} setName={setName} repo={repo} />}
        {stepKey === "vision" && <MobOBVision vision={vision} setVision={setVision} />}
        {stepKey === "task" && <MobOBTask task={task} setTask={setTask} />}
        {stepKey === "deploy" && <MobOBDeploy />}
        {stepKey === "init" && <MobOBInit name={name} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 18px 22px", borderTop: "1px solid var(--line)",
        display: "flex", gap: 8, background: "var(--bg-1)",
      }}>
        {stepIdx > 0 && (
          <button className="btn lg" style={{ flex: "0 0 auto", padding: "0 16px" }} onClick={() => setStepIdx(stepIdx - 1)}>
            <Icon name="arrowLeft" size={13} />
          </button>
        )}
        {isLast ? (
          <button className="btn mint lg" style={{ flex: 1 }} onClick={onClose}>
            <Icon name="play" size={13} /> Start session
          </button>
        ) : (
          <button className="btn primary lg" style={{ flex: 1 }} onClick={() => setStepIdx(stepIdx + 1)}>
            Continue <Icon name="arrowRight" size={13} />
          </button>
        )}
      </div>
    </MobileSheet>
  );
};
window.MobileOnboarding = MobileOnboarding;

/* --- Step 1: Pick repo --- */
const MOB_REPOS = [
  { name: "solana/composer-ui", branch: "main", lang: "TypeScript", updated: "12m", redeye: false },
  { name: "solana/redeye-core", branch: "main", lang: "Rust", updated: "2h", redeye: true },
  { name: "solana/haze", branch: "develop", lang: "Python", updated: "1d", redeye: false },
  { name: "solana/website", branch: "main", lang: "Astro", updated: "3d", redeye: true },
];

const MobOBRepo = ({ repo, setRepo }) => {
  const pickedRepo = MOB_REPOS.find(r => r.name === repo);
  return (
  <div>
    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4, letterSpacing: "-0.01em" }}>
      Pick a repository
    </div>
    <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 16, lineHeight: 1.45 }}>
      Redeye will clone it locally and run sessions in isolated worktrees.
    </div>

    {pickedRepo?.redeye && (
      <div className="card" style={{
        padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
        background: "var(--mint-tint)", borderColor: "var(--mint-tint-strong)",
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7, background: "var(--bg-0)", color: "var(--mint)",
          display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
          border: "1px solid var(--mint-tint-strong)",
        }}>
          <Icon name="check" size={13} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)" }}>
            <span className="mono">.redeye/</span> already exists
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-2)", marginTop: 1, lineHeight: 1.4 }}>Skip the rest — we'll just register it</div>
        </div>
        <button className="btn primary sm" style={{ fontSize: 11, flex: "none" }}>
          Register
        </button>
      </div>
    )}

    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10,
      marginBottom: 14,
    }}>
      <Icon name="search" size={14} style={{ color: "var(--fg-3)" }} />
      <input
        defaultValue=""
        placeholder="Search GitHub…"
        style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "var(--fg-0)", fontSize: 14 }}
      />
    </div>

    <div className="eyebrow" style={{ marginBottom: 8 }}>Recent</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {MOB_REPOS.map(r => {
        const active = repo === r.name;
        return (
          <button
            key={r.name}
            onClick={() => setRepo(r.name)}
            className="card"
            style={{
              padding: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 12,
              borderColor: active ? "var(--mint)" : "var(--line)",
              background: active ? "var(--mint-tint)" : "var(--bg-1)",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: "var(--bg-2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-2)",
              flex: "none",
            }}>
              <Icon name="git" size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                <span>{r.lang}</span><span>·</span><span>{r.branch}</span><span>·</span><span>{r.updated} ago</span>
                {r.redeye && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--mint)", fontWeight: 500 }}>
                    · <Icon name="check" size={9} /> init
                  </span>
                )}
              </div>
            </div>
            {active && <Icon name="check" size={14} style={{ color: "var(--mint)" }} />}
          </button>
        );
      })}
    </div>

    <button className="btn ghost sm" style={{ width: "100%", marginTop: 12, color: "var(--fg-2)", borderStyle: "dashed", border: "1px dashed var(--line)" }}>
      <Icon name="link" size={11} /> Paste a URL instead
    </button>
  </div>
  );
};

/* --- Step 2: Project name --- */
const MobOBName = ({ name, setName, repo }) => (
  <div>
    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4, letterSpacing: "-0.01em" }}>
      Name this project
    </div>
    <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 20, lineHeight: 1.45 }}>
      Shown on Control Tower. Use a short handle — usually the repo name is fine.
    </div>

    <div className="eyebrow" style={{ marginBottom: 6 }}>Project name</div>
    <input
      value={name}
      onChange={e => setName(e.target.value)}
      style={{
        width: "100%", padding: "12px 14px", background: "var(--bg-1)",
        border: "1px solid var(--line)", borderRadius: 10, color: "var(--fg-0)",
        fontSize: 15, outline: "none", marginBottom: 14,
      }}
    />

    <div className="card" style={{ padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
      <Icon name="git" size={14} style={{ color: "var(--fg-3)", flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--fg-3)" }}>From repo</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo}</div>
      </div>
    </div>

    <div className="eyebrow" style={{ marginBottom: 6 }}>Tags <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>· optional</span></div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {["frontend", "ui-kit", "client"].map(t => (
        <span key={t} className="chip" style={{ fontSize: 11 }}>{t}</span>
      ))}
      <button className="chip" style={{ fontSize: 11, color: "var(--fg-3)", borderStyle: "dashed" }}>+ Add</button>
    </div>
  </div>
);

/* --- Step 3: Vision --- */
const MOB_VISION_PROMPTS = [
  "What problem is this codebase solving?",
  "Who is it for?",
  "What's true today vs. where it should go?",
];

const MobOBVision = ({ vision, setVision }) => (
  <div>
    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4, letterSpacing: "-0.01em" }}>
      Set the vision
    </div>
    <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 14, lineHeight: 1.45 }}>
      The agent reads this before every session. A few sentences is enough.
    </div>

    <textarea
      value={vision}
      onChange={e => setVision(e.target.value)}
      placeholder="A web-based composer for music producers. Mobile-first, real-time collaborative, with a sound bank that learns from each session…"
      rows={6}
      style={{
        width: "100%", padding: 14, background: "var(--bg-1)",
        border: "1px solid var(--line)", borderRadius: 10, color: "var(--fg-0)",
        fontSize: 13, outline: "none", marginBottom: 6, resize: "none", fontFamily: "inherit", lineHeight: 1.5,
      }}
    />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 11, color: "var(--fg-3)" }}>
      <Icon name="bolt" size={11} style={{ color: "var(--amber)" }} />
      <span>Saved to <span className="mono" style={{ color: "var(--fg-2)" }}>.redeye/vision.md</span></span>
    </div>

    <div className="eyebrow" style={{ marginBottom: 8 }}>Prompts</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {MOB_VISION_PROMPTS.map(p => (
        <div key={p} className="card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--fg-1)" }}>
          <Icon name="bolt" size={11} style={{ color: "var(--amber)", flex: "none" }} />
          <span style={{ flex: 1 }}>{p}</span>
          <Icon name="arrowRight" size={11} style={{ color: "var(--fg-3)" }} />
        </div>
      ))}
    </div>
  </div>
);

/* --- Step 4: First task --- */
const MOB_TASK_TEMPLATES = [
  { icon: "wrench", label: "Refactor", body: "Refactor the X module to…" },
  { icon: "bug", label: "Fix bug", body: "When the user does X, Y happens — should be Z." },
  { icon: "spark", label: "New feature", body: "Add an X that does Y…" },
  { icon: "test", label: "Add tests", body: "Cover edge cases in the X module…" },
];

const MobOBTask = ({ task, setTask }) => (
  <div>
    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4, letterSpacing: "-0.01em" }}>
      First task
    </div>
    <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 14, lineHeight: 1.45 }}>
      What should the agent do first? You can keep it small — onboarding tasks help calibrate the model.
    </div>

    <textarea
      value={task}
      onChange={e => setTask(e.target.value)}
      placeholder="Add a `prefers-reduced-motion` check to the splash animation and skip the keyframes when set."
      rows={5}
      style={{
        width: "100%", padding: 14, background: "var(--bg-1)",
        border: "1px solid var(--line)", borderRadius: 10, color: "var(--fg-0)",
        fontSize: 13, outline: "none", marginBottom: 18, resize: "none", fontFamily: "inherit", lineHeight: 1.5,
      }}
    />

    <div className="eyebrow" style={{ marginBottom: 8 }}>Or start from a template</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {MOB_TASK_TEMPLATES.map(t => (
        <button
          key={t.label}
          onClick={() => setTask(t.body)}
          className="card"
          style={{ padding: 12, textAlign: "left", background: "var(--bg-1)" }}
        >
          <Icon name={t.icon} size={14} style={{ color: "var(--fg-2)", marginBottom: 6 }} />
          <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500 }}>{t.label}</div>
          <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.body}</div>
        </button>
      ))}
    </div>
  </div>
);

/* --- Step 5: Deploy --- */
const MOB_DEPLOY_MODES = [
  { key: "commands", label: "Commands", icon: "terminal" },
  { key: "vercel", label: "Vercel", icon: "cloud" },
  { key: "off", label: "Off", icon: "x" },
];

const MOB_DEPLOY_CMDS = [
  { stage: "Build", cmd: "pnpm install && pnpm build" },
  { stage: "Test", cmd: "pnpm test --run" },
  { stage: "Deploy", cmd: "pnpm deploy:staging" },
];

const MobOBDeploy = () => {
  const [mode, setMode] = useMobileState("commands");
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4, letterSpacing: "-0.01em" }}>
        How should we ship?
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 16, lineHeight: 1.45 }}>
        After a session passes review, Redeye runs your deploy. Skip if you just want code review.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 18, padding: 4, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10 }}>
        {MOB_DEPLOY_MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: "10px 8px", borderRadius: 7,
              background: mode === m.key ? "var(--bg-2)" : "transparent",
              border: mode === m.key ? "1px solid var(--line-strong)" : "1px solid transparent",
              color: mode === m.key ? "var(--fg-0)" : "var(--fg-2)",
              fontSize: 12, fontWeight: 500,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}
          >
            <Icon name={m.icon} size={14} />
            {m.label}
          </button>
        ))}
      </div>

      {mode === "commands" && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Pipeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOB_DEPLOY_CMDS.map(c => (
              <div key={c.stage} className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 10, color: "var(--fg-3)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em" }}>{c.stage.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cmd}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: "var(--fg-3)", lineHeight: 1.45 }}>
            <Icon name="bolt" size={11} style={{ color: "var(--amber)", flex: "none" }} />
            <span>Runs after tests pass and review approves. Stops on non-zero exit.</span>
          </div>
        </div>
      )}

      {mode === "vercel" && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Icon name="cloud" size={14} style={{ color: "var(--fg-2)" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-0)" }}>Vercel</span>
            <span className="chip mint" style={{ marginLeft: "auto", fontSize: 10 }}>Linked</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>
            Pushing to <span className="mono" style={{ color: "var(--fg-0)" }}>main</span> triggers a Vercel preview, then production after approval.
          </div>
        </div>
      )}

      {mode === "off" && (
        <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
          <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.55 }}>
            Sessions will stop after review. You can ship manually whenever you're ready.
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Step 6: Initialize / done --- */
const MobOBInit = ({ name }) => (
  <div>
    <div style={{
      width: 56, height: 56, borderRadius: 14, margin: "8px auto 16px",
      background: "var(--mint-tint)", display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--mint)", border: "1px solid var(--mint-tint-strong)",
    }}>
      <Icon name="check" size={26} />
    </div>
    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)", textAlign: "center", marginBottom: 6, letterSpacing: "-0.01em" }}>
      Ready to roll
    </div>
    <div style={{ fontSize: 12, color: "var(--fg-2)", textAlign: "center", marginBottom: 22, lineHeight: 1.5, padding: "0 8px" }}>
      <span className="mono" style={{ color: "var(--fg-0)" }}>{name}</span> is initialized. The first session will start when you tap <b style={{ color: "var(--fg-0)" }}>Start session</b>.
    </div>

    <div className="eyebrow" style={{ marginBottom: 8 }}>What happens next</div>
    <div className="card" style={{ marginBottom: 12 }}>
      {[
        { i: "1", label: "Clone repo to local worktree", done: true },
        { i: "2", label: "Index codebase + run linters", done: true },
        { i: "3", label: "Read vision + first task", done: true },
        { i: "4", label: "Plan → Execute → Review → Ship", done: false },
      ].map((s, idx, arr) => (
        <div key={s.i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          borderBottom: idx < arr.length - 1 ? "1px solid var(--line)" : "none",
        }}>
          {s.done ? (
            <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--mint-tint)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--mint-tint-strong)" }}>
              <Icon name="check" size={11} />
            </span>
          ) : (
            <span className="mono" style={{ width: 18, height: 18, borderRadius: 999, background: "var(--bg-2)", color: "var(--fg-3)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--line)" }}>
              {s.i}
            </span>
          )}
          <span style={{ fontSize: 13, color: s.done ? "var(--fg-2)" : "var(--fg-0)", flex: 1 }}>{s.label}</span>
        </div>
      ))}
    </div>

    <div style={{ fontSize: 11, color: "var(--fg-3)", textAlign: "center", lineHeight: 1.55 }}>
      You can change schedule, deploy, and steering directives any time from project settings.
    </div>
  </div>
);

/* ============================================================
   2. MOBILE ADD PROJECT — quick form
   ============================================================ */
const MobileAddProject = ({ onClose, onLaunchOnboarding, initialized = true }) => {
  const [path, setPath] = useMobileState("~/code/composer-ui");
  const detected = initialized;
  return (
    <MobileSheet
      title="Add project"
      onClose={onClose}
      trailing={detected ? (
        <button className="btn primary sm" onClick={onClose} style={{ fontSize: 12 }}>Add</button>
      ) : null}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "20px 18px 24px" }} className="scrollbar">
        <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 18, lineHeight: 1.5 }}>
          Point Control Tower at a local repo. If it has a <span className="mono" style={{ color: "var(--fg-1)" }}>.redeye/</span> folder we'll just register it. Otherwise we'll run onboarding.
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>Local path</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            className="mono"
            style={{
              flex: 1, padding: "12px 14px", background: "var(--bg-1)",
              border: "1px solid var(--line)", borderRadius: 10, color: "var(--fg-0)",
              fontSize: 12, outline: "none",
            }}
          />
          <button className="btn" style={{ flex: "none", padding: "0 12px" }}>
            <Icon name="folder" size={13} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mint)", marginBottom: 18 }}>
          <Icon name="check" size={11} />
          <span>Git repo · 142 commits · main</span>
        </div>

        {detected ? (
          <div className="card" style={{ padding: 14, background: "var(--mint-tint)", borderColor: "var(--mint-tint-strong)", display: "flex", gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-0)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--mint-tint-strong)" }}>
              <Icon name="check" size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
                <span className="mono">.redeye/</span> found
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
                Already initialized. Vision and steering will be reused. Tap Add to register.
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onLaunchOnboarding || onClose}
            className="card"
            style={{
              width: "100%", padding: 14, background: "var(--amber-tint)",
              borderColor: "var(--amber-tint-strong, var(--amber))",
              textAlign: "left", display: "flex", gap: 10, alignItems: "center",
            }}
          >
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-0)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--amber-tint-strong, var(--amber))" }}>
              <Icon name="spark" size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
                Needs onboarding
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
                No <span className="mono" style={{ color: "var(--fg-1)" }}>.redeye/</span> yet. 6 quick steps to set vision, first task, and deploy.
              </div>
            </div>
            <Icon name="arrowRight" size={13} style={{ color: "var(--fg-3)", flex: "none" }} />
          </button>
        )}
      </div>

      {!detected && (
        <div style={{ padding: "12px 18px 22px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, background: "var(--bg-1)" }}>
          <button className="btn lg" style={{ flex: "0 0 auto", padding: "0 14px" }} onClick={onClose}>Cancel</button>
          <button className="btn primary lg" style={{ flex: 1 }} onClick={onLaunchOnboarding || onClose}>
            Start onboarding <Icon name="arrowRight" size={13} />
          </button>
        </div>
      )}
    </MobileSheet>
  );
};
window.MobileAddProject = MobileAddProject;

/* ============================================================
   3. MOBILE ANSWER QUESTION
   ============================================================ */
const MobileAnswerQuestion = ({ onClose, q }) => {
  const question = q || window.QUESTIONS[0];
  const [draft, setDraft] = useMobileState("Use exponential backoff — 3 retries, base 500ms, jitter ±20%. Surface a structured RetryExhausted error after that so callers can decide.");
  const [picked, setPicked] = useMobileState("retry");

  const choices = [
    { key: "retry", label: "Retry with backoff", body: "3 attempts · exponential · then bubble up", recommended: true },
    { key: "fail", label: "Fail fast", body: "Throw immediately; let the queue retry" },
    { key: "circuit", label: "Circuit breaker", body: "Trip after N failures; cool down 30s" },
  ];

  return (
    <MobileSheet
      title={question.id}
      subtitle={`${question.project} · ${question.age} ago`}
      onClose={onClose}
      trailing={<button className="btn ghost sm" style={{ color: "var(--fg-3)", fontSize: 11 }}>Skip</button>}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "16px 18px 12px" }} className="scrollbar">
        <div style={{ fontSize: 17, color: "var(--fg-0)", fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 8 }}>
          {question.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.55, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          {question.context}
        </div>

        {/* Where it came up */}
        <div className="eyebrow" style={{ marginBottom: 6 }}>Where it came up</div>
        <div className="card" style={{ padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="task" size={13} style={{ color: "var(--fg-3)", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--mint)" }}>{question.task}</div>
            <div style={{ fontSize: 12, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Harden upstream calls — add retry/timeout policy</div>
          </div>
          <Icon name="arrowRight" size={12} style={{ color: "var(--fg-3)" }} />
        </div>

        {/* Choices */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Suggested directions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {choices.map(c => {
            const active = picked === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setPicked(c.key)}
                className="card"
                style={{
                  padding: 12, textAlign: "left",
                  borderColor: active ? "var(--mint)" : "var(--line)",
                  background: active ? "var(--mint-tint)" : "var(--bg-1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 999, flex: "none",
                    border: active ? "5px solid var(--mint)" : "1.5px solid var(--line-strong)",
                    background: active ? "var(--bg-0)" : "transparent",
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-0)" }}>{c.label}</span>
                  {c.recommended && <span className="chip mint" style={{ marginLeft: "auto", fontSize: 9 }}>Suggested</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-2)", paddingLeft: 24, lineHeight: 1.45 }}>{c.body}</div>
              </button>
            );
          })}
        </div>

        {/* Refine */}
        <div className="eyebrow" style={{ marginBottom: 6 }}>Refine in your words</div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={5}
          style={{
            width: "100%", padding: 12, background: "var(--bg-1)",
            border: "1px solid var(--line)", borderRadius: 10, color: "var(--fg-0)",
            fontSize: 13, outline: "none", marginBottom: 8, resize: "none", fontFamily: "inherit", lineHeight: 1.5,
          }}
        />
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button className="btn ghost sm" style={{ flex: 1, fontSize: 11 }}><Icon name="spark" size={11} /> Use last answer</button>
          <button className="btn ghost sm" style={{ flex: 1, fontSize: 11 }}><Icon name="bolt" size={11} /> Suggest from code</button>
        </div>
      </div>

      <div style={{
        padding: "12px 18px 22px", borderTop: "1px solid var(--line)",
        display: "flex", gap: 8, background: "var(--bg-1)",
      }}>
        <button className="btn lg" style={{ flex: "0 0 auto", padding: "0 14px" }}>
          <Icon name="more" size={14} />
        </button>
        <button className="btn primary lg" style={{ flex: 1 }} onClick={onClose}>
          <Icon name="check" size={13} /> Send answer
        </button>
      </div>
    </MobileSheet>
  );
};
window.MobileAnswerQuestion = MobileAnswerQuestion;

/* ============================================================
   4. MOBILE SCHEDULE
   ============================================================ */
const MOB_SCHEDULE_PRESETS = [
  { key: "weekdays-9pm", label: "Weeknights · 9pm", cron: "0 21 * * 1-5" },
  { key: "daily-2am", label: "Every night · 2am", cron: "0 2 * * *" },
  { key: "weekends", label: "Weekends · 10am", cron: "0 10 * * 6,0" },
  { key: "custom", label: "Custom cron…", cron: null },
];

const MobileSchedule = ({ onClose, project }) => {
  const p = project || window.PROJECTS[0];
  const [enabled, setEnabled] = useMobileState(true);
  const [preset, setPreset] = useMobileState("weekdays-9pm");
  const [budget, setBudget] = useMobileState("10");
  const [maxRounds, setMaxRounds] = useMobileState("6");

  const cron = (MOB_SCHEDULE_PRESETS.find(s => s.key === preset) || {}).cron || "0 21 * * 1-5";

  return (
    <MobileSheet
      title="Schedule"
      subtitle={p.name}
      onClose={onClose}
      trailing={<button className="btn primary sm" onClick={onClose} style={{ fontSize: 12 }}>Save</button>}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "16px 18px 24px" }} className="scrollbar">
        {/* Master toggle */}
        <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 9, flex: "none",
            background: enabled ? "var(--red-tint)" : "var(--bg-2)",
            color: enabled ? "var(--red)" : "var(--fg-3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid " + (enabled ? "var(--red-tint-strong)" : "var(--line)"),
          }}>
            <Icon name="schedule" size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>Run on a schedule</div>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>{enabled ? "Will pick up the highest-priority backlog item" : "Sessions only run when you start them"}</div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{
              width: 44, height: 26, borderRadius: 99, flex: "none",
              background: enabled ? "var(--red)" : "var(--bg-2)",
              border: "1px solid " + (enabled ? "var(--red)" : "var(--line)"),
              position: "relative", transition: "all 0.15s",
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: enabled ? 20 : 2,
              width: 20, height: 20, borderRadius: 999,
              background: "var(--bg-0)", transition: "left 0.15s",
              boxShadow: "0 2px 4px oklch(0 0 0 / 0.3)",
            }} />
          </button>
        </div>

        {enabled && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>When</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {MOB_SCHEDULE_PRESETS.map(s => {
                const active = preset === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setPreset(s.key)}
                    className="card"
                    style={{
                      padding: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                      borderColor: active ? "var(--red)" : "var(--line)",
                      background: active ? "var(--red-tint)" : "var(--bg-1)",
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 999, flex: "none",
                      border: active ? "5px solid var(--red)" : "1.5px solid var(--line-strong)",
                      background: active ? "var(--bg-0)" : "transparent",
                    }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>{s.label}</span>
                    {s.cron && <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{s.cron}</span>}
                  </button>
                );
              })}
            </div>

            <div className="eyebrow" style={{ marginBottom: 8 }}>Guardrails</div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line)" }}>
                <Icon name="dollar" size={13} style={{ color: "var(--fg-3)", flex: "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--fg-1)" }}>Budget per run</div>
                  <div style={{ fontSize: 10, color: "var(--fg-3)" }}>Stops session at this spend</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fg-2)", fontSize: 13 }}>
                  <span>$</span>
                  <input
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="mono"
                    style={{ width: 50, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--fg-0)", fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "right" }}
                  />
                </div>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="loop" size={13} style={{ color: "var(--fg-3)", flex: "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--fg-1)" }}>Max rounds</div>
                  <div style={{ fontSize: 10, color: "var(--fg-3)" }}>Plan/Execute/Review iterations</div>
                </div>
                <input
                  value={maxRounds}
                  onChange={e => setMaxRounds(e.target.value)}
                  className="mono"
                  style={{ width: 50, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--fg-0)", fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "right" }}
                />
              </div>
            </div>

            <div className="card" style={{ padding: 12, background: "var(--red-tint)", borderColor: "var(--red-tint-strong)", display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="schedule" size={14} style={{ color: "var(--red)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500 }}>Next run · tonight 9:00 PM</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-2)", marginTop: 2 }}>{cron}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileSheet>
  );
};
window.MobileSchedule = MobileSchedule;

/* ============================================================
   5. MOBILE STEER
   ============================================================ */
const MOB_STEER_DIRECTIVES = [
  { id: 1, body: "Prefer composition over inheritance. Pull shared logic into hooks before classes.", added: "3d", active: true, hits: 14 },
  { id: 2, body: "When adding deps, check bundle size — flag anything over 30kb gzipped.", added: "1w", active: true, hits: 6 },
  { id: 3, body: "Tests must be deterministic. No real timers, no real network — use fixtures.", added: "2w", active: true, hits: 22 },
  { id: 4, body: "Don't introduce CSS-in-JS libraries. We use vanilla CSS + variables.", added: "1mo", active: false, hits: 3 },
];

const MobileSteer = ({ onClose }) => {
  const [draft, setDraft] = useMobileState("");
  const [tab, setTab] = useMobileState("active");
  const active = MOB_STEER_DIRECTIVES.filter(d => d.active);
  const archived = MOB_STEER_DIRECTIVES.filter(d => !d.active);
  const list = tab === "active" ? active : archived;

  return (
    <MobileSheet
      title="Steering"
      subtitle={`${active.length} active`}
      onClose={onClose}
    >
      {/* Add new */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, background: "var(--violet-tint)", color: "var(--violet)",
            display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            border: "1px solid var(--violet-tint-strong)",
          }}>
            <Icon name="steer" size={14} />
          </span>
          <div style={{ flex: 1 }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="A new rule the agent should follow…"
              rows={2}
              style={{
                width: "100%", padding: 10, background: "var(--bg-1)",
                border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg-0)",
                fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5,
              }}
            />
            {draft && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button className="btn primary sm" style={{ fontSize: 11 }}>
                  <Icon name="plus" size={11} /> Add directive
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "0 18px", borderBottom: "1px solid var(--line)", gap: 16 }}>
        {[
          { key: "active", label: "Active", count: active.length },
          { key: "archived", label: "Archived", count: archived.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 0", fontSize: 12, fontWeight: 500,
              color: tab === t.key ? "var(--fg-0)" : "var(--fg-3)",
              borderBottom: tab === t.key ? "2px solid var(--violet)" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.label}
            <span style={{ fontSize: 10, color: "var(--fg-3)" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px 24px" }} className="scrollbar">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(d => (
            <div key={d.id} className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: d.active ? "var(--fg-0)" : "var(--fg-3)", lineHeight: 1.5, marginBottom: 8 }}>
                {d.body}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "var(--fg-3)" }}>
                <span>Added {d.added} ago</span>
                <span>·</span>
                <span>{d.hits} hits</span>
                <div style={{ flex: 1 }} />
                <button className="btn ghost sm" style={{ fontSize: 10, padding: "0 8px", height: 22, color: "var(--fg-2)" }}>
                  {d.active ? "Archive" : "Restore"}
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--fg-3)", fontSize: 12 }}>
              Nothing here yet.
            </div>
          )}
        </div>
      </div>
    </MobileSheet>
  );
};
window.MobileSteer = MobileSteer;

/* ============================================================
   6. MOBILE LIVE — the "Live" tab destination
   ============================================================ */
const MOB_LIVE_EVENTS = [
  { t: "9:41:02", proj: "haze", kind: "edit", body: "src/upstream/retry.ts +24 −8" },
  { t: "9:40:51", proj: "haze", kind: "test", body: "retry.test.ts · 14 passed" },
  { t: "9:40:39", proj: "haze", kind: "think", body: "Considering circuit breaker for /v2/extract" },
  { t: "9:40:12", proj: "redeye", kind: "ship", body: "T146 — Cost forecasting · merged to main" },
  { t: "9:39:48", proj: "redeye", kind: "edit", body: "src/forecast/burn.ts +112 −0" },
  { t: "9:39:21", proj: "redeye", kind: "test", body: "burn.test.ts · 8 passed" },
  { t: "9:38:55", proj: "haze", kind: "think", body: "Reading README + CONTRIBUTING.md" },
  { t: "9:38:30", proj: "haze", kind: "ask", body: "Q-87 surfaced — retry policy" },
];

const KIND_META = {
  edit: { icon: "edit", color: "var(--mint)", tint: "var(--mint-tint)" },
  test: { icon: "check", color: "var(--mint)", tint: "var(--mint-tint)" },
  think: { icon: "spark", color: "var(--fg-3)", tint: "var(--bg-2)" },
  ship: { icon: "send", color: "var(--violet)", tint: "var(--violet-tint)" },
  ask: { icon: "inbox", color: "var(--amber)", tint: "var(--amber-tint)" },
};

const MobileLive = ({ onTab, tab }) => {
  const projects = window.PROJECTS.filter(p => p.running);
  return (
    <MobileShell tab={tab || "live"} onTab={onTab} unread={1}>
      <div style={{ padding: "8px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Right now</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.02em" }}>Live</h1>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--mint-tint)", color: "var(--mint)", borderRadius: 999, fontSize: 11, fontWeight: 600, border: "1px solid var(--mint-tint-strong)" }}>
            <span className="dot mint dot-pulse" />
            {projects.length} running
          </span>
        </div>
      </div>

      {/* Running pills */}
      <div style={{ padding: "0 18px 12px", display: "flex", gap: 6, overflowX: "auto" }} className="scrollbar">
        {projects.map(p => (
          <button key={p.id} className="card" style={{
            padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flex: "none",
            background: "var(--bg-1)",
          }}>
            <span className="dot mint dot-pulse" />
            <span style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500 }}>{p.name}</span>
            <span className="chip mint" style={{ fontSize: 9, height: 16 }}>{p.phase.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* Stream */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 18px 24px" }} className="scrollbar">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Activity stream</div>
        <div style={{ position: "relative", paddingLeft: 22 }}>
          {/* Spine */}
          <div style={{ position: "absolute", left: 11, top: 6, bottom: 6, width: 1, background: "var(--line)" }} />
          {MOB_LIVE_EVENTS.map((e, i) => {
            const m = KIND_META[e.kind];
            return (
              <div key={i} style={{ position: "relative", paddingBottom: 14 }}>
                <span style={{
                  position: "absolute", left: -22, top: 0,
                  width: 22, height: 22, borderRadius: 999,
                  background: m.tint, color: m.color, border: "1px solid var(--bg-0)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name={m.icon} size={11} />
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, fontSize: 10, color: "var(--fg-3)" }}>
                  <span className="mono">{e.t}</span>
                  <span>·</span>
                  <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>{e.proj}</span>
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.45 }}>
                  {e.body}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MobileShell>
  );
};
window.MobileLive = MobileLive;
