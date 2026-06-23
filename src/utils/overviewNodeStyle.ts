export const POPULATION_CHAR_TYPE = "Population";
export const PRIMARY_INDICATION_CHAR_TYPE = "Primary Indication";

export const OVERVIEW_SEGMENT_SIZE = 120;
export const OVERVIEW_POPULATION_SIZE = 140;
export const OVERVIEW_PI_BORDER_RADIUS = 16;

export type OverviewNodeData = {
  isOverviewMode?: boolean;
  isTreeRoot?: boolean;
  charType?: string | null;
};

export type OverviewNodeShape = "circle" | "roundedSquare";

export function isOverviewPopulationRoot(data: OverviewNodeData | undefined): boolean {
  return (
    data?.isOverviewMode === true &&
    data?.isTreeRoot === true &&
    data?.charType === POPULATION_CHAR_TYPE
  );
}

export function isOverviewPrimaryIndication(
  data: OverviewNodeData | undefined
): boolean {
  return (
    data?.isOverviewMode === true &&
    data?.charType === PRIMARY_INDICATION_CHAR_TYPE
  );
}

export function getOverviewNodeShape(
  data: OverviewNodeData | undefined
): OverviewNodeShape {
  return isOverviewPrimaryIndication(data) ? "roundedSquare" : "circle";
}

export function getOverviewNodeDimensions(
  data: OverviewNodeData | undefined
): { width: number; height: number } {
  const size = isOverviewPopulationRoot(data)
    ? OVERVIEW_POPULATION_SIZE
    : OVERVIEW_SEGMENT_SIZE;
  return { width: size, height: size };
}

/** Soft outer ring for Primary Indication nodes in overview. */
export function overviewPrimaryIndicationRing(accentColor: string): string {
  return `0 0 0 4px color-mix(in srgb, ${accentColor} 28%, transparent)`;
}

/** Compact single-line rate/size for overview nodes, e.g. "12% · 1,234". */
export function formatOverviewStatsLine(rate: string, size: string): string {
  if (rate && size) return `${rate} · ${size}`;
  return rate || size;
}
