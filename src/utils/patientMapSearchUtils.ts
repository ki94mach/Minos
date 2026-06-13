import type { CatalogUsage, CatalogUsageGroup } from "../api/catalog";
import type { CatalogEntityKind } from "../components/catalog/catalogEditSave";
import type { PatientMapSearchSelection } from "./catalogNavigation";

export interface PatientMapSearchOption extends PatientMapSearchSelection {
  group: string;
}

export interface PatientMapUsageEntry {
  group: CatalogUsageGroup;
  usage: CatalogUsage;
  primaryLabel: string;
  secondaryLabel: string;
}

function usageGroupPrimaryLabel(group: CatalogUsageGroup): string {
  return group.pi_name || group.population_name || "Patient tree";
}

export function buildSearchOptions(
  characteristics: Array<{ _id: string; type: string; name: string }>,
  drugs: Array<{ _id: string; name: string }>,
  treatments: Array<{ _id: string; name: string; type?: string }>
): PatientMapSearchOption[] {
  const charOptions: PatientMapSearchOption[] = characteristics.map((c) => ({
    kind: "characteristic" as CatalogEntityKind,
    id: c._id,
    label: c.name,
    characteristicType: c.type,
    group: "Characteristics",
  }));

  const drugOptions: PatientMapSearchOption[] = drugs.map((d) => ({
    kind: "drug" as CatalogEntityKind,
    id: d._id,
    label: d.name,
    group: "Drugs",
  }));

  const treatmentOptions: PatientMapSearchOption[] = treatments.map((t) => ({
    kind: "treatment" as CatalogEntityKind,
    id: t._id,
    label: t.name,
    group: "Treatments",
  }));

  return [...charOptions, ...drugOptions, ...treatmentOptions];
}

export function flattenCatalogUsageGroups(
  groups: CatalogUsageGroup[] | undefined
): PatientMapUsageEntry[] {
  if (!groups?.length) return [];

  return groups.flatMap((group) => {
    const primaryLabel = usageGroupPrimaryLabel(group);
    return group.usages.map((usage) => ({
      group,
      usage,
      primaryLabel,
      secondaryLabel: usage.path_label || usage.label || primaryLabel,
    }));
  });
}

export function countCatalogUsages(groups: CatalogUsageGroup[] | undefined): number {
  if (!groups?.length) return 0;
  return groups.reduce((sum, group) => sum + group.usages.length, 0);
}

export function filterSearchOptions(
  options: PatientMapSearchOption[],
  query: string
): PatientMapSearchOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;

  return options.filter((option) => {
    const haystack = [
      option.label,
      option.characteristicType,
      option.group,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
