/**
 * Poller Module
 * Centralized polling scheduler using IntervalManager
 * Manages all periodic data fetching with proper guards and error handling
 */

(function() {
    'use strict';

    // =============================================================================
    // POLLING CONFIGURATION
    // =============================================================================

    /**
     * Polling task definition
     * @typedef {Object} PollingTask
     * @property {string} name - Task identifier
     * @property {Function} fn - Function to execute
     * @property {number} interval - Polling interval in ms
     * @property {boolean} [enabled=true] - Whether task is enabled
     * @property {Function} [condition] - Optional condition function that must return true
     * @property {number} [intervalId] - Active interval ID
     * @property {boolean} [isRunning] - Guard flag for overlapping calls
     */

    const registeredTasks = new Map();

    // =============================================================================
    // GUARD WRAPPER
    // =============================================================================

    /**
     * Wrap a function with a guard to prevent overlapping executions
     * @param {string} taskName - Name of the task (for logging)
     * @param {Function} fn - Async function to wrap
     * @returns {Function} Guarded function
     */
    function createGuardedTask(taskName, fn) {
        let isRunning = false;

        return async function guardedTask() {
            if (isRunning) {
                if (APP_CONFIG.debug) {
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

    // =============================================================================
    // TASK REGISTRATION
    // =============================================================================

    /**
     * Register a polling task
     * @param {string} name - Unique task identifier
     * @param {Function} fn - Function to execute
     * @param {number} interval - Polling interval in ms (from APP_CONFIG.intervals)
     * @param {Object} [options] - Additional options
     * @param {boolean} [options.guarded=true] - Wrap with guard to prevent overlapping
     * @param {Function} [options.condition] - Condition function that must return true to run
     * @param {boolean} [options.runImmediately=false] - Run once immediately on registration
     */
    function registerTask(name, fn, interval, options = {}) {
        const { guarded = true, condition = null, runImmediately = false } = options;

        if (registeredTasks.has(name)) {
            Logger.warn(`Poller: Task '${name}' already registered, unregistering first...`);
            unregisterTask(name);
        }

        const taskFn = guarded ? createGuardedTask(name, fn) : fn;

        // Wrap with condition check if provided
        const conditionalFn = condition
            ? async () => {
                if (condition()) {
                    await taskFn();
                }
            }
            : taskFn;

        const task = {
            name,
            fn: conditionalFn,
            originalFn: fn,
            interval,
            enabled: true,
            condition,
            intervalId: null
        };

        registeredTasks.set(name, task);

        if (APP_CONFIG.debug) {
            Logger.debug(`Poller: Registered task '${name}' (${interval}ms)`);
        }

        if (runImmediately) {
            conditionalFn();
        }

        return task;
    }

    /**
     * Unregister a polling task
     * @param {string} name - Task identifier
     */
    function unregisterTask(name) {
        const task = registeredTasks.get(name);
        if (task) {
            if (task.intervalId) {
                IntervalManager.clear(task.intervalId);
            }
            registeredTasks.delete(name);
            Logger.info(`Poller: Unregistered task '${name}'`);
        }
    }

    // =============================================================================
    // POLLING CONTROL
    // =============================================================================

    /**
     * Start all registered polling tasks
     */
    function startAll() {
        Logger.info(`Poller: Starting ${registeredTasks.size} polling tasks...`);

        for (const [name, task] of registeredTasks) {
            if (task.enabled && !task.intervalId) {
                task.intervalId = IntervalManager.register(task.fn, task.interval);
                if (APP_CONFIG.debug) {
                    Logger.debug(`Poller: Started '${name}' (ID: ${task.intervalId})`);
                }
            }
        }
    }

    /**
     * Stop all polling tasks
     */
    function stopAll() {
        Logger.info('Poller: Stopping all polling tasks...');

        for (const [name, task] of registeredTasks) {
            if (task.intervalId) {
                IntervalManager.clear(task.intervalId);
                task.intervalId = null;
            }
        }
    }

    /**
     * Start a specific polling task
     * @param {string} name - Task identifier
     */
    function startTask(name) {
        const task = registeredTasks.get(name);
        if (task && !task.intervalId) {
            task.intervalId = IntervalManager.register(task.fn, task.interval);
            task.enabled = true;
            Logger.info(`Poller: Started task '${name}'`);
        }
    }

    /**
     * Stop a specific polling task
     * @param {string} name - Task identifier
     */
    function stopTask(name) {
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
     * @param {string} name - Task identifier
     * @returns {Promise} Task execution promise
     */
    async function runTaskNow(name) {
        const task = registeredTasks.get(name);
        if (task) {
            return task.fn();
        }
        Logger.warn(`Poller: Task '${name}' not found`);
    }

    /**
     * Update the interval for a task
     * @param {string} name - Task identifier
     * @param {number} newInterval - New interval in ms
     */
    function updateInterval(name, newInterval) {
        const task = registeredTasks.get(name);
        if (task) {
            const wasRunning = task.intervalId !== null;
            if (wasRunning) {
                IntervalManager.clear(task.intervalId);
            }
            task.interval = newInterval;
            if (wasRunning) {
                task.intervalId = IntervalManager.register(task.fn, newInterval);
            }
            Logger.info(`Poller: Updated '${name}' interval to ${newInterval}ms`);
        }
    }

    // =============================================================================
    // STATUS & DEBUGGING
    // =============================================================================

    /**
     * Get status of all registered tasks
     * @returns {Object[]} Array of task status objects
     */
    function getStatus() {
        const status = [];
        for (const [name, task] of registeredTasks) {
            status.push({
                name,
                interval: task.interval,
                enabled: task.enabled,
                running: task.intervalId !== null,
                hasCondition: task.condition !== null
            });
        }
        return status;
    }

    /**
     * Get list of registered task names
     * @returns {string[]} Array of task names
     */
    function getTaskNames() {
        return Array.from(registeredTasks.keys());
    }

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.Poller = {
        // Registration
        register: registerTask,
        unregister: unregisterTask,

        // Control
        startAll,
        stopAll,
        start: startTask,
        stop: stopTask,
        runNow: runTaskNow,
        updateInterval,

        // Status
        getStatus,
        getTaskNames,

        // Utility
        createGuardedTask
    };

})();
