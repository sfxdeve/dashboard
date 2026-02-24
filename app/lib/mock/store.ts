import {
  createSeedState,
  MOCK_SCHEMA_VERSION,
  type MockState,
} from "~/lib/mock/seed";

let inMemoryState: MockState | null = null;

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getOrCreateState(): MockState {
  if (!inMemoryState || inMemoryState.schemaVersion !== MOCK_SCHEMA_VERSION) {
    inMemoryState = createSeedState();
  }
  return inMemoryState;
}

export function getMockState(): MockState {
  return getOrCreateState();
}

export function replaceMockState(next: MockState) {
  inMemoryState = clone(next);
}

export function updateMockState(
  updater: (current: MockState) => MockState,
): MockState {
  const current = getOrCreateState();
  const next = updater(clone(current));
  inMemoryState = next;
  return inMemoryState;
}

export async function withLatency<T>(value: T, delayMs = 180): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return value;
}

export function nextId(prefix: string) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}
