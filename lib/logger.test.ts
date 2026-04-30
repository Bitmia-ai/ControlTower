import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "@/lib/logger";

describe("lib/logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("LOGGER_LEVEL=silent", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "silent");
    });

    it("suppresses info()", () => {
      logger.info("scope", "hello");
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("suppresses warn()", () => {
      logger.warn("scope", "hello");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("suppresses error()", () => {
      logger.error("scope", "hello");
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("LOGGER_LEVEL=error", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "error");
    });

    it("emits error()", () => {
      logger.error("scope", "boom");
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("suppresses warn()", () => {
      logger.warn("scope", "warn-msg");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("suppresses info()", () => {
      logger.info("scope", "info-msg");
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("LOGGER_LEVEL=warn", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "warn");
    });

    it("emits warn() and error()", () => {
      logger.warn("scope", "w");
      logger.error("scope", "e");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("suppresses info()", () => {
      logger.info("scope", "info-msg");
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("LOGGER_LEVEL=info", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "info");
    });

    it("emits all three levels", () => {
      logger.info("scope", "i");
      logger.warn("scope", "w");
      logger.error("scope", "e");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("default (unset LOGGER_LEVEL)", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "");
    });

    it("emits all three levels when env is empty string", () => {
      logger.info("s", "i");
      logger.warn("s", "w");
      logger.error("s", "e");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("output format", () => {
    beforeEach(() => {
      vi.stubEnv("LOGGER_LEVEL", "info");
    });

    it("prefixes the formatted line with [LEVEL] [scope] msg for error", () => {
      logger.error("POST /tasks", "Failed to auto-resume CTO:");
      expect(errorSpy).toHaveBeenCalledWith(
        "[ERROR] [POST /tasks] Failed to auto-resume CTO:"
      );
    });

    it("prefixes the formatted line with [LEVEL] [scope] msg for warn", () => {
      logger.warn("CT/sw-registrar", "SW registration failed:");
      expect(warnSpy).toHaveBeenCalledWith(
        "[WARN] [CT/sw-registrar] SW registration failed:"
      );
    });

    it("prefixes the formatted line with [LEVEL] [scope] msg for info", () => {
      logger.info("schedules/run", "starting");
      expect(logSpy).toHaveBeenCalledWith("[INFO] [schedules/run] starting");
    });

    it("forwards meta args after the formatted prefix", () => {
      const err = new Error("boom");
      const ctx = { taskId: "T1" };
      logger.error("scope", "msg", err, ctx);
      expect(errorSpy).toHaveBeenCalledWith(
        "[ERROR] [scope] msg",
        err,
        ctx
      );
    });

    it("supports zero meta args", () => {
      logger.warn("scope", "just a message");
      expect(warnSpy).toHaveBeenCalledWith("[WARN] [scope] just a message");
      expect(warnSpy.mock.calls[0]).toHaveLength(1);
    });
  });

  describe("unrecognised LOGGER_LEVEL", () => {
    it("falls back to info-level behaviour", () => {
      vi.stubEnv("LOGGER_LEVEL", "verbose-not-a-level");
      logger.info("s", "i");
      logger.warn("s", "w");
      logger.error("s", "e");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("level evaluated per-call (not cached)", () => {
    it("respects env changes between calls", () => {
      vi.stubEnv("LOGGER_LEVEL", "silent");
      logger.error("s", "first");
      expect(errorSpy).not.toHaveBeenCalled();

      vi.stubEnv("LOGGER_LEVEL", "info");
      logger.error("s", "second");
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
