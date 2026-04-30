// @vitest-environment node
/**
 * Spawn-prompt contract test.
 *
 * The CTO spawn prompt has to invoke `/redeye:start` (the slash command), which
 * the redeye plugin's `commands/start.md` body bridges to the `redeye:start`
 * skill. On 2026-04-29 a regression caused the model to print the slash
 * command body verbatim every turn instead of calling the Skill tool — the
 * loop burned tokens for hours.
 *
 * This test locks the prompt against accidental rewording. If you legitimately
 * need to change the prompt, update both the constant and this test together
 * AND run a real `claude --print --plugin-dir ~/redeye` smoke check first to
 * confirm the new wording still triggers the skill.
 */

import { describe, it, expect } from "vitest";
import { PROMPTS } from "./session-manager";

describe("spawn prompt contract — CTO", () => {
  it("invokes the /redeye:start slash command (skill name unchanged)", () => {
    // The slash command bridges to the skill. Renaming either side is a hard
    // breakage for users who installed the plugin from the marketplace.
    expect(PROMPTS.cto).toContain("/redeye:start");
  });

  it("explicitly mentions the skill so the model knows to follow through", () => {
    // The wording has to make it clear that simply invoking the slash command
    // and stopping (printing its body) is NOT the goal — the model must follow
    // the skill instructions all the way through start-loop.sh.
    expect(PROMPTS.cto.toLowerCase()).toContain("skill");
  });

  it("frames the work as the autonomous loop (not a one-shot question)", () => {
    // The spawn prompt is the only input the headless claude process gets.
    // It has to set the right framing or the model treats it as a Q&A.
    expect(PROMPTS.cto.toLowerCase()).toMatch(/loop|autonomous/);
  });

  it("does NOT reference any other skill / plugin name", () => {
    // Defense against accidental copy-paste into the CTO prompt of e.g.
    // `redeye:init`, `ralph-loop`, or some experimental skill name.
    expect(PROMPTS.cto).not.toMatch(/redeye:init/);
    expect(PROMPTS.cto).not.toMatch(/redeye:stop/);
    expect(PROMPTS.cto).not.toMatch(/redeye:pause/);
  });
});

describe("spawn prompt contract — other roles", () => {
  it("tester prompt references its known control files", () => {
    expect(PROMPTS.tester).toContain(".redeye/config.md");
    expect(PROMPTS.tester).toContain(".redeye/tester-reports.md");
  });

  it("documenter prompt scopes to factual updates only", () => {
    expect(PROMPTS.documenter.toLowerCase()).toContain("factual");
  });
});
