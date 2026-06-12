import { NavigateFunction } from "react-router-dom";
import type { CatalogUsage, CatalogUsageGroup } from "../api/catalog";
import { hashNodeColor } from "../theme/theme";
import { overviewFlowNodeId } from "./patientTreeUtils";

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
