import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { AddScheduleDialog } from "./add-schedule-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

function setup(overrides: Partial<React.ComponentProps<typeof AddScheduleDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  const props: React.ComponentProps<typeof AddScheduleDialog> = {
    projectId: 1,
    open: true,
    onOpenChange,
    onAdded,
    ...overrides,
  };
  render(<AddScheduleDialog {...props} />);
  return { onOpenChange, onAdded };
}

describe("AddScheduleDialog", () => {
  it("renders all required fields when open", () => {
    setup();
    expect(screen.getByLabelText(/schedule name/i)).toBeTruthy();
    expect(screen.getByLabelText(/schedule frequency/i)).toBeTruthy();
    expect(screen.getByLabelText(/schedule steps/i)).toBeTruthy();
  });

  it("renders nothing when open=false", () => {
    setup({ open: false });
    expect(screen.queryByLabelText(/schedule name/i)).toBeNull();
  });

  it("disables submit until name + frequency + steps are provided", () => {
    setup();
    const submit = screen.getByRole("button", { name: /add schedule/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/schedule name/i), {
      target: { value: "X" },
    });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/schedule frequency/i), {
      target: { value: "every 1d" },
    });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/schedule steps/i), {
      target: { value: "step one" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("submit calls POST with parsed body and notifies parent on success", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });
    const { onOpenChange, onAdded } = setup({ projectId: 7 });

    fireEvent.change(screen.getByLabelText(/schedule name/i), {
      target: { value: "Daily check" },
    });
    fireEvent.change(screen.getByLabelText(/schedule frequency/i), {
      target: { value: "every 1d" },
    });
    fireEvent.change(screen.getByLabelText(/schedule steps/i), {
      target: { value: "first step\n\n  second step  \n" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add schedule/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/7/schedules");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      name: "Daily check",
      frequency: "every 1d",
      steps: ["first step", "second step"],
    });

    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows inline error when API returns { error }", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "name empty after sanitization" }),
    });
    const { onAdded, onOpenChange } = setup();

    fireEvent.change(screen.getByLabelText(/schedule name/i), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByLabelText(/schedule frequency/i), {
      target: { value: "every 1d" },
    });
    fireEvent.change(screen.getByLabelText(/schedule steps/i), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add schedule/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toMatch(/name empty after sanitization/);
    expect(onAdded).not.toHaveBeenCalled();
    // Dialog stays open on error
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows network error when fetch throws", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error("offline"));
    setup();

    fireEvent.change(screen.getByLabelText(/schedule name/i), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByLabelText(/schedule frequency/i), {
      target: { value: "every 1d" },
    });
    fireEvent.change(screen.getByLabelText(/schedule steps/i), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add schedule/i }));

    const alert = await screen.findByRole("alert");
    expect((alert.textContent ?? "").toLowerCase()).toMatch(/network error/);
  });

  it("toggles description field when 'Add details' is clicked", () => {
    setup();
    expect(screen.queryByLabelText(/schedule description/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));
    expect(screen.getByLabelText(/schedule description/i)).toBeTruthy();
  });

  it("includes description in body when provided", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });
    setup();

    fireEvent.change(screen.getByLabelText(/schedule name/i), {
      target: { value: "n" },
    });
    fireEvent.change(screen.getByLabelText(/schedule frequency/i), {
      target: { value: "every 1d" },
    });
    fireEvent.change(screen.getByLabelText(/schedule steps/i), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));
    fireEvent.change(screen.getByLabelText(/schedule description/i), {
      target: { value: "context info" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add schedule/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.description).toBe("context info");
  });
});
