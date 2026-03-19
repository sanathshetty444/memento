import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      windowSize: 5,
      cooldownMs: 100,
    });
  });

  it("starts in CLOSED state", () => {
    expect(breaker.state).toBe("CLOSED");
  });

  it("executes functions normally in CLOSED state", async () => {
    const result = await breaker.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("opens after failure threshold exceeded", async () => {
    const fail = () => Promise.reject(new Error("fail"));

    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }

    expect(breaker.state).toBe("OPEN");
  });

  it("rejects calls immediately when OPEN", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }

    await expect(
      breaker.execute(() => Promise.resolve("ok"))
    ).rejects.toThrow("Circuit breaker is OPEN");
  });

  it("transitions to HALF_OPEN after cooldown", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    expect(breaker.state).toBe("OPEN");

    // Advance time past the cooldown
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);

    expect(breaker.state).toBe("HALF_OPEN");
    vi.useRealTimers();
  });

  it("returns to CLOSED on successful HALF_OPEN call", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }

    vi.useFakeTimers();
    vi.advanceTimersByTime(150);

    expect(breaker.state).toBe("HALF_OPEN");

    await breaker.execute(() => Promise.resolve("ok"));
    expect(breaker.state).toBe("CLOSED");
    vi.useRealTimers();
  });

  it("returns to OPEN on failed HALF_OPEN call", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }

    vi.useFakeTimers();
    vi.advanceTimersByTime(150);

    expect(breaker.state).toBe("HALF_OPEN");

    await breaker.execute(fail).catch(() => {});
    expect(breaker.state).toBe("OPEN");
    vi.useRealTimers();
  });

  it("reset() returns to CLOSED state", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    expect(breaker.state).toBe("OPEN");

    breaker.reset();
    expect(breaker.state).toBe("CLOSED");
  });
});
