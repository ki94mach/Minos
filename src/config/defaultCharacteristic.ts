import { listCharacteristics, type CharacteristicItem } from "../api/characteristics";

export type DefaultRootCharacteristic = {
  _id: string;
  char_type: string;
  name: string;
};

export function getDefaultCharType(): string {
  return process.env.REACT_APP_DEFAULT_CHAR_TYPE?.trim() || "Population";
}

export function getDefaultCharName(): string {
  return process.env.REACT_APP_DEFAULT_CHAR_NAME?.trim() || "Iran";
}

let cached: DefaultRootCharacteristic | null = null;

function toRootCharacteristic(item: CharacteristicItem): DefaultRootCharacteristic {
  return {
    _id: item._id,
    char_type: item.type,
    name: item.name,
  };
}

/**
 * Resolve the catalog characteristic used as the overview root patient (F6).
 * Uses REACT_APP_DEFAULT_CHAR_ID when set, otherwise type + name from env.
 */
export async function resolveDefaultRootCharacteristic(): Promise<DefaultRootCharacteristic> {
  if (cached) {
    return cached;
  }

  const chars = await listCharacteristics();
  const envId = process.env.REACT_APP_DEFAULT_CHAR_ID?.trim();

  let match: CharacteristicItem | undefined;
  if (envId) {
    match = chars.find((c) => c._id === envId);
  }
  if (!match) {
    const type = getDefaultCharType();
    const name = getDefaultCharName();
    match = chars.find((c) => c.type === type && c.name === name);
  }

  if (!match) {
    throw new Error(
      `Default root characteristic not found. Seed the catalog (${getDefaultCharType()} / ${getDefaultCharName()}) or set REACT_APP_DEFAULT_CHAR_ID.`
    );
  }

  cached = toRootCharacteristic(match);
  return cached;
}

/** Call after catalog CRUD if the default characteristic may have changed. */
export function clearDefaultRootCharacteristicCache(): void {
  cached = null;
}
