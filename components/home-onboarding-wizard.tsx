"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const DISMISS_KEY = "ct_onboarding_dismissed";

interface HomeOnboardingWizardProps {
  onProjectAdded: () => void;
  onDismiss: () => void;
}

type Step = 1 | 2 | 3 | 4;
const TOTAL_STEPS: Step[] = [1, 2, 3, 4];

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function persistDismiss() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // ignore — private mode or quota
  }
}

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {TOTAL_STEPS.map((n) => {
        const active = n === current;
        return (
          <div
            key={n}
            data-testid={`step-dot-${n}`}
            data-active={active ? "true" : "false"}
            className={`h-2 rounded-full transition-all ${
              active
                ? "w-6 bg-red-600"
                : "w-2 bg-gray-200 dark:bg-zinc-700"
            }`}
          />
        );
      })}
    </div>
  );
}

export function HomeOnboardingWizard({
  onProjectAdded,
  onDismiss,
}: HomeOnboardingWizardProps) {
  // SSR-safe: start as null (hidden) and resolve after mount.
  // null = not yet checked; true = dismissed; false = visible.
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>(1);

  // Step 3 form state
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState<string | null>(null);

  useEffect(() => {
    setHidden(readDismissed());
  }, []);

  function handleSkip() {
    persistDismiss();
    onDismiss();
    setHidden(true);
  }

  function handleDone() {
    // Step 4 done: hide the wizard for this session.
    // We don't persist localStorage because, by this point, a project was
    // registered and home-client will naturally render the project grid
    // instead. onDismiss flips the parent's dismissed state so the
    // wizard yields to the project grid even before fetchProjects resolves.
    onDismiss();
    setHidden(true);
  }

  function goNext() {
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.error ?? "Failed to register project");
        return;
      }
      setRegisteredName(name);
      onProjectAdded();
      setStep(4);
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // SSR / pre-mount and dismissed: render nothing
  if (hidden === null || hidden === true) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Skip / dismiss in top-right */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip onboarding"
          className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
        >
          Skip
        </button>

        <div className="px-8 pt-10 pb-8">
          <StepDots current={step} />

          {step === 1 && (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <span className="text-2xl">🔴</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">
                Welcome to Control Tower
              </h2>
              <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed mb-2 max-w-md mx-auto">
                Control Tower is your dashboard for managing autonomous coding
                agents. It pairs with RedEye, an autonomous dev loop that builds,
                tests, and ships features for you.
              </p>
              <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                Let&apos;s walk through the four-minute setup.
              </p>
              <button
                type="button"
                onClick={goNext}
                className="px-8 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                Get Started
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                Prerequisites
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                Make sure these are installed before continuing.
              </p>
              <ul className="flex flex-col gap-3">
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      Git repository
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                      Run <code className="font-mono bg-gray-100 dark:bg-zinc-900 px-1 rounded">git init</code> in your project, or point at an existing repo.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      RedEye plugin installed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                      The autonomous dev loop. See{" "}
                      <a
                        href="https://github.com/Bitmia-ai/RedEye"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-500 hover:underline"
                      >
                        RedEye on GitHub
                      </a>{" "}
                      for install instructions.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      Claude Code installed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                      Verify with <code className="font-mono bg-gray-100 dark:bg-zinc-900 px-1 rounded">which claude</code>.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                Register your first project
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                Point Control Tower at the directory you want to manage.
              </p>
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="wizard-project-name"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    Name
                  </label>
                  <input
                    id="wizard-project-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-app"
                    required
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="wizard-project-path"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    Path
                  </label>
                  <input
                    id="wizard-project-path"
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/Users/you/my-app"
                    required
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition font-mono"
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    {submitting ? "Registering…" : "Register Project"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">
                Start the Loop
              </h2>
              <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed mb-3 max-w-md mx-auto">
                {registeredName ? (
                  <>
                    <span className="font-medium text-gray-900 dark:text-zinc-100">
                      {registeredName}
                    </span>{" "}
                    is registered.
                  </>
                ) : (
                  "Your project is registered."
                )}{" "}
                Initialize RedEye with{" "}
                <code className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  /redeye:init
                </code>{" "}
                in Claude Code, then click <strong>Start</strong> on the project
                card to launch the autonomous dev loop.
              </p>
              <p className="text-gray-500 dark:text-zinc-500 text-xs mb-8 max-w-md mx-auto">
                RedEye will plan, build, test, and ship features for you. Watch
                progress here in real time.
              </p>
              <button
                type="button"
                onClick={handleDone}
                className="px-8 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                Done
              </button>
            </div>
          )}

          {/* Back / Next nav for steps 1, 2 (step 3 has Submit, step 4 has Done) */}
          {(step === 1 || step === 2) && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ← Back
              </button>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-2.5 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-800 dark:text-zinc-100 rounded-lg transition"
                >
                  Next →
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex items-center justify-start mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-zinc-700 mt-3">
        Step {step} of 4
      </p>
    </div>
  );
}
