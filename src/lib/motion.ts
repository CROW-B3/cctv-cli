export type MotionMode = 'onvif' | 'simulate' | 'off';

export interface MotionWatcher {
  isHot: () => boolean;
  start: () => Promise<void>;
  stop: () => void;
  eventCount: number;
}

export interface MotionWatcherConfig {
  cameraId: string;
  onvifUrl?: string;
  ttlMs: number;
}

export function createMotionWatcher(
  mode: MotionMode,
  config: MotionWatcherConfig
): MotionWatcher | null {
  switch (mode) {
    case 'simulate':
      return new SimulateMotionWatcher(config);
    case 'onvif':
      return new OnvifMotionWatcher(config);
    case 'off':
      return null;
  }
}

/** TTL state machine: trigger() resets timer, isHot() checks recency */
class MotionState {
  private lastEventMs = 0;
  private _eventCount = 0;

  constructor(private readonly ttlMs: number) {}

  trigger(): void {
    this.lastEventMs = Date.now();
    this._eventCount++;
  }

  isHot(): boolean {
    return Date.now() - this.lastEventMs < this.ttlMs;
  }

  get eventCount(): number {
    return this._eventCount;
  }
}

/** Fires random motion events (~60% chance per 2s tick) for dev/testing */
class SimulateMotionWatcher implements MotionWatcher {
  private state: MotionState;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: MotionWatcherConfig) {
    this.state = new MotionState(config.ttlMs);
  }

  async start(): Promise<void> {
    this.timer = setInterval(() => {
      if (Math.random() < 0.6) {
        this.state.trigger();
      }
    }, 2000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isHot(): boolean {
    return this.state.isHot();
  }

  get eventCount(): number {
    return this.state.eventCount;
  }
}

/** Stub — real ONVIF implementation deferred until hardware is available */
class OnvifMotionWatcher implements MotionWatcher {
  private _eventCount = 0;

  constructor(private readonly config: MotionWatcherConfig) {}

  async start(): Promise<void> {
    console.warn(
      `[motion] ONVIF watcher for ${this.config.cameraId} is a stub — no real events will fire`
    );
  }

  stop(): void {
    // no-op
  }

  isHot(): boolean {
    return false;
  }

  get eventCount(): number {
    return this._eventCount;
  }
}

// Export classes for testing
export { MotionState, OnvifMotionWatcher, SimulateMotionWatcher };
