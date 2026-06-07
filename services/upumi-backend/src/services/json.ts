export type JsonObject = Record<string, any>;

export function parseJsonObject(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === 'object') return value as JsonObject;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function stringifyJsonObject(value: unknown) {
  return JSON.stringify(value && typeof value === 'object' ? value : {});
}
