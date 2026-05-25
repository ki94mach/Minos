/** Compare patient-tree embeds to master catalog lists (no per-id GET). */

export type CatalogMasterSnapshots = {
  characteristics: Map<string, { name: string; type: string }>;
  treatments: Map<string, { name: string; type: string }>;
  drugs: Map<string, { name: string; strength: number; unit: string }>;
};

function catalogIdString(id: unknown): string | null {
  if (id == null) return null;
  if (typeof id === "object" && id !== null && "$oid" in id) {
    return String((id as { $oid: string }).$oid);
  }
  return String(id);
}

function drugEmbedStale(
  embedded: { _id?: unknown; name?: string; strength?: number; unit?: string },
  masters: CatalogMasterSnapshots
): boolean {
  const id = catalogIdString(embedded._id);
  if (!id) return false;
  const master = masters.drugs.get(id);
  if (!master) return false;
  return (
    (embedded.name ?? "") !== master.name ||
    Number(embedded.strength) !== Number(master.strength) ||
    (embedded.unit ?? "") !== master.unit
  );
}

function regimenDrugsStale(
  regimen: { drugs?: Array<{ drug?: unknown }> } | null | undefined,
  masters: CatalogMasterSnapshots
): boolean {
  for (const entry of regimen?.drugs ?? []) {
    const drug = entry?.drug as
      | { _id?: unknown; name?: string; strength?: number; unit?: string }
      | undefined;
    if (drug && drugEmbedStale(drug, masters)) return true;
  }
  return false;
}

export function buildCatalogMasterSnapshots(
  characteristics: Array<{ _id: string; type: string; name: string }>,
  treatments: Array<{ _id: string; name: string; type: string }>,
  drugs: Array<{ _id: string; name: string; strength: number; unit: string }>
): CatalogMasterSnapshots {
  const characteristicsMap = new Map<string, { name: string; type: string }>();
  for (const c of characteristics) {
    characteristicsMap.set(String(c._id), { name: c.name, type: c.type });
  }

  const treatmentsMap = new Map<string, { name: string; type: string }>();
  for (const t of treatments) {
    treatmentsMap.set(String(t._id), { name: t.name, type: t.type });
  }

  const drugsMap = new Map<
    string,
    { name: string; strength: number; unit: string }
  >();
  for (const d of drugs) {
    drugsMap.set(String(d._id), {
      name: d.name,
      strength: Number(d.strength),
      unit: d.unit,
    });
  }

  return {
    characteristics: characteristicsMap,
    treatments: treatmentsMap,
    drugs: drugsMap,
  };
}

export function isPatientNodeCatalogStale(
  node: any,
  masters: CatalogMasterSnapshots | null | undefined
): boolean {
  if (!masters) return false;

  if (node.node_type === "characteristic" && node.characteristic_data) {
    const id = catalogIdString(node.characteristic_data._id);
    if (!id) return false;
    const master = masters.characteristics.get(id);
    if (!master) return false;
    const embeddedType =
      node.characteristic_data.type ?? node.characteristic_data.char_type ?? "";
    const embeddedName = node.characteristic_data.name ?? "";
    return embeddedName !== master.name || embeddedType !== master.type;
  }

  if (node.node_type === "treatment" && node.treatment_data) {
    const id = catalogIdString(node.treatment_data._id);
    if (!id) return false;
    const master = masters.treatments.get(id);
    if (!master) return false;
    if (
      (node.treatment_data.name ?? "") !== master.name ||
      (node.treatment_data.type ?? "") !== master.type
    ) {
      return true;
    }
    if (regimenDrugsStale(node.treatment_data.regimen, masters)) return true;
    for (const alt of node.treatment_data.alternatives ?? []) {
      if (regimenDrugsStale(alt?.regimen, masters)) return true;
    }
  }

  return false;
}
