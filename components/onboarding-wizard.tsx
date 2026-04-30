"use client";

import { useState } from "react";

interface OnboardingWizardProps {
  projectId: number;
  projectName: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "welcome" | "vision" | "tasks" | "commands" | "review" | "initializing";

const STEPS: Step[] = ["welcome", "vision", "tasks", "commands", "review", "initializing"];
const STEP_LABELS = ["Welcome", "Vision", "Tasks", "Commands", "Review", "Setup"];

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.slice(0, -1).map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all ${
              i < currentIndex
                ? "bg-red-600 text-white"
                : i === currentIndex
                ? "bg-red-600 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700"
            }`}
          >
            {i < currentIndex ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 2 && (
            <div
              className={`w-8 h-px ${i < currentIndex ? "bg-red-600" : "bg-gray-200 dark:bg-zinc-700"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard({
  projectId,
  projectName,
  onComplete,
  onCancel,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [vision, setVision] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [deployCommand, setDeployCommand] = useState("");
  const [testCommand, setTestCommand] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [initLog, setInitLog] = useState<string[]>([]);

  function addTask() {
    const trimmed = taskInput.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, trimmed]);
    setTaskInput("");
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTaskKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  }

  function goBack() {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  }

  function goNext() {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  }

  async function handleInitialize() {
    setStep("initializing");
    setError(null);
    setInitLog(["Connecting to RedEye..."]);

    try {
      setInitLog((prev) => [...prev, "Sending configuration..."]);

      const body: Record<string, string> = {};
      if (vision.trim()) body.vision = vision.trim();
      if (tasks.length > 0) body.firstTask = tasks.join("\n");
      if (deployCommand.trim()) body.deployCommand = deployCommand.trim();
      if (testCommand.trim()) body.testCommand = testCommand.trim();
      if (appUrl.trim()) body.appUrl = appUrl.trim();

      setInitLog((prev) => [...prev, "Initializing project structure..."]);

      const res = await fetch(`/api/projects/${projectId}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Initialization failed");
        setStep("review");
        return;
      }

      setInitLog((prev) => [...prev, "RedEye initialized successfully!", "Done."]);

      setTimeout(() => {
        onComplete();
      }, 800);
    } catch {
      setError("Network error during initialization");
      setStep("review");
    }
  }

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="px-8 pt-8 pb-4">
          {step !== "initializing" && <StepIndicator current={step} />}
        </div>

        {/* Step content */}
        <div className="px-8 pb-8">
          {/* Welcome */}
          {step === "welcome" && (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <span className="text-2xl">🔴</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">
                Let&apos;s set up RedEye for{" "}
                <span className="text-red-500">{projectName}</span>
              </h2>
              <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                RedEye is your autonomous engineering co-pilot. It will build, test, deploy,
                and iterate on your project — guided by your vision. This wizard takes about
                two minutes to configure.
              </p>
              <button
                onClick={goNext}
                className="px-8 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Vision */}
          {step === "vision" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                <label htmlFor="wizard-vision">What are you building?</label>
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-5">
                Describe your project&apos;s purpose, goals, and what success looks like.
              </p>
              <textarea
                id="wizard-vision"
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="A beautiful terminal weather CLI that fetches real-time forecasts and displays them with ASCII art. Users should be able to check weather for any city with a single command..."
                rows={7}
                autoFocus
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-red-600 transition resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Tasks */}
          {step === "tasks" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                What should RedEye build first?
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-5">
                Add the initial tasks. Press Enter or click Add after each one.
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={handleTaskKeyDown}
                  placeholder="e.g. Set up project scaffolding with TypeScript"
                  aria-label="New task"
                  autoFocus
                  className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-red-600 transition"
                />
                <button
                  type="button"
                  onClick={addTask}
                  disabled={!taskInput.trim()}
                  className="px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-zinc-200 rounded-lg transition"
                >
                  Add
                </button>
              </div>
              {tasks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tasks.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-200"
                    >
                      <span className="w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="max-w-[280px] truncate">{task}</span>
                      <button
                        type="button"
                        onClick={() => removeTask(i)}
                        className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition ml-0.5"
                        aria-label="Remove task"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-zinc-600 italic">
                  No tasks added yet — you can also skip this and add tasks later.
                </p>
              )}
            </div>
          )}

          {/* Commands */}
          {step === "commands" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                How do you build and test?
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                RedEye uses these to verify its work. Leave empty to use defaults.
              </p>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="wizard-deploy"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    Deploy command
                  </label>
                  <input
                    id="wizard-deploy"
                    type="text"
                    value={deployCommand}
                    onChange={(e) => setDeployCommand(e.target.value)}
                    placeholder="npm run build && npm start"
                    autoFocus
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-red-600 transition font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="wizard-test"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    Test command
                  </label>
                  <input
                    id="wizard-test"
                    type="text"
                    value={testCommand}
                    onChange={(e) => setTestCommand(e.target.value)}
                    placeholder="npm test"
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-red-600 transition font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="wizard-url"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    App URL
                  </label>
                  <input
                    id="wizard-url"
                    type="text"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-red-600 transition font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Review */}
          {step === "review" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
                Review your configuration
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                Everything look good? You can edit any section before initializing.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {/* Vision section */}
                <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide">Vision</span>
                    <button
                      onClick={() => setStep("vision")}
                      aria-label="Edit vision"
                      className="text-xs text-red-500 hover:text-red-400 transition"
                    >
                      Edit
                    </button>
                  </div>
                  {vision.trim() ? (
                    <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed line-clamp-3">{vision}</p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-zinc-600 italic">Not set</p>
                  )}
                </div>

                {/* Tasks section */}
                <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide">
                      Initial tasks ({tasks.length})
                    </span>
                    <button
                      onClick={() => setStep("tasks")}
                      aria-label="Edit initial tasks"
                      className="text-xs text-red-500 hover:text-red-400 transition"
                    >
                      Edit
                    </button>
                  </div>
                  {tasks.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {tasks.map((task, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-zinc-300 flex items-start gap-2">
                          <span className="text-gray-400 dark:text-zinc-600 mt-0.5">{i + 1}.</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-zinc-600 italic">None added</p>
                  )}
                </div>

                {/* Commands section */}
                <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide">Commands</span>
                    <button
                      onClick={() => setStep("commands")}
                      aria-label="Edit commands"
                      className="text-xs text-red-500 hover:text-red-400 transition"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 dark:text-zinc-600 w-16 flex-shrink-0">Deploy</span>
                      {deployCommand.trim() ? (
                        <code className="text-gray-700 dark:text-zinc-300 font-mono text-xs bg-gray-100 dark:bg-zinc-900 px-2 py-0.5 rounded truncate">
                          {deployCommand}
                        </code>
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-600 italic text-xs">skipped</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 dark:text-zinc-600 w-16 flex-shrink-0">Test</span>
                      {testCommand.trim() ? (
                        <code className="text-gray-700 dark:text-zinc-300 font-mono text-xs bg-gray-100 dark:bg-zinc-900 px-2 py-0.5 rounded truncate">
                          {testCommand}
                        </code>
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-600 italic text-xs">skipped</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 dark:text-zinc-600 w-16 flex-shrink-0">URL</span>
                      {appUrl.trim() ? (
                        <code className="text-gray-700 dark:text-zinc-300 font-mono text-xs bg-gray-100 dark:bg-zinc-900 px-2 py-0.5 rounded truncate">
                          {appUrl}
                        </code>
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-600 italic text-xs">skipped</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Initializing */}
          {step === "initializing" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-t-red-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-6">
                Initializing {projectName}…
              </h2>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 text-left font-mono text-xs max-w-sm mx-auto">
                {initLog.map((line, i) => (
                  <div
                    key={i}
                    className={`${i === initLog.length - 1 ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-zinc-500"} leading-relaxed`}
                  >
                    <span className="text-gray-300 dark:text-zinc-700 mr-2">$</span>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {step !== "welcome" && step !== "initializing" && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
              >
                ← Back
              </button>

              {step === "review" ? (
                <button
                  type="button"
                  onClick={handleInitialize}
                  className="px-6 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
                >
                  Initialize Project
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-2.5 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-800 dark:text-zinc-100 rounded-lg transition"
                >
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step label */}
      {step !== "initializing" && (
        <p className="text-center text-xs text-gray-400 dark:text-zinc-700 mt-3">
          Step {currentStepIndex + 1} of {STEPS.length - 1} — {STEP_LABELS[currentStepIndex]}
        </p>
      )}
    </div>
  );
}
