import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMotionWatcher,
  MotionState,
  OnvifMotionWatcher,
  SimulateMotionWatcher,
} from '../../src/lib/motion';

describe('motionState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not hot before any trigger', () => {
    const state = new MotionState(2000);
    expect(state.isHot()).toBe(false);
  });

  it('is hot immediately after trigger', () => {
    const state = new MotionState(2000);
    state.trigger();
    expect(state.isHot()).toBe(true);
  });

  it('stays hot within TTL', () => {
    const state = new MotionState(2000);
    state.trigger();
    vi.advanceTimersByTime(1999);
    expect(state.isHot()).toBe(true);
  });

  it('goes cold after TTL expires', () => {
    const state = new MotionState(2000);
    state.trigger();
    vi.advanceTimersByTime(2000);
    expect(state.isHot()).toBe(false);
  });

  it('resets TTL on re-trigger', () => {
    const state = new MotionState(2000);
    state.trigger();
    vi.advanceTimersByTime(1500);
    state.trigger(); // reset
    vi.advanceTimersByTime(1500); // 1500ms after second trigger, still within 2000ms TTL
    expect(state.isHot()).toBe(true);
  });

  it('tracks eventCount', () => {
    const state = new MotionState(2000);
    expect(state.eventCount).toBe(0);
    state.trigger();
    state.trigger();
    state.trigger();
    expect(state.eventCount).toBe(3);
  });
});

describe('simulateMotionWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not hot before start', () => {
    const watcher = new SimulateMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher.isHot()).toBe(false);
    expect(watcher.eventCount).toBe(0);
  });

  it('fires events on interval after start', async () => {
    // Force Math.random to always return 0 (< 0.6 → triggers)
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const watcher = new SimulateMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    await watcher.start();

    vi.advanceTimersByTime(2000); // first tick fires
    expect(watcher.isHot()).toBe(true);
    expect(watcher.eventCount).toBe(1);

    vi.advanceTimersByTime(2000); // second tick
    expect(watcher.eventCount).toBe(2);

    watcher.stop();
  });

  it('does not fire when random >= 0.6', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const watcher = new SimulateMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    await watcher.start();

    vi.advanceTimersByTime(2000);
    expect(watcher.isHot()).toBe(false);
    expect(watcher.eventCount).toBe(0);

    watcher.stop();
  });

  it('stops firing after stop()', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const watcher = new SimulateMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    await watcher.start();

    vi.advanceTimersByTime(2000);
    expect(watcher.eventCount).toBe(1);

    watcher.stop();

    vi.advanceTimersByTime(4000);
    expect(watcher.eventCount).toBe(1); // no more events
  });

  it('goes cold after TTL even with events stopped', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const watcher = new SimulateMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    await watcher.start();

    vi.advanceTimersByTime(2000); // trigger fires at t=2000
    expect(watcher.isHot()).toBe(true);

    watcher.stop();
    vi.advanceTimersByTime(2000); // TTL expires at t=4000
    expect(watcher.isHot()).toBe(false);
  });
});

describe('onvifMotionWatcher', () => {
  it('start resolves without error', async () => {
    const watcher = new OnvifMotionWatcher({
      cameraId: 'cam_01',
      onvifUrl: 'http://10.0.0.1:80',
      ttlMs: 2000,
    });
    await expect(watcher.start()).resolves.toBeUndefined();
  });

  it('isHot always returns false (stub)', () => {
    const watcher = new OnvifMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher.isHot()).toBe(false);
  });

  it('eventCount is always 0 (stub)', () => {
    const watcher = new OnvifMotionWatcher({
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher.eventCount).toBe(0);
  });
});

describe('createMotionWatcher', () => {
  it('returns SimulateMotionWatcher for "simulate"', () => {
    const watcher = createMotionWatcher('simulate', {
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher).toBeInstanceOf(SimulateMotionWatcher);
  });

  it('returns OnvifMotionWatcher for "onvif"', () => {
    const watcher = createMotionWatcher('onvif', {
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher).toBeInstanceOf(OnvifMotionWatcher);
  });

  it('returns null for "off"', () => {
    const watcher = createMotionWatcher('off', {
      cameraId: 'cam_01',
      ttlMs: 2000,
    });
    expect(watcher).toBeNull();
  });
});
