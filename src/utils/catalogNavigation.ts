import { NavigateFunction } from "react-router-dom";
import type { CatalogUsage, CatalogUsageGroup } from "../api/catalog";
import type { CatalogEntityKind } from "../components/catalog/catalogEditSave";
import { hashNodeColor } from "../theme/theme";
import { overviewFlowNodeId } from "./patientTreeUtils";

export interface PatientMapSearchSelection {
  kind: CatalogEntityKind;
  id: string;
  label: string;
  characteristicType?: string;
}

const PRIMARY_INDICATION_TYPE = "Primary Indication";
const POPULATION_TYPE = "Population";

export interface CatalogNavigationState {
  treeId: string;
  color?: string;
  focusNodeDocId?: string;
  focusOverviewNodeId?: string;
}

export interface CatalogNavigationOptions {
  isPopulationCatalogHit?: boolean;
}

export interface CatalogNavigationTarget {
  path: string;
  state: CatalogNavigationState;
}

export function buildCatalogNavigationTarget(
  group: CatalogUsageGroup,
  usage: CatalogUsage,
  options: CatalogNavigationOptions = {}
): CatalogNavigationTarget {
  const treeId = group.patient_id;

  if (options.isPopulationCatalogHit) {
    return {
      path: "/patients",
      state: {
        treeId,
        focusOverviewNodeId: overviewFlowNodeId(
          treeId,
          group.population_catalog_id
        ),
        color: hashNodeColor(group.population_catalog_id),
      },
    };
  }

  if (group.pi_catalog_id) {
    return {
      path: `/patients/${group.pi_catalog_id}`,
      state: {
        treeId,
        focusNodeDocId: usage.node_id,
        color: hashNodeColor(group.pi_catalog_id),
      },
    };
  }

  return {
    path: `/patients/${group.population_catalog_id}`,
    state: {
      treeId,
      focusNodeDocId: usage.node_id,
      color: hashNodeColor(group.population_catalog_id),
    },
  };
}

export function navigateToCatalogUsage(
  navigate: NavigateFunction,
  group: CatalogUsageGroup,
  usage: CatalogUsage,
  options?: CatalogNavigationOptions
): void {
  const { path, state } = buildCatalogNavigationTarget(group, usage, options);
  navigate(path, { state });
}

/** Drill into a PI subtree without focusing a specific node. */
export function buildPrimaryIndicationDrillTarget(
  group: CatalogUsageGroup,
  piCatalogId: string
): CatalogNavigationTarget {
  return {
    path: `/patients/${piCatalogId}`,
    state: {
      treeId: group.patient_id,
      color: hashNodeColor(piCatalogId),
    },
  };
}

export function resolvePatientMapSearchNavigation(
  selection: PatientMapSearchSelection,
  group: CatalogUsageGroup,
  usage: CatalogUsage
): CatalogNavigationTarget {
  if (
    selection.kind === "characteristic" &&
    selection.characteristicType === PRIMARY_INDICATION_TYPE
  ) {
    return buildPrimaryIndicationDrillTarget(group, selection.id);
  }

  if (
    selection.kind === "characteristic" &&
    selection.characteristicType === POPULATION_TYPE
  ) {
    return buildCatalogNavigationTarget(group, usage, {
      isPopulationCatalogHit: true,
    });
  }

  return buildCatalogNavigationTarget(group, usage);
}

export function navigatePatientMapSearchResult(
  navigate: NavigateFunction,
  selection: PatientMapSearchSelection,
  group: CatalogUsageGroup,
  usage: CatalogUsage
): void {
  const { path, state } = resolvePatientMapSearchNavigation(
    selection,
    group,
    usage
  );
  navigate(path, { state });
}
