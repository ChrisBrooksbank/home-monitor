/**
 * Poller Module
 * Centralized polling scheduler using IntervalManager
 */

import type { PollingTask, PollingTaskStatus, RegisterTaskOptions } from '../types';
import { Logger } from '../utils/logger';
import { IntervalManager } from '../utils/helpers';
import { Registry } from './registry';

// Helper to get debug mode from APP_CONFIG
function isDebugMode(): boolean {
  const config = Registry.getOptional('APP_CONFIG');
  return config?.debug ?? false;
}

const registeredTasks = new Map<string, PollingTask>();

/**
 * Wrap a function with a guard to prevent overlapping executions
 */
function createGuardedTask(
  taskName: string,
  fn: () => Promise<void> | void
): () => Promise<void> {
  let isRunning = false;

  return async function guardedTask(): Promise<void> {
    if (isRunning) {
      if (isDebugMode()) {
        Logger.debug(`${taskName}: Already running, skipping...`);
      }
      return;
    }

    isRunning = true;
    try {
      await fn();
    } catch (error) {
      Logger.error(`${taskName} error:`, error);
    } finally {
      isRunning = false;
    }
  };
}

/**
 * Register a polling task
 */
function registerTask(
  name: string,
  fn: () => Promise<void> | void,
  interval: number,
  options: RegisterTaskOptions = {}
): PollingTask {
  const { guarded = true, condition = null, runImmediately = false } = options;

  if (registeredTasks.has(name)) {
    Logger.warn(`Poller: Task '${name}' already registered, unregistering first...`);
    unregisterTask(name);
  }

  const taskFn = guarded ? createGuardedTask(name, fn) : fn;

  // Wrap with condition check if provided
  const conditionalFn = condition
    ? async (): Promise<void> => {
        if (condition()) {
          await taskFn();
        }
      }
    : taskFn;

  const task: PollingTask = {
    name,
    fn: conditionalFn,
    originalFn: fn,
    interval,
    enabled: true,
    condition,
    intervalId: null,
  };

  registeredTasks.set(name, task);

  if (isDebugMode()) {
    Logger.debug(`Poller: Registered task '${name}' (${interval}ms)`);
  }

  if (runImmediately) {
    void conditionalFn();
  }

  return task;
}

/**
 * Unregister a polling task
 */
function unregisterTask(name: string): void {
  const task = registeredTasks.get(name);
  if (task) {
    if (task.intervalId) {
      IntervalManager.clear(task.intervalId);
    }
    registeredTasks.delete(name);
    Logger.info(`Poller: Unregistered task '${name}'`);
  }
}

/**
 * Start all registered polling tasks
 */
function startAll(): void {
  Logger.info(`Poller: Starting ${registeredTasks.size} polling tasks...`);

  for (const [name, task] of registeredTasks) {
    if (task.enabled && !task.intervalId) {
      task.intervalId = IntervalManager.register(
        () => void task.fn(),
        task.interval
      );
      if (isDebugMode()) {
        Logger.debug(`Poller: Started '${name}' (ID: ${String(task.intervalId)})`);
      }
    }
  }
}

/**
 * Stop all polling tasks
 */
function stopAll(): void {
  Logger.info('Poller: Stopping all polling tasks...');

  for (const [, task] of registeredTasks) {
    if (task.intervalId) {
      IntervalManager.clear(task.intervalId);
      task.intervalId = null;
    }
  }
}

/**
 * Start a specific polling task
 */
function startTask(name: string): void {
  const task = registeredTasks.get(name);
  if (task && !task.intervalId) {
    task.intervalId = IntervalManager.register(
      () => void task.fn(),
      task.interval
    );
    task.enabled = true;
    Logger.info(`Poller: Started task '${name}'`);
  }
}

/**
 * Stop a specific polling task
 */
function stopTask(name: string): void {
  const task = registeredTasks.get(name);
  if (task && task.intervalId) {
    IntervalManager.clear(task.intervalId);
    task.intervalId = null;
    task.enabled = false;
    Logger.info(`Poller: Stopped task '${name}'`);
  }
}

/**
 * Run a specific task immediately (outside of interval)
 */
async function runTaskNow(name: string): Promise<void> {
  const task = registeredTasks.get(name);
  if (task) {
    await task.fn();
    return;
  }
  Logger.warn(`Poller: Task '${name}' not found`);
}

/**
 * Update the interval for a task
 */
function updateInterval(name: string, newInterval: number): void {
  const task = registeredTasks.get(name);
  if (task) {
    const wasRunning = task.intervalId !== null;
    if (wasRunning && task.intervalId) {
      IntervalManager.clear(task.intervalId);
    }
    task.interval = newInterval;
    if (wasRunning) {
      task.intervalId = IntervalManager.register(
        () => void task.fn(),
        newInterval
      );
    }
    Logger.info(`Poller: Updated '${name}' interval to ${newInterval}ms`);
  }
}

/**
 * Get status of all registered tasks
 */
function getStatus(): PollingTaskStatus[] {
  const status: PollingTaskStatus[] = [];
  for (const [name, task] of registeredTasks) {
    status.push({
      name,
      interval: task.interval,
      enabled: task.enabled,
      running: task.intervalId !== null,
      hasCondition: task.condition !== null,
    });
  }
  return status;
}

/**
 * Get list of registered task names
 */
function getTaskNames(): string[] {
  return Array.from(registeredTasks.keys());
}

export const Poller = {
  register: registerTask,
  unregister: unregisterTask,
  startAll,
  stopAll,
  start: startTask,
  stop: stopTask,
  runNow: runTaskNow,
  updateInterval,
  getStatus,
  getTaskNames,
  createGuardedTask,
} as const;

// Register with the service registry
Registry.register({
  key: 'Poller',
  instance: Poller,
});
