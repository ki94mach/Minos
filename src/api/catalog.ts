import api from "../api";
import { API_ENDPOINTS } from "./endpoints";

export interface CatalogUsage {
  node_id: string;
  node_type: string;
  label: string;
  path_label: string;
}

export interface CatalogUsageGroup {
  patient_id: string;
  population_catalog_id: string;
  population_name: string;
  pi_catalog_id?: string;
  pi_name?: string;
  usage_count: number;
  usages: CatalogUsage[];
}

/** GET /api/{characteristics,drugs,treatments}/<id>/references (docs/CATALOG_SYNC.md). */
export interface CatalogReferences {
  patient_ids: string[];
  patient_count: number;
  node_count: number;
  /** Present for drugs when master Treatment documents embed the drug. */
  treatment_count?: number;
  groups?: CatalogUsageGroup[];
}

/** `references` field on 409 DELETE when a catalog row is still in use. */
export interface CatalogDeleteReferences {
  patients: string[];
  nodes: number;
  treatment_count?: number;
}

function normalizeCatalogUsage(raw: unknown): CatalogUsage {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    node_id: String(u.node_id ?? ""),
    node_type: String(u.node_type ?? ""),
    label: String(u.label ?? ""),
    path_label: String(u.path_label ?? ""),
  };
}

function normalizeCatalogUsageGroup(raw: unknown): CatalogUsageGroup {
  const g = (raw ?? {}) as Record<string, unknown>;
  const group: CatalogUsageGroup = {
    patient_id: String(g.patient_id ?? ""),
    population_catalog_id: String(g.population_catalog_id ?? ""),
    population_name: String(g.population_name ?? ""),
    usage_count: Number(g.usage_count ?? 0),
    usages: Array.isArray(g.usages)
      ? g.usages.map(normalizeCatalogUsage)
      : [],
  };
  if (g.pi_catalog_id != null) {
    group.pi_catalog_id = String(g.pi_catalog_id);
  }
  if (g.pi_name != null) {
    group.pi_name = String(g.pi_name);
  }
  return group;
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
  if (Array.isArray(raw.groups)) {
    refs.groups = raw.groups.map(normalizeCatalogUsageGroup);
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
