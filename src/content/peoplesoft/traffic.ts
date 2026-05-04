import { logQuiet } from "../../shared/log";

const LOCK_KEY = "better-caesar:peoplesoft-lock";
const DEFAULT_LOCK_TTL_MS = 120_000;

const PRIORITY_ORDER: Record<PeopleSoftTaskPriority, number> = {
  navigation: 0,
  user: 1,
  background: 2
};

type LockState = {
  owner: string;
  expiresAt: number;
};

type QueueTask<T> = {
  id: number;
  owner?: string;
  priority: PeopleSoftTaskPriority;
  controller: AbortController;
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export type PeopleSoftTaskPriority = "navigation" | "user" | "background";

export class PeopleSoftTaskCancelledError extends Error {
  readonly retryable = true;

  constructor(message = "PeopleSoft task canceled.") {
    super(message);
    this.name = "PeopleSoftTaskCancelledError";
  }
}

let taskSequence = 0;
let activeTask: QueueTask<any> | null = null;
let activeTaskSignal: AbortSignal | null = null;
let queue: QueueTask<any>[] = [];
let idleResolvers: Array<() => void> = [];

export async function runPeopleSoftTask<T>(
  priority: PeopleSoftTaskPriority,
  execute: () => Promise<T>,
  options?: { owner?: string }
): Promise<T> {
  if (isPeopleSoftLockedFor(options?.owner) && priority !== "navigation") {
    throw new Error("PeopleSoft requests are paused while term navigation is in progress.");
  }

  return new Promise<T>((resolve, reject) => {
    const task: QueueTask<T> = {
      id: ++taskSequence,
      owner: options?.owner,
      priority,
      controller: new AbortController(),
      execute,
      resolve,
      reject
    };

    prepareQueueForTask(task);
    queue.push(task as QueueTask<any>);
    queue.sort(compareTasks);
    void pumpQueue();
  });
}

export async function acquirePeopleSoftLock(
  owner: string,
  options?: { ttlMs?: number; waitForIdle?: boolean; abortActive?: boolean }
): Promise<void> {
  const ttlMs = options?.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const waitForIdle = options?.waitForIdle ?? true;
  const abortActive = options?.abortActive ?? false;

  writeLock({
    owner,
    expiresAt: Date.now() + ttlMs
  });

  if (abortActive) {
    cancelQueuedTasks(
      (task) => task.priority !== "navigation",
      "PeopleSoft task canceled because navigation took priority."
    );

    if (activeTask && activeTask.owner !== owner) {
      activeTask.controller.abort(
        new PeopleSoftTaskCancelledError(
          "PeopleSoft task canceled because navigation took priority."
        )
      );
    }
  }

  if (waitForIdle) {
    await waitForPeopleSoftIdle();
  }
}

export function releasePeopleSoftLock(owner: string): void {
  const lock = readLock();
  if (!lock) return;
  if (lock.owner !== owner) return;
  clearLock();
}

export async function waitForPeopleSoftIdle(): Promise<void> {
  if (!activeTask && queue.length === 0) return;
  await new Promise<void>((resolve) => {
    idleResolvers.push(resolve);
  });
}

export function isPeopleSoftLockedFor(owner?: string): boolean {
  const lock = readLock();
  if (!lock) return false;
  if (owner && lock.owner === owner) return false;
  return true;
}

export function getCurrentPeopleSoftTaskSignal(): AbortSignal | null {
  return activeTaskSignal;
}

export function abortPeopleSoftTasks(reason: string, predicate?: (task: { owner?: string }) => boolean): void {
  const matches = predicate ?? (() => true);
  cancelQueuedTasks((task) => matches({ owner: task.owner }), reason);
  if (activeTask && matches({ owner: activeTask.owner })) {
    activeTask.controller.abort(new PeopleSoftTaskCancelledError(reason));
  }
}

export function isRetryablePeopleSoftTaskError(error: unknown): boolean {
  return error instanceof PeopleSoftTaskCancelledError;
}

function prepareQueueForTask(task: QueueTask<any>): void {
  if (task.priority === "background") return;

  cancelQueuedTasks(
    (queued) => queued.priority === "background",
    "Background PeopleSoft task canceled because a higher-priority action started."
  );

  if (task.priority === "user") {
    if (activeTask?.priority === "background") {
      activeTask.controller.abort(
        new PeopleSoftTaskCancelledError(
          "Background PeopleSoft task canceled because a user action took priority."
        )
      );
    }
    return;
  }

  cancelQueuedTasks(
    (queued) => queued.priority !== "navigation",
    "PeopleSoft task canceled because navigation took priority."
  );

  if (activeTask && activeTask.priority !== "navigation") {
    activeTask.controller.abort(
      new PeopleSoftTaskCancelledError(
        "PeopleSoft task canceled because navigation took priority."
      )
    );
  }
}

function cancelQueuedTasks(
  predicate: (task: QueueTask<any>) => boolean,
  message: string
): void {
  const kept: QueueTask<any>[] = [];

  for (const task of queue) {
    if (!predicate(task)) {
      kept.push(task);
      continue;
    }

    task.reject(new PeopleSoftTaskCancelledError(message));
  }

  queue = kept;
  resolveIdleIfNeeded();
}

async function pumpQueue(): Promise<void> {
  if (activeTask) return;

  const nextTask = queue.shift();
  if (!nextTask) {
    resolveIdleIfNeeded();
    return;
  }

  if (isPeopleSoftLockedFor(nextTask.owner) && nextTask.priority !== "navigation") {
    nextTask.reject(
      new Error("PeopleSoft requests are paused while term navigation is in progress.")
    );
    resolveIdleIfNeeded();
    void pumpQueue();
    return;
  }

  activeTask = nextTask;
  activeTaskSignal = nextTask.controller.signal;

  try {
    const result = await nextTask.execute();
    nextTask.resolve(result);
  } catch (error) {
    nextTask.reject(error);
  } finally {
    activeTask = null;
    activeTaskSignal = null;
    resolveIdleIfNeeded();
    void pumpQueue();
  }
}

function compareTasks(left: QueueTask<any>, right: QueueTask<any>): number {
  const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  if (priorityDelta !== 0) return priorityDelta;
  return left.id - right.id;
}

function resolveIdleIfNeeded(): void {
  if (activeTask || queue.length > 0) return;
  if (idleResolvers.length === 0) return;

  const resolvers = idleResolvers;
  idleResolvers = [];
  for (const resolve of resolvers) {
    resolve();
  }
}

function readLock(): LockState | null {
  try {
    const raw = window.sessionStorage.getItem(LOCK_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LockState>;
    if (!parsed.owner || typeof parsed.expiresAt !== "number") {
      clearLock();
      return null;
    }

    if (parsed.expiresAt < Date.now()) {
      clearLock();
      return null;
    }

    return { owner: parsed.owner, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeLock(lock: LockState): void {
  try {
    window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch (err) {
    logQuiet("peoplesoft.traffic.writeLock", err);
  }
}

function clearLock(): void {
  try {
    window.sessionStorage.removeItem(LOCK_KEY);
  } catch (err) {
    logQuiet("peoplesoft.traffic.clearLock", err);
  }
}
