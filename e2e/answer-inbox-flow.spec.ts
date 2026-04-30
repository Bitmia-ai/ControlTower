/**
 * E2E test for the inbox question-answer flow.
 *
 * Covers: a project with one pending question, opening the AnswerModal
 * from the QuestionsCard, filling an answer, submitting, and verifying the
 * POST /api/projects/[id]/answer body matches { questionId, answer }.
 *
 * Convention: route-mock everything; assert with auto-retrying matchers;
 * no `waitForTimeout`.
 */

import { test, expect } from "@playwright/test";

const QUESTION_ID = "Q001";
const QUESTION_TEXT = "Should we ship the widget feature this iteration?";
const ANSWER_TEXT = "Yes — ship it now.";

const PROJECT_DETAIL = {
  data: {
    project: {
      name: "haze",
      path: "/tmp/haze",
      initialized: true,
      running: true,
      sessionStatus: { cto: { status: "running", pid: 12345, lastActivity: Date.now() } },
    },
    state: {
      iteration: 12,
      phase: "BUILD",
      phase_status: "pending",
      task_id: "T009",
      task_title: "Build the widget",
      health: {
        confidence: "HIGH",
        env_status: "healthy",
        iterations_since_last_deploy: 0,
        questions_awaiting_ceo: 1,
        blocked_items_count: 0,
      },
    },
    currentTask: null,
    activeItem: null,
    pendingQuestions: [
      {
        id: QUESTION_ID,
        question: QUESTION_TEXT,
        context: "While building the widget",
        answered: false,
      },
    ],
    upNext: [],
    recentlyShipped: [],
    allDoneItems: [],
    recentChangelog: [],
    steeringDirectives: [],
  },
};

test.describe("Answer inbox flow", () => {
  test("submits POST /answer with the right questionId + answer", async ({
    page,
  }) => {
    let postedBody: { questionId?: string; answer?: string } | null = null;

    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PROJECT_DETAIL),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0.1, total: 1.0 } }),
      });
    });

    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // The endpoint under test — capture the body for assertion.
    await page.route("**/api/projects/0/answer", async (route) => {
      try {
        postedBody = JSON.parse(route.request().postData() ?? "{}");
      } catch {
        postedBody = {};
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { success: true } }),
      });
    });

    // 1. Visit mission control
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // 2. The QuestionsCard surfaces the first pending question with an
    //    "Answer" button. Auto-retry on visibility.
    await expect(page.getByText(QUESTION_TEXT)).toBeVisible();

    const answerBtn = page.getByRole("button", { name: /^Answer/ });
    await expect(answerBtn).toBeVisible();
    await answerBtn.click();

    // 3. AnswerModal opens with a textarea labelled "Your answer"
    const textarea = page.getByLabel(/your answer/i);
    await expect(textarea).toBeVisible();

    // 4. Fill the answer
    await textarea.fill(ANSWER_TEXT);

    // 5. Submit
    const submitBtn = page.getByRole("button", { name: /submit answer/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Verify the POST went out with the right body
    await expect
      .poll(() => postedBody, { timeout: 5_000 })
      .toEqual({ questionId: QUESTION_ID, answer: ANSWER_TEXT });
  });
});
