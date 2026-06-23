import { formatDrugStrengthUnit } from "./drugFormat";

export type TreatmentCatalogType = "Treatment" | "Regimen" | "Alternative" | string;

export interface RegimenDrugRow {
  name: string;
  strengthUnit: string;
  annualConsumption: number | null;
}

export interface RegimenSection {
  kind: "regimen" | "alternative" | "empty";
  title: string;
  priority?: number;
  evidence_level?: string;
  ratio?: number;
  drugs: RegimenDrugRow[];
  emptyMessage?: string;
}

type RegimenDrugEntry = {
  drug?: {
    name?: string;
    strength?: number | null;
    unit?: string | null;
  };
  annual_patient_con?: number | null;
};

type RegimenPayload = {
  drugs?: RegimenDrugEntry[];
} | null | undefined;

type AlternativePayload = {
  _id?: string;
  name?: string;
  priority?: number;
  evidence_level?: string;
  ratio?: number;
  regimen?: RegimenPayload;
};

function compareAlternatives(
  a: AlternativePayload,
  b: AlternativePayload
): number {
  return (
    (a.priority ?? Number.MAX_SAFE_INTEGER) -
      (b.priority ?? Number.MAX_SAFE_INTEGER) ||
    String(a.name ?? "").localeCompare(String(b.name ?? ""))
  );
}

function mapRegimenDrugs(regimen: RegimenPayload): RegimenDrugRow[] {
  const drugs = regimen?.drugs;
  if (!Array.isArray(drugs)) return [];

  return drugs
    .map((entry) => {
      const name = entry.drug?.name;
      if (!name) return null;
      return {
        name,
        strengthUnit: formatDrugStrengthUnit(
          entry.drug?.strength,
          entry.drug?.unit
        ),
        annualConsumption:
          entry.annual_patient_con != null
            ? Number(entry.annual_patient_con)
            : null,
      };
    })
    .filter((row): row is RegimenDrugRow => row != null);
}

export function buildTreatmentRegimenSections(
  treatmentCatalogType: TreatmentCatalogType | null | undefined,
  regimen: RegimenPayload,
  alternatives: AlternativePayload[] | null | undefined
): RegimenSection[] {
  const catalogType = treatmentCatalogType ?? "Treatment";

  if (catalogType === "Alternative") {
    const sorted = Array.isArray(alternatives)
      ? [...alternatives].sort(compareAlternatives)
      : [];

    if (sorted.length === 0) {
      return [
        {
          kind: "empty",
          title: "Alternatives",
          drugs: [],
          emptyMessage: "No alternatives defined.",
        },
      ];
    }

    return sorted.map((alt) => ({
      kind: "alternative" as const,
      title: alt.name || "Alternative",
      priority: alt.priority,
      evidence_level: alt.evidence_level,
      ratio: alt.ratio,
      drugs: mapRegimenDrugs(alt.regimen),
    }));
  }

  if (catalogType === "Regimen") {
    const drugs = mapRegimenDrugs(regimen);
    if (drugs.length === 0) {
      return [
        {
          kind: "empty",
          title: "Regimen",
          drugs: [],
          emptyMessage: "No drugs in regimen.",
        },
      ];
    }
    return [{ kind: "regimen", title: "Regimen", drugs }];
  }

  return [
    {
      kind: "empty",
      title: "Treatment",
      drugs: [],
      emptyMessage: "No regimen or alternatives defined.",
    },
  ];
}
