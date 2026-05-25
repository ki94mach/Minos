import {
  fetchCharacteristicReferences,
  fetchDrugReferences,
  fetchTreatmentReferences,
  type CatalogReferences,
} from "../../api/catalog";

export type CatalogEntityKind = "characteristic" | "drug" | "treatment";

export interface CatalogPutSyncResult {
  patients_updated?: number;
  treatments_updated?: number;
}

const ENTITY_LABEL: Record<CatalogEntityKind, string> = {
  characteristic: "characteristic",
  drug: "drug",
  treatment: "treatment",
};

const FETCH_REFERENCES: Record<
  CatalogEntityKind,
  (id: string) => Promise<CatalogReferences>
> = {
  characteristic: fetchCharacteristicReferences,
  drug: fetchDrugReferences,
  treatment: fetchTreatmentReferences,
};

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

export function catalogSaveNeedsConfirm(
  refs: CatalogReferences,
  kind: CatalogEntityKind
): boolean {
  if (refs.patient_count > 0) return true;
  if (kind === "drug" && (refs.treatment_count ?? 0) > 0) return true;
  return false;
}

export function buildCatalogSaveConfirmMessage(
  refs: CatalogReferences,
  kind: CatalogEntityKind
): string {
  const label = ENTITY_LABEL[kind];
  const parts: string[] = [];

  if (refs.patient_count > 0) {
    const nodeDetail =
      refs.node_count > 0
        ? ` (${refs.node_count} ${plural(refs.node_count, "node")})`
        : "";
    parts.push(
      `${refs.patient_count} patient ${plural(refs.patient_count, "tree")}${nodeDetail}`
    );
  }

  const treatmentCount = refs.treatment_count ?? 0;
  if (kind === "drug" && treatmentCount > 0) {
    parts.push(
      `${treatmentCount} master ${plural(treatmentCount, "treatment")}`
    );
  }

  const where =
    parts.length > 0 ? parts.join(" and ") : "catalog data";
  return `This ${label} is referenced in ${where}. Saving will update embedded copies. Continue?`;
}

/** Fetch references and prompt when saves would propagate to embeds. */
export async function confirmCatalogEditSave(
  editingId: string,
  kind: CatalogEntityKind
): Promise<boolean> {
  const refs = await FETCH_REFERENCES[kind](editingId);
  if (!catalogSaveNeedsConfirm(refs, kind)) return true;
  return window.confirm(buildCatalogSaveConfirmMessage(refs, kind));
}

export function formatCatalogPutSuccess(
  baseMessage: string,
  data: unknown,
  kind: CatalogEntityKind
): string {
  const sync = (data ?? {}) as CatalogPutSyncResult;
  let message = baseMessage;

  if (sync.patients_updated != null) {
    message += ` ${sync.patients_updated} patient ${plural(sync.patients_updated, "tree")} updated.`;
  }
  if (kind === "drug" && sync.treatments_updated != null) {
    message += ` ${sync.treatments_updated} master ${plural(sync.treatments_updated, "treatment")} updated.`;
  }

  return message;
}
