/** Compare patient-tree embeds to master catalog lists (no per-id GET). */

export type TreatmentCatalogDetail = {
  name: string;
  type: string;
  regimen?: { drugs?: Array<{ drug?: unknown }> } | null;
  alternatives?: Array<{
    _id?: string;
    name?: string;
    priority?: number;
    ratio?: number;
    regimen?: { drugs?: Array<{ drug?: unknown }> } | null;
  }>;
};

export type CatalogMasterSnapshots = {
  characteristics: Map<string, { name: string; type: string }>;
  treatments: Map<string, { name: string; type: string }>;
  drugs: Map<string, { name: string; strength: number | null; unit: string | null }>;
  treatmentDetails: Map<string, TreatmentCatalogDetail>;
};

function catalogIdString(id: unknown): string | null {
  if (id == null) return null;
  if (typeof id === "object" && id !== null && "$oid" in id) {
    return String((id as { $oid: string }).$oid);
  }
  return String(id);
}

function drugEmbedStale(
  embedded: { _id?: unknown; name?: string; strength?: number | null; unit?: string | null },
  masters: CatalogMasterSnapshots
): boolean {
  const id = catalogIdString(embedded._id);
  if (!id) return false;
  const master = masters.drugs.get(id);
  if (!master) return false;
  return (
    (embedded.name ?? "") !== master.name ||
    (embedded.strength ?? null) !== master.strength ||
    (embedded.unit ?? null) !== (master.unit ?? null)
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

function regimenHasDrugs(
  regimen: { drugs?: Array<{ drug?: unknown }> } | null | undefined
): boolean {
  return (regimen?.drugs?.length ?? 0) > 0;
}

function alternativesHaveRegimenDrugs(
  alternatives: TreatmentCatalogDetail["alternatives"]
): boolean {
  if (!Array.isArray(alternatives)) return false;
  return alternatives.some((alt) => regimenHasDrugs(alt?.regimen));
}

function treatmentEmbedNeedsMasterDrugData(embedded: {
  type?: string;
  regimen?: { drugs?: Array<{ drug?: unknown }> } | null;
  alternatives?: TreatmentCatalogDetail["alternatives"];
}): boolean {
  if (embedded.type === "Alternative") {
    if (!Array.isArray(embedded.alternatives) || embedded.alternatives.length === 0) {
      return true;
    }
    return !alternativesHaveRegimenDrugs(embedded.alternatives);
  }
  if (embedded.type === "Regimen") {
    return !regimenHasDrugs(embedded.regimen);
  }
  return !regimenHasDrugs(embedded.regimen) && !alternativesHaveRegimenDrugs(embedded.alternatives);
}

function mergeAlternativeRegimensFromMaster(
  embeddedAlternatives: NonNullable<TreatmentCatalogDetail["alternatives"]>,
  masterAlternatives: NonNullable<TreatmentCatalogDetail["alternatives"]>
): NonNullable<TreatmentCatalogDetail["alternatives"]> {
  const masterById = new Map(
    masterAlternatives.map((alt) => [String(alt._id), alt])
  );

  return embeddedAlternatives.map((embeddedAlt) => {
    if (regimenHasDrugs(embeddedAlt.regimen)) {
      return embeddedAlt;
    }
    const masterAlt = masterById.get(String(embeddedAlt._id));
    if (!masterAlt?.regimen) {
      return embeddedAlt;
    }
    return {
      ...embeddedAlt,
      regimen: masterAlt.regimen,
    };
  });
}

/** Resolve regimen/alternatives for display, falling back to master catalog data. */
export function resolveTreatmentDisplayPayload(
  embedded: {
    _id?: unknown;
    type?: string;
    regimen?: { drugs?: Array<{ drug?: unknown }> } | null;
    alternatives?: TreatmentCatalogDetail["alternatives"];
  } | null | undefined,
  treatmentDetails: Map<string, TreatmentCatalogDetail> | undefined
): {
  regimen: { drugs?: Array<{ drug?: unknown }> } | null;
  alternatives: NonNullable<TreatmentCatalogDetail["alternatives"]>;
} {
  if (!embedded) {
    return { regimen: null, alternatives: [] };
  }

  const master = (() => {
    const id = catalogIdString(embedded._id);
    return id && treatmentDetails ? treatmentDetails.get(id) : undefined;
  })();

  let regimen = embedded.regimen ?? null;
  let alternatives = embedded.alternatives ?? [];

  if (!master) {
    return { regimen, alternatives };
  }

  if (embedded.type === "Regimen" && !regimenHasDrugs(regimen) && master.regimen) {
    regimen = master.regimen;
  }

  if (embedded.type === "Alternative") {
    if (!alternatives.length && master.alternatives?.length) {
      alternatives = master.alternatives;
    } else if (alternatives.length && master.alternatives?.length) {
      alternatives = mergeAlternativeRegimensFromMaster(
        alternatives,
        master.alternatives
      );
    }
  } else if (treatmentEmbedNeedsMasterDrugData(embedded) && master.alternatives?.length) {
    alternatives = master.alternatives;
  }

  return { regimen, alternatives };
}

export function buildCatalogMasterSnapshots(
  characteristics: Array<{ _id: string; type: string; name: string }>,
  treatments: Array<{
    _id: string;
    name: string;
    type: string;
    regimen?: TreatmentCatalogDetail["regimen"];
    alternatives?: TreatmentCatalogDetail["alternatives"];
  }>,
  drugs: Array<{ _id: string; name: string; strength?: number | null; unit?: string | null }>
): CatalogMasterSnapshots {
  const characteristicsMap = new Map<string, { name: string; type: string }>();
  for (const c of characteristics) {
    characteristicsMap.set(String(c._id), { name: c.name, type: c.type });
  }

  const treatmentsMap = new Map<string, { name: string; type: string }>();
  const treatmentDetails = new Map<string, TreatmentCatalogDetail>();
  for (const t of treatments) {
    treatmentsMap.set(String(t._id), { name: t.name, type: t.type });
    treatmentDetails.set(String(t._id), {
      name: t.name,
      type: t.type,
      regimen: t.regimen ?? null,
      alternatives: t.alternatives ?? [],
    });
  }

  const drugsMap = new Map<
    string,
    { name: string; strength: number | null; unit: string | null }
  >();
  for (const d of drugs) {
    drugsMap.set(String(d._id), {
      name: d.name,
      strength: d.strength == null ? null : Number(d.strength),
      unit: d.unit == null || String(d.unit).trim() === "" ? null : d.unit,
    });
  }

  return {
    characteristics: characteristicsMap,
    treatments: treatmentsMap,
    drugs: drugsMap,
    treatmentDetails,
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
