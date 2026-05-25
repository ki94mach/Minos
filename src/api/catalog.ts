import api from "../api";
import { API_ENDPOINTS } from "./endpoints";

/** GET /api/{characteristics,drugs,treatments}/<id>/references (docs/CATALOG_SYNC.md). */
export interface CatalogReferences {
  patient_ids: string[];
  patient_count: number;
  node_count: number;
  /** Present for drugs when master Treatment documents embed the drug. */
  treatment_count?: number;
}

/** `references` field on 409 DELETE when a catalog row is still in use. */
export interface CatalogDeleteReferences {
  patients: string[];
  nodes: number;
  treatment_count?: number;
}

function normalizeCatalogReferences(data: unknown): CatalogReferences {
  const raw = (data ?? {}) as Record<string, unknown>;
  const refs: CatalogReferences = {
    patient_ids: Array.isArray(raw.patient_ids)
      ? raw.patient_ids.map((id) => String(id))
      : [],
    patient_count: Number(raw.patient_count ?? 0),
    node_count: Number(raw.node_count ?? 0),
  };
  if (raw.treatment_count != null) {
    refs.treatment_count = Number(raw.treatment_count);
  }
  return refs;
}

export async function fetchCharacteristicReferences(
  id: string
): Promise<CatalogReferences> {
  const { data } = await api.get(API_ENDPOINTS.CHARACTERISTIC_REFERENCES(id));
  return normalizeCatalogReferences(data);
}

export async function fetchDrugReferences(id: string): Promise<CatalogReferences> {
  const { data } = await api.get(API_ENDPOINTS.DRUG_REFERENCES(id));
  return normalizeCatalogReferences(data);
}

export async function fetchTreatmentReferences(
  id: string
): Promise<CatalogReferences> {
  const { data } = await api.get(API_ENDPOINTS.TREATMENT_REFERENCES(id));
  return normalizeCatalogReferences(data);
}
