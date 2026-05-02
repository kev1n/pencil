export const ACCESS_GATE_NAME_KEY = "better-caesar:access-gate:name:v1";
export const ACCESS_GATE_CODE_KEY = "better-caesar:access-gate:code:v1";

export type StoredName = {
  lastName: string;
  fullName: string;
  fetchedAt: number;
};

export async function readStoredName(): Promise<StoredName | null> {
  const result = (await chrome.storage.local.get(ACCESS_GATE_NAME_KEY)) as Record<string, unknown>;
  const raw = result[ACCESS_GATE_NAME_KEY];
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<StoredName>;
  if (typeof candidate.lastName !== "string" || candidate.lastName.length === 0) return null;
  return {
    lastName: candidate.lastName,
    fullName: typeof candidate.fullName === "string" ? candidate.fullName : candidate.lastName,
    fetchedAt: typeof candidate.fetchedAt === "number" ? candidate.fetchedAt : 0
  };
}

export async function writeStoredName(value: StoredName): Promise<void> {
  await chrome.storage.local.set({ [ACCESS_GATE_NAME_KEY]: value });
}

export async function readStoredCode(): Promise<string | null> {
  const result = (await chrome.storage.local.get(ACCESS_GATE_CODE_KEY)) as Record<string, unknown>;
  const raw = result[ACCESS_GATE_CODE_KEY];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export async function writeStoredCode(code: string): Promise<void> {
  await chrome.storage.local.set({ [ACCESS_GATE_CODE_KEY]: code });
}

export async function clearStoredCode(): Promise<void> {
  await chrome.storage.local.remove(ACCESS_GATE_CODE_KEY);
}
