export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  windowSize?: number;
  cooldownMs?: number;
  maxCooldownMs?: number;
}

export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failures: boolean[];
  private windowSize: number;
  private failureThreshold: number;
  private baseCooldownMs: number;
  private currentCooldownMs: number;
  private maxCooldownMs: number;
  private lastFailureTime: number = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.windowSize = options.windowSize ?? 10;
    this.baseCooldownMs = options.cooldownMs ?? 30_000;
    this.currentCooldownMs = this.baseCooldownMs;
    this.maxCooldownMs = options.maxCooldownMs ?? 300_000;
    this.failures = [];
  }

  get state(): CircuitState {
    if (this._state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.currentCooldownMs) {
        this._state = "HALF_OPEN";
      }
    }
    return this._state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.state;

    if (currentState === "OPEN") {
      throw new Error("Circuit breaker is OPEN - call rejected");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  reset(): void {
    this._state = "CLOSED";
    this.failures = [];
    this.currentCooldownMs = this.baseCooldownMs;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    if (this._state === "HALF_OPEN") {
      this._state = "CLOSED";
      this.failures = [];
      this.currentCooldownMs = this.baseCooldownMs;
    } else {
      this.recordResult(false);
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this._state === "HALF_OPEN") {
      this._state = "OPEN";
      this.currentCooldownMs = Math.min(this.currentCooldownMs * 2, this.maxCooldownMs);
      return;
    }

    this.recordResult(true);

    const failureCount = this.failures.filter(Boolean).length;
    if (failureCount >= this.failureThreshold) {
      this._state = "OPEN";
    }
  }

  private recordResult(isFailure: boolean): void {
    this.failures.push(isFailure);
    if (this.failures.length > this.windowSize) {
      this.failures.shift();
    }
  }
}
