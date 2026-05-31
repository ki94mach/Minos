/** Format drug strength + unit; omits unset parts. */
export function formatDrugStrengthUnit(
  strength: number | null | undefined,
  unit: string | null | undefined
): string {
  const hasStrength = strength != null && !Number.isNaN(Number(strength));
  const hasUnit = unit != null && String(unit).trim() !== "";

  if (hasStrength && hasUnit) return `${strength} ${unit}`;
  if (hasStrength) return String(strength);
  if (hasUnit) return String(unit);
  return "";
}

export function formatDrugLabel(
  name: string,
  strength: number | null | undefined,
  unit: string | null | undefined
): string {
  const detail = formatDrugStrengthUnit(strength, unit);
  return detail ? `${name} - ${detail}` : name;
}
