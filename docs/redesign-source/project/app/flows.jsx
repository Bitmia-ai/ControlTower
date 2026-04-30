/* Modal flows: Add Project (quick + onboarding wizard) and Answer Question */

const { useState: useFlowState } = React;

/* ===== Modal shell ===== */
const ModalShell = ({ width = 560, children, onClose, label }) => (
  <div style={{
    position: "absolute", inset: 0, background: "oklch(0 0 0 / 0.55)",
    backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 50,
  }}>
    <div className="card" style={{
      width, maxWidth: "90%", maxHeight: "90%", overflow: "hidden", display: "flex", flexDirection: "column",
      boxShadow: "0 24px 60px oklch(0 0 0 / 0.5)", marginBottom: 0,
    }} role="dialog" aria-label={label}>
      {children}
    </div>
  </div>
);
window.ModalShell = ModalShell;

/* ===== Quick Add Project modal ===== */
const AddProjectModal = ({ onClose, initialized = true, onLaunchOnboarding }) => {
  const [path, setPath] = useFlowState("~/code/composer-ui");
  const detected = initialized;
  return (
    <ModalShell width={520} label="Add project">
      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>
            Add project
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--fg-2)" }}>
            Point Control Tower at a local repo.
          </p>
        </div>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>

      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="eyebrow" htmlFor="ap-path">Path</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="ap-path" className="mono" value={path} onChange={e => setPath(e.target.value)} placeholder="~/code/my-app" style={{ height: 36, flex: 1 }} />
            <button className="btn" style={{ flex: "none" }}><Icon name="folder" size={13} /> Browse</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mint)" }}>
            <Icon name="check" size={11} />
            <span>Git repo · 142 commits · main</span>
          </div>
        </div>

        {detected ? (
          /* Already initialized — fast path */
          <div style={{ padding: 14, border: "1px solid var(--mint-tint-strong)", background: "var(--mint-tint)", borderRadius: 10, display: "flex", gap: 12 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-0)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--mint-tint-strong)" }}>
              <Icon name="check" size={15} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
                <span className="mono">.redeye/</span> found — already initialized
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
                Vision, steering directives, and deploy config will be reused. We'll register the project and you can start a session right away.
              </div>
            </div>
          </div>
        ) : (
          /* Not initialized — needs onboarding */
          <div style={{ padding: 14, border: "1px solid var(--amber-tint-strong, var(--amber))", background: "var(--amber-tint)", borderRadius: 10, display: "flex", gap: 12 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-0)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--amber-tint-strong, var(--amber))" }}>
              <Icon name="spark" size={15} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
                No <span className="mono">.redeye/</span> folder yet — needs onboarding
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
                We'll walk you through 6 quick steps to set vision, first task, and deploy config — then write everything to <span className="mono" style={{ color: "var(--fg-1)" }}>.redeye/</span> so you never have to do it again.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", background: "var(--bg-0)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <button className="btn sm ghost" onClick={onClose}>Cancel</button>
        {detected ? (
          <button className="btn sm primary" onClick={onClose}>
            <Icon name="plus" size={12} /> Register project
          </button>
        ) : (
          <button className="btn sm primary" onClick={onLaunchOnboarding || onClose}>
            Start onboarding <Icon name="arrowRight" size={12} />
          </button>
        )}
      </div>
    </ModalShell>
  );
};
window.AddProjectModal = AddProjectModal;

/* ===== Onboarding wizard (first-run, zero projects) ===== */
const StepDots = ({ current, total = 4 }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 22 }}>
    {Array.from({ length: total }, (_, i) => i + 1).map(n => {
      const active = n === current;
      const done = n < current;
      return (
        <div key={n} style={{
          width: active ? 22 : 6, height: 6, borderRadius: 999,
          background: active ? "var(--red)" : done ? "var(--red-tint-strong)" : "var(--line)",
          transition: "all .2s",
        }} />
      );
    })}
  </div>
);

/* ===== Onboarding wizard — local-first, mirrors /redeye:init ===== */
const OB_STEPS = [
  { key: "pick",   label: "Pick repo",       icon: "folder" },
  { key: "name",   label: "Project name",    icon: "text" },
  { key: "vision", label: "Vision",          icon: "steer" },
  { key: "task",   label: "First task",      icon: "play" },
  { key: "deploy", label: "Deploy",          icon: "rocket" },
  { key: "init",   label: "Initialize",      icon: "check" },
];

const OnboardingWizard = ({ onClose, step: stepProp = 1 }) => {
  // 1-indexed step prop maps to OB_STEPS[step-1]
  const stepIdx = Math.max(1, Math.min(OB_STEPS.length, stepProp)) - 1;
  const stepKey = OB_STEPS[stepIdx].key;
  return (
    <ModalShell width={760} label="Onboarding">
      {/* Header strip with stepper */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--mint-tint)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="rocket" size={14} />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>Set up your first project</div>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 1 }}>
              We'll dispatch <span className="mono" style={{ color: "var(--fg-2)" }}>/redeye:init</span> with your answers — no terminal needed.
            </div>
          </div>
        </div>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>

      {/* Stepper */}
      <div style={{ padding: "12px 22px", background: "var(--bg-0)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        {OB_STEPS.map((s, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <React.Fragment key={s.key}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 999,
                background: active ? "var(--mint-tint)" : "transparent",
                color: active ? "var(--mint)" : done ? "var(--fg-1)" : "var(--fg-3)",
                fontSize: 11, fontWeight: active ? 600 : 500,
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 999,
                  background: done ? "var(--mint)" : active ? "var(--mint)" : "var(--bg-2)",
                  color: done || active ? "var(--bg-0)" : "var(--fg-3)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                }}>{done ? <Icon name="check" size={9} strokeWidth={3} /> : i + 1}</span>
                <span>{s.label}</span>
              </div>
              {i < OB_STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: "var(--line)" }} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "22px 28px", minHeight: 360 }}>
        {stepKey === "pick"   && <OBStepPick />}
        {stepKey === "name"   && <OBStepName />}
        {stepKey === "vision" && <OBStepVision />}
        {stepKey === "task"   && <OBStepTask />}
        {stepKey === "deploy" && <OBStepDeploy />}
        {stepKey === "init"   && <OBStepInit />}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--line)", background: "var(--bg-0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
          Step {stepIdx + 1} of {OB_STEPS.length}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {stepIdx > 0 && <button className="btn sm ghost"><Icon name="arrowLeft" size={11} /> Back</button>}
          {stepIdx < OB_STEPS.length - 1 ? (
            <button className="btn sm primary">Continue <Icon name="arrowRight" size={11} /></button>
          ) : (
            <button className="btn sm primary"><Icon name="check" size={11} /> Finish & open project</button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

/* ===== Step 1 — Pick a local repo (desktop helper) ===== */
const OBStepPick = () => {
  const recent = [
    { path: "~/code/control-tower",     branch: "main",   commits: 142, lang: "TypeScript", picked: true,  redeye: false },
    { path: "~/code/api-gateway",       branch: "main",   commits: 87,  lang: "Go",         picked: false, redeye: true  },
    { path: "~/work/ledger-svc",        branch: "develop", commits: 311, lang: "Rust",       picked: false, redeye: false },
    { path: "~/sandbox/llm-router",     branch: "main",   commits: 28,  lang: "Python",     picked: false, redeye: true  },
  ];
  const pickedRepo = recent.find(r => r.picked);
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>Pick a local repository</h2>
      <p style={{ margin: "4px 0 18px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
        ControlTower runs locally on your machine. Choose a folder containing a <span className="mono">.git/</span> directory — RedEye will use git for safe checkpoints.
      </p>

      {pickedRepo?.redeye && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: 14, marginBottom: 14,
          border: "1px solid var(--mint-tint-strong)", background: "var(--mint-tint)", borderRadius: 10,
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-0)", color: "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "1px solid var(--mint-tint-strong)" }}>
            <Icon name="check" size={15} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
              <span className="mono">.redeye/</span> already exists in this repo
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
              Vision, steering, and deploy config will be reused. Skip the rest of onboarding and register the project directly.
            </div>
          </div>
          <button className="btn primary sm" style={{ flex: "none" }}>
            <Icon name="check" size={11} /> Register & skip
          </button>
        </div>
      )}

      <button className="btn full" style={{ height: 44, justifyContent: "center", marginBottom: 14 }}>
        <Icon name="folder" size={14} /> Choose folder…
      </button>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Recent · detected by desktop helper</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recent.map((r, i) => (
          <button key={i} style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
            padding: "10px 12px", borderRadius: 8, textAlign: "left",
            background: r.picked ? "var(--mint-tint)" : "var(--bg-0)",
            border: `1px solid ${r.picked ? "var(--mint)" : "var(--line)"}`, cursor: "pointer",
          }}>
            <Icon name="folder" size={14} style={{ color: "var(--fg-2)" }} />
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.path}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{r.lang} · {r.commits} commits · {r.branch}</span>
                {r.redeye && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--mint)", fontWeight: 500 }}>
                    · <Icon name="check" size={9} /> initialized
                  </span>
                )}
              </div>
            </div>
            <span className="chip" style={{ background: "var(--bg-2)", border: "none", fontSize: 10 }}>{r.lang}</span>
            {r.picked && <Icon name="check" size={13} style={{ color: "var(--mint)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
};
/* ===== Step 2 — Project name (init Q1) ===== */
const OBStepName = () => (
  <div style={{ maxWidth: 540, margin: "0 auto" }}>
    <div className="eyebrow" style={{ marginBottom: 6, color: "var(--fg-3)" }}>Init question 1 of 4</div>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>Project name</h2>
    <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
      How RedEye refers to this project in plans, commits, and the dashboard. Defaults to your folder name.
    </p>
    <input
      defaultValue="control-tower"
      autoFocus
      style={{
        width: "100%", height: 44, padding: "0 14px", borderRadius: 8,
        background: "var(--bg-0)", border: "1px solid var(--line-strong)",
        color: "var(--fg-0)", fontSize: 16, fontWeight: 500, fontFamily: "inherit",
      }}
    />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--fg-3)" }}>
      <span>Use kebab-case. Letters, numbers, dashes only.</span>
      <span><Icon name="check" size={11} style={{ color: "var(--mint)" }} /> Available</span>
    </div>
  </div>
);

/* ===== Step 3 — Vision (init Q2) ===== */
const OBStepVision = () => (
  <div style={{ maxWidth: 580, margin: "0 auto" }}>
    <div className="eyebrow" style={{ marginBottom: 6, color: "var(--fg-3)" }}>Init question 2 of 4</div>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>Project vision</h2>
    <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
      What is this project, who is it for, and what does success look like? RedEye reads this on every session — the more grounded, the better its plans.
    </p>
    <textarea
      defaultValue={"ControlTower is a local web dashboard that orchestrates RedEye sessions across many repos. It runs on the developer's machine via a desktop helper and dispatches Claude Code commands so the user never touches a terminal.\n\nSuccess: a solo developer can register a repo, walk through onboarding, and have RedEye land its first PR within 10 minutes — without opening a shell."}
      rows={7}
      style={{
        width: "100%", padding: "12px 14px", borderRadius: 8,
        background: "var(--bg-0)", border: "1px solid var(--line-strong)",
        color: "var(--fg-0)", fontSize: 13, lineHeight: 1.6, resize: "vertical", fontFamily: "inherit",
      }}
    />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--fg-3)" }}>
      <Icon name="bolt" size={11} style={{ color: "var(--amber)" }} />
      <span>Saved to <span className="mono" style={{ color: "var(--fg-2)" }}>.redeye/vision.md</span> · editable any time from project Settings</span>
    </div>
  </div>
);

/* ===== Step 4 — First task (init Q3) ===== */
const OBStepTask = () => {
  const suggestions = [
    "Wire up GitHub OAuth so users can sign in with their GitHub account.",
    "Add a /healthz endpoint that returns build SHA + uptime.",
    "Migrate the user table from JSON file storage to SQLite.",
  ];
  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 6, color: "var(--fg-3)" }}>Init question 3 of 4</div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>First task</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
        Give RedEye one concrete thing to build. Small, end-to-end, testable. You can add more later from Tasks.
      </p>
      <textarea
        defaultValue="Add a settings page where users can edit their project vision and steering directives in a textarea, with autosave and a 'Reset to default' button."
        rows={4}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 8,
          background: "var(--bg-0)", border: "1px solid var(--line-strong)",
          color: "var(--fg-0)", fontSize: 13, lineHeight: 1.55, resize: "vertical", fontFamily: "inherit",
        }}
      />
      <div className="eyebrow" style={{ marginTop: 14, marginBottom: 8 }}>Or pick a starter</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {suggestions.map((s, i) => (
          <button key={i} style={{
            display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            padding: "10px 12px", background: "var(--bg-0)", border: "1px solid var(--line)",
            borderRadius: 8, color: "var(--fg-1)", fontSize: 12, cursor: "pointer",
          }}>
            <Icon name="bolt" size={11} style={{ color: "var(--amber)", flex: "none" }} />
            <span style={{ flex: 1 }}>{s}</span>
            <Icon name="arrowRight" size={11} style={{ color: "var(--fg-3)" }} />
          </button>
        ))}
      </div>
    </div>
  );
};

/* ===== Step 5 — Deploy instructions (init Q4) ===== */
const OBStepDeploy = () => {
  const [mode, setMode] = useFlowState("commands");
  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 6, color: "var(--fg-3)" }}>Init question 4 of 4 · optional</div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>Deploy instructions</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
        How does this project get to production? Skip if it doesn't deploy yet — RedEye will only test locally.
      </p>

      {/* Mode switcher */}
      <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12, width: "fit-content" }}>
        {[
          { k: "none",     label: "No deploy" },
          { k: "commands", label: "Commands" },
          { k: "notes",    label: "Free-form notes" },
        ].map(o => (
          <button key={o.k} onClick={() => setMode(o.k)} style={{
            padding: "5px 12px", borderRadius: 5, fontSize: 12,
            background: mode === o.k ? "var(--bg-2)" : "transparent",
            color: mode === o.k ? "var(--fg-0)" : "var(--fg-2)",
            fontWeight: mode === o.k ? 600 : 500, cursor: "pointer",
          }}>{o.label}</button>
        ))}
      </div>

      {mode === "none" && (
        <div style={{ padding: "16px 14px", background: "var(--bg-0)", border: "1px dashed var(--line)", borderRadius: 8, fontSize: 13, color: "var(--fg-2)", textAlign: "center" }}>
          RedEye will skip the deploy step on each task.
        </div>
      )}

      {mode === "commands" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Build",  value: "pnpm build",                    det: true },
            { label: "Deploy", value: "vercel deploy --prod",          det: false },
            { label: "Verify", value: "curl -fsS https://example.com/healthz", det: false },
          ].map(c => (
            <div key={c.label} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 10, alignItems: "center" }}>
              <label className="eyebrow" style={{ color: "var(--fg-2)" }}>{c.label}</label>
              <input className="mono" defaultValue={c.value} style={{ height: 34, fontSize: 12 }} />
              <span style={{ fontSize: 10, color: c.det ? "var(--mint)" : "var(--fg-3)" }}>
                {c.det ? "detected" : "manual"}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11, color: "var(--fg-3)" }}>
            <Icon name="bolt" size={11} style={{ color: "var(--amber)" }} />
            <span>Runs after tests pass and review approves. Stops on non-zero exit.</span>
          </div>
        </div>
      )}

      {mode === "notes" && (
        <textarea
          defaultValue={"After tests pass on main, GitHub Actions builds a Docker image and pushes to fly.io. The deploy is gated on the integration tests in /test/e2e — flag those failures as blockers."}
          rows={6}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 8,
            background: "var(--bg-0)", border: "1px solid var(--line-strong)",
            color: "var(--fg-0)", fontSize: 13, lineHeight: 1.55, resize: "vertical", fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
};

/* ===== Step 6 — Initialize (live terminal preview) ===== */
const OBStepInit = () => {
  const lines = [
    { t: "$ /redeye:init",                                 c: "var(--fg-3)", mono: true },
    { t: "✓ Validated git repo (~/code/control-tower)",   c: "var(--mint)" },
    { t: "✓ Wrote .redeye/project.md",                    c: "var(--mint)" },
    { t: "✓ Wrote .redeye/build.json",                    c: "var(--mint)" },
    { t: "✓ Wrote .redeye/branch.json",                   c: "var(--mint)" },
    { t: "✓ Scheduled: Weekdays · 9pm (cron 0 21 * * 1-5)", c: "var(--mint)" },
    { t: "→ Spawning Claude Code session…",               c: "var(--sky)" },
    { t: "✓ Plan generated · 3 tasks queued",             c: "var(--mint)" },
    { t: "✓ Done in 4.2s",                                c: "var(--fg-0)" },
  ];
  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>Initializing RedEye…</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
        ControlTower is dispatching <span className="mono" style={{ color: "var(--fg-1)" }}>/redeye:init</span> through Claude Code with your answers. This is the only place a terminal command runs — and you don't have to touch it.
      </p>
      <div style={{
        background: "#0b0b0e", border: "1px solid var(--line)", borderRadius: 10,
        padding: "14px 16px", fontFamily: "var(--mono, ui-monospace, monospace)", fontSize: 12, lineHeight: 1.7,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ff5f57" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#febc2e" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#28c840" }} />
          <span style={{ marginLeft: 8, fontSize: 10, color: "rgba(255,255,255,0.5)" }}>claude-code · ~/code/control-tower</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.c, fontFamily: l.mono ? "inherit" : "inherit" }}>{l.t}</div>
        ))}
        <div style={{ marginTop: 6, color: "var(--mint)" }}>$ <span style={{ animation: "blink 1s steps(1) infinite" }}>▎</span></div>
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--mint-tint)", border: "1px solid var(--mint)", borderRadius: 8 }}>
        <Icon name="check" size={14} style={{ color: "var(--mint)" }} strokeWidth={3} />
        <span style={{ fontSize: 12, color: "var(--fg-1)" }}>
          <strong style={{ color: "var(--fg-0)" }}>control-tower</strong> is registered and the loop is armed. Click <strong style={{ color: "var(--fg-0)" }}>Finish</strong> to open the project.
        </span>
      </div>
    </div>
  );
};

window.OnboardingWizard = OnboardingWizard;

/* ===== Answer Question modal ===== */
const AnswerQuestionModal = ({ onClose, q }) => {
  const question = q || window.QUESTIONS[0];
  const [draft, setDraft] = useFlowState("Use exponential backoff — 3 retries, base 500ms, jitter ±20%. Surface a structured RetryExhausted error after that so callers can decide. Don't fail fast: these endpoints recover within 2-3s under load.");
  const [picked, setPicked] = useFlowState("retry");

  const choices = [
    { key: "retry", label: "Retry with backoff", body: "Exponential, 3 attempts, ±20% jitter." },
    { key: "fail", label: "Fail fast", body: "Surface 503 to caller immediately." },
    { key: "queue", label: "Queue & retry async", body: "Enqueue and reply 202 — heavier change." },
  ];

  return (
    <ModalShell width={680} label="Answer question">
      {/* Header */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "var(--amber-tint)",
            color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="q" size={15} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{question.id}</span>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{question.project}</span>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{question.task}</span>
              <span className="chip amber" style={{ fontSize: 10, height: 18 }}>open · {question.age}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>1 of 3 in your inbox</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn ghost icon" title="Previous" disabled style={{ opacity: 0.4 }}><Icon name="chevUp" size={14} /></button>
          <button className="btn ghost icon" title="Next"><Icon name="chevDown" size={14} /></button>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "1fr 240px", minHeight: 0 }}>
        <div style={{ padding: "20px 22px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Question */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Agent asks</div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.015em", lineHeight: 1.35 }}>
              {question.title}
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--fg-1)", lineHeight: 1.55 }}>
              {question.context}
            </p>
          </div>

          {/* Context block — code/file ref */}
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-1)" }}>
              <Icon name="code" size={12} style={{ color: "var(--fg-2)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-1)" }}>lib/upstream/client.ts</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>· lines 84–96</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="btn ghost icon sm" title="Open in editor"><Icon name="arrow" size={11} /></button>
              </span>
            </div>
            <pre className="mono" style={{
              margin: 0, padding: "10px 14px", fontSize: 12, color: "var(--fg-1)", lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
{`async fetchUpstream(url: string) {
  const res = await fetch(url);
  if (res.status === 503) {
    `}<span style={{ color: "var(--rose)" }}>throw new UpstreamUnavailable(url);</span>{`
  }
  return res.json();
}`}
            </pre>
          </div>

          {/* Choices */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Suggested directions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {choices.map(c => {
                const active = picked === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setPicked(c.key)}
                    style={{
                      display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start",
                      padding: "10px 12px", borderRadius: 8, textAlign: "left",
                      background: active ? "var(--mint-tint)" : "var(--bg-0)",
                      border: `1px solid ${active ? "var(--mint)" : "var(--line)"}`,
                      cursor: "pointer", color: "var(--fg-0)",
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 999, marginTop: 3,
                      border: `2px solid ${active ? "var(--mint)" : "var(--line-strong)"}`,
                      background: active ? "var(--mint)" : "transparent",
                      flex: "none",
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>{c.body}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free-form answer */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="eyebrow">Your answer</div>
              <span style={{ fontSize: 10, color: "var(--fg-3)" }}>Markdown supported · ⌘↵ to send</span>
            </div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "var(--bg-0)", border: "1px solid var(--line-strong)",
                color: "var(--fg-0)", fontSize: 13, lineHeight: 1.5, resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="btn sm ghost"><Icon name="spark" size={11} /> Use my last answer</button>
              <button className="btn sm ghost"><Icon name="bolt" size={11} /> Suggest from code</button>
            </div>
          </div>
        </div>

        {/* Right rail — context */}
        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-0)", overflow: "auto" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Project</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot amber" />
              <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>haze</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 4 }}>~/code/haze</div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Task</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", marginBottom: 2 }}>{question.task} · P1</div>
            <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.4 }}>
              Smarter error messages for HTTP failures
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Phase</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot amber" />
              <span className="mono" style={{ fontSize: 11, color: "var(--amber)", textTransform: "uppercase", fontWeight: 600 }}>Triage</span>
              <span style={{ fontSize: 11, color: "var(--fg-3)" }}>· paused</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.4 }}>
              Resumes automatically once you answer.
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Asked</div>
            <div style={{ fontSize: 12, color: "var(--fg-1)" }}>{question.age} ago</div>
            <div style={{ fontSize: 11, color: "var(--fg-3)" }}>Apr 28 · 1:42 PM</div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Other open</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {window.QUESTIONS.slice(1).map(other => (
                <div key={other.id} style={{ padding: "8px 10px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{other.id} · {other.age}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-1)", marginTop: 2, lineHeight: 1.35 }}>
                    {other.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--line)", background: "var(--bg-0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm ghost"><Icon name="schedule" size={11} /> Snooze 1h</button>
          <button className="btn sm ghost" style={{ color: "var(--rose)" }}><Icon name="skip" size={11} /> Skip task</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Resumes triage</span>
          <button className="btn sm primary"><Icon name="arrow" size={11} /> Send answer</button>
        </div>
      </div>
    </ModalShell>
  );
};
window.AnswerQuestionModal = AnswerQuestionModal;

/* ===== Steer directives modal — view, edit, add, remove ===== */
const STEER_DIRECTIVES = [
  { id: "d1", body: "Prefer adding tests over fixing flaky ones — quarantine and file a follow-up task instead.", added: "Apr 21", source: "manual", active: true },
  { id: "d2", body: "Match existing code style in the file you're editing. Don't restructure modules unless the task asks.", added: "Apr 18", source: "manual", active: true },
  { id: "d3", body: "Stop asking about commit messages — use Conventional Commits, scope = module name.", added: "Apr 16", source: "manual", active: true },
  { id: "d4", body: "If a phase round count exceeds 6, pause and ask before continuing.", added: "Apr 12", source: "system", active: false },
];

const SteerModal = ({ onClose }) => {
  const [draft, setDraft] = useFlowState("");
  const active = STEER_DIRECTIVES.filter(d => d.active);
  const archived = STEER_DIRECTIVES.filter(d => !d.active);

  return (
    <ModalShell width={680} label="Steering directives">
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--violet-tint, var(--bg-2))", color: "var(--violet, var(--fg-1))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="steer" size={15} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>Steering directives</h2>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
              <span className="mono" style={{ color: "var(--fg-2)" }}>ControlTower</span> · {active.length} active · injected on every session
            </div>
          </div>
        </div>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* New directive */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Add directive</div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Tell the agent how to behave… e.g. 'Always run npm test before declaring a phase done.'"
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              background: "var(--bg-0)", border: "1px solid var(--line-strong)",
              color: "var(--fg-0)", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Saved to <span className="mono">.redeye/steering.md</span></span>
            <button className="btn sm primary" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.4 }}>
              <Icon name="plus" size={11} /> Add directive
            </button>
          </div>
        </div>

        {/* Active */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="eyebrow">Active · {active.length}</div>
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Newest first</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map(d => (
              <div key={d.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "start",
                padding: "10px 12px", background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 8,
              }}>
                <span style={{ width: 6, height: 6, marginTop: 8, borderRadius: 999, background: "var(--mint)", flex: "none" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.5 }}>{d.body}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 10, color: "var(--fg-3)" }}>
                    <span>Added {d.added}</span>
                    <span>·</span>
                    <span className="mono">{d.source}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button className="btn ghost icon sm" title="Edit"><Icon name="settings" size={11} /></button>
                  <button className="btn ghost icon sm" title="Archive"><Icon name="trash" size={11} style={{ color: "var(--rose)" }} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Archived */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="eyebrow">Archived · {archived.length}</div>
            <button className="btn sm ghost" style={{ color: "var(--fg-2)" }}>
              <Icon name="chevDown" size={11} /> Show
            </button>
          </div>
          {archived.map(d => (
            <div key={d.id} style={{
              padding: "8px 12px", background: "var(--bg-0)", border: "1px dashed var(--line)", borderRadius: 8,
              fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ textDecoration: "line-through" }}>{d.body}</span>
              <button className="btn ghost icon sm" style={{ marginLeft: "auto" }} title="Restore"><Icon name="refresh" size={11} /></button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--line)", background: "var(--bg-0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn sm ghost" style={{ color: "var(--fg-2)" }}>
          <Icon name="code" size={11} /> Edit raw .md
        </button>
        <button className="btn sm" onClick={onClose}>Done</button>
      </div>
    </ModalShell>
  );
};
window.SteerModal = SteerModal;

/* ===== Schedule modal — list, define, edit, delete ===== */
const PRESETS = [
  { key: "weekdays-9pm", label: "Weekdays · 9pm", cron: "0 21 * * 1-5" },
  { key: "every-4h", label: "Every 4 hours", cron: "0 */4 * * *" },
  { key: "nightly", label: "Nightly · midnight", cron: "0 0 * * *" },
  { key: "weekly", label: "Weekly · Mon 9am", cron: "0 9 * * 1" },
  { key: "custom", label: "Custom cron…", cron: "" },
];

const ScheduleModal = ({ onClose, project }) => {
  const p = project || window.PROJECTS[0];
  const [enabled, setEnabled] = useFlowState(p.schedule?.enabled || false);
  const [preset, setPreset] = useFlowState("weekdays-9pm");
  const [cron, setCron] = useFlowState(p.schedule?.cron || "0 21 * * 1-5");
  const [budget, setBudget] = useFlowState("10");
  const [maxRounds, setMaxRounds] = useFlowState("6");

  return (
    <ModalShell width={720} label="Schedule">
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--red-tint)", color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="schedule" size={15} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>Schedule</h2>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
              <span className="mono" style={{ color: "var(--fg-2)" }}>{p.name}</span> · runs sessions automatically
            </div>
          </div>
        </div>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 0 }}>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18, borderRight: "1px solid var(--line)" }}>
          {/* Enabled toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", background: enabled ? "var(--mint-tint)" : "var(--bg-0)",
            border: `1px solid ${enabled ? "var(--mint)" : "var(--line)"}`, borderRadius: 8,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>
                {enabled ? "Schedule on" : "Schedule off"}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>
                {enabled ? "Sessions will run automatically." : "Project only runs when you click Start."}
              </div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              style={{
                width: 38, height: 22, borderRadius: 999, padding: 2,
                background: enabled ? "var(--mint)" : "var(--bg-3)",
                display: "flex", justifyContent: enabled ? "flex-end" : "flex-start",
                transition: "all .15s",
              }}
              aria-label="Toggle schedule"
            >
              <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--bg-0)" }} />
            </button>
          </div>

          {/* Cadence presets */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Cadence</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PRESETS.map(opt => {
                const active = preset === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => { setPreset(opt.key); if (opt.cron) setCron(opt.cron); }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                      padding: "10px 12px", borderRadius: 8, textAlign: "left",
                      background: active ? "var(--red-tint)" : "var(--bg-0)",
                      border: `1px solid ${active ? "var(--red)" : "var(--line)"}`,
                      cursor: "pointer", color: active ? "var(--fg-0)" : "var(--fg-1)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                    {opt.cron && <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{opt.cron}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cron */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="eyebrow">Cron expression</div>
              <a href="#" style={{ fontSize: 11, color: "var(--sky)", textDecoration: "none" }}>Cron help ↗</a>
            </div>
            <input className="mono" value={cron} onChange={e => setCron(e.target.value)} style={{ height: 36, fontSize: 13 }} />
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="check" size={11} style={{ color: "var(--mint)" }} />
              <span>Resolves to: <strong style={{ color: "var(--fg-1)" }}>Mon–Fri at 9:00 PM</strong> · America/Los_Angeles</span>
            </div>
          </div>

          {/* Limits */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Limits per run</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--fg-2)" }}>Budget cap</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", fontSize: 13 }}>$</span>
                  <input className="mono" value={budget} onChange={e => setBudget(e.target.value)} style={{ height: 34, paddingLeft: 22 }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--fg-2)" }}>Max rounds / phase</label>
                <input className="mono" value={maxRounds} onChange={e => setMaxRounds(e.target.value)} style={{ height: 34 }} />
              </div>
            </div>
          </div>

          {/* On finish */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>When done</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { k: "merge", label: "Auto-merge if review passes", on: true },
                { k: "notify", label: "Notify me with a summary", on: true },
                { k: "stop", label: "Stop after one task (don't pull next)", on: false },
              ].map(opt => (
                <label key={opt.k} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer",
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: opt.on ? "var(--mint)" : "transparent",
                    border: `1.5px solid ${opt.on ? "var(--mint)" : "var(--line-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{opt.on && <Icon name="check" size={10} style={{ color: "var(--bg-0)" }} strokeWidth={3} />}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-1)" }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail — preview & history */}
        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-0)", overflow: "auto" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Next 3 runs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { d: "Tue", t: "9:00 PM", rel: "in 2h" },
                { d: "Wed", t: "9:00 PM", rel: "tomorrow" },
                { d: "Thu", t: "9:00 PM", rel: "Thu" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--red)" }} />
                  <span style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500 }}>{r.d}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>{r.t}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--fg-3)" }}>{r.rel}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Recent runs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { when: "Mon 9:00 PM", outcome: "shipped 3", color: "var(--mint)" },
                { when: "Fri 9:00 PM", outcome: "shipped 2", color: "var(--mint)" },
                { when: "Thu 9:00 PM", outcome: "asked 1 Q", color: "var(--amber)" },
                { when: "Wed 9:00 PM", outcome: "shipped 4", color: "var(--mint)" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <Icon name="check" size={10} style={{ color: r.color }} />
                  <span style={{ color: "var(--fg-2)", flex: 1 }}>{r.when}</span>
                  <span style={{ color: r.color }}>{r.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--line)", background: "var(--bg-0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn sm ghost" style={{ color: "var(--rose)" }}>
          <Icon name="trash" size={11} /> Delete schedule
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm ghost" onClick={onClose}>Cancel</button>
          <button className="btn sm primary"><Icon name="check" size={11} /> Save schedule</button>
        </div>
      </div>
    </ModalShell>
  );
};
window.ScheduleModal = ScheduleModal;
