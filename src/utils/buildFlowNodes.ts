import Decimal from "decimal.js";
import { makePatientTreeEdge } from "./flowLayoutUtils";
import { Edge } from "reactflow";
import { NavigateFunction } from "react-router-dom";
import {
  type CatalogMasterSnapshots,
  isPatientNodeCatalogStale,
  resolveTreatmentDisplayPayload,
} from "./catalogStale";
import {
  canDrillDownPatientNode,
  getEmbeddedCharType,
  getOverviewPreviewChildren,
  isPopulationNode,
  isPrimaryIndicationNode,
  overviewNodeDocId,
  shouldIncludeInOverviewPreview,
  type OverviewViewMode,
} from "./patientTreeUtils";

export type BuildFlowNodesDeps = {
  selectedRootId: string | null;
  isOverviewMode: boolean;
  overviewViewMode: OverviewViewMode;
  edgeSet: Set<string>;
  nodesById: Map<string, any>;
  edges: Edge[];
  hashColor: (str: string) => string;
  getUniqueCharId: (node: any) => string;
  navigate: NavigateFunction;
  depthLimit: number;
  catalogMasters?: CatalogMasterSnapshots | null;
};

function getNodeCatalogId(node: any): string {
  return (
    node.characteristic_data?._id?.$oid ||
    node.characteristic_data?._id ||
    node.treatment_data?._id?.$oid ||
    node.treatment_data?._id ||
    node.followup_data?._id?.$oid ||
    node.followup_data?._id ||
    node._id?.$oid ||
    node._id
  );
}

function addOverviewFlowNode(
  node: any,
  treeId: string,
  nodeSize: number,
  deps: BuildFlowNodesDeps,
  options?: { overviewPopulationLabel?: string; displayRate?: number }
): string {
  const { isOverviewMode, nodesById, hashColor, navigate, catalogMasters } =
    deps;
  const catalogId = getNodeCatalogId(node);
  const flowNodeId = overviewNodeDocId(node);
  const charType = getEmbeddedCharType(node) ?? null;
  const canDrillDown = canDrillDownPatientNode(node, isOverviewMode, null);

  if (!nodesById.has(flowNodeId)) {
    const treatmentDisplay =
      node.node_type === "treatment"
        ? resolveTreatmentDisplayPayload(
            node.treatment_data,
            catalogMasters?.treatmentDetails
          )
        : { regimen: null, alternatives: [] };

    nodesById.set(flowNodeId, {
      id: flowNodeId,
      position: { x: 0, y: 0 },
      type: "custom",
      data: {
        label:
          node.characteristic_data?.name ||
          node.treatment_data?.name ||
          (node.node_type === "followup" ? "Follow-up" : "Node"),
        type: node.node_type,
        docId: node._id?.$oid || node._id,
        catalogId,
        parentDocId: node.parent_id?._id?.$oid || node.parent_id || null,
        charType,
        measureType: node.characteristic_data?.measure_type,
        measureYears: node.characteristic_data?.measure_years,
        size: nodeSize,
        rate: options?.displayRate ?? node.rate ?? 1,
        drugs:
          treatmentDisplay.regimen?.drugs?.map((d: any) => d.drug) || [],
        regimen: treatmentDisplay.regimen,
        alternatives: treatmentDisplay.alternatives,
        treatmentCatalogType: node.treatment_data?.type ?? null,
        color: hashColor(catalogId),
        hasDescription: Boolean(
          node.description && String(node.description).trim().length > 0
        ),
        refCount: Array.isArray(node.references) ? node.references.length : 0,
        isOverviewMode,
        treeId,
        isOverview: isOverviewMode,
        isTreeRoot: false,
        canDrillDown,
        catalogStale: isPatientNodeCatalogStale(node, catalogMasters),
        overviewPopulationLabel: options?.overviewPopulationLabel,
        onClick: canDrillDown
          ? () =>
              navigate(`/patients/${catalogId}`, {
                state: { color: hashColor(catalogId), treeId },
              })
          : undefined,
      },
    });
  }

  return flowNodeId;
}

function walkPrimaryIndicationOverview(
  node: any,
  parentSize: Decimal,
  populationSize: Decimal,
  isTreeRoot: boolean,
  treeId: string,
  overviewPopulationLabel: string,
  deps: BuildFlowNodesDeps,
  collectedIds: string[]
): void {
  let rawSize: Decimal;
  if (isTreeRoot) {
    rawSize = new Decimal(
      Number.isFinite(parentSize)
        ? parentSize
        : typeof node.size === "number"
          ? node.size
          : 1
    );
  } else {
    rawSize = new Decimal(parentSize).times(node.rate ?? 1);
  }

  if (isPrimaryIndicationNode(node)) {
    const displayRate = populationSize.isZero()
      ? Number(node.rate ?? 1)
      : rawSize.div(populationSize).toNumber();
    const flowNodeId = addOverviewFlowNode(
      node,
      treeId,
      rawSize.toNumber(),
      deps,
      { overviewPopulationLabel, displayRate }
    );
    collectedIds.push(flowNodeId);
    return;
  }

  for (const child of node.children || []) {
    walkPrimaryIndicationOverview(
      child,
      rawSize,
      populationSize,
      false,
      treeId,
      overviewPopulationLabel,
      deps,
      collectedIds
    );
  }
}

/** Collect PI-only overview nodes for one patient tree (no edges). */
export function collectPrimaryIndicationOverviewNodes(
  rootNode: any,
  treeId: string,
  parentSize: Decimal,
  deps: BuildFlowNodesDeps
): string[] {
  const overviewPopulationLabel =
    rootNode.characteristic_data?.name || "Population";
  const populationSize = new Decimal(
    Number.isFinite(parentSize)
      ? parentSize
      : typeof rootNode.size === "number"
        ? rootNode.size
        : 1
  );
  const collectedIds: string[] = [];
  walkPrimaryIndicationOverview(
    rootNode,
    parentSize,
    populationSize,
    true,
    treeId,
    overviewPopulationLabel,
    deps,
    collectedIds
  );
  return collectedIds;
}

export function buildFlowNodes(
  node: any,
  depth: number,
  index: number,
  parentId: string | null = null,
  parentSize: Decimal,
  siblingsCount: number,
  inheritedColor: string,
  treeId: string,
  parentCharType: string | null = null,
  deps: BuildFlowNodesDeps,
  parentIsPopulation = false
): void {
  const {
    selectedRootId,
    isOverviewMode,
    overviewViewMode,
    edgeSet,
    nodesById,
    edges,
    hashColor,
    navigate,
    depthLimit,
  } = deps;

  if (depth > depthLimit) return;

  if (isOverviewMode && overviewViewMode === "primaryIndication") {
    return;
  }

  if (
    isOverviewMode &&
    overviewViewMode === "path" &&
    !shouldIncludeInOverviewPreview(node, parentIsPopulation)
  ) {
    return;
  }

  // Catalog id (characteristic/treatment/followup reference) — shared across trees in overview.
  const catalogId = getNodeCatalogId(node);

  const flowNodeId = overviewNodeDocId(node);

  const thisCharType = getEmbeddedCharType(node) ?? null;
  const childParentIsPopulation = isOverviewMode && isPopulationNode(node);

  // ──────────────────────────────────────────────────
  // E) Compute “rawSize” based on whether this is a top‐level root or a descendant:

  const nodeRate = node.rate ?? 1;

  let rawSize: Decimal;
  if (parentId == null) {
    rawSize = new Decimal(
      Number.isFinite(parentSize)
        ? parentSize
        : typeof node.size === "number"
        ? node.size
        : 1
    );
  } else {
    rawSize = new Decimal(parentSize).times(nodeRate);
  }
  const nodeSize = rawSize.toNumber();
  const charType = thisCharType;
  const canDrillDown = canDrillDownPatientNode(
    node,
    isOverviewMode,
    parentCharType
  );

  // ──────────────────────────────────────────────────
  // F) Create the React-Flow node object once:
  const isNewNode = !nodesById.has(flowNodeId);
  if (isNewNode) {
    const treatmentDisplay =
      node.node_type === "treatment"
        ? resolveTreatmentDisplayPayload(
            node.treatment_data,
            deps.catalogMasters?.treatmentDetails
          )
        : { regimen: null, alternatives: [] };

    nodesById.set(flowNodeId, {
      id: flowNodeId,
      position: { x: 0, y: 0 }, // we will re‐position later
      type: "custom",
      data: {
        label:
          node.characteristic_data?.name ||
          node.treatment_data?.name ||
          (node.node_type === "followup" ? "Follow-up" : "Node"),
        type: node.node_type,
        docId: node._id?.$oid || node._id,
        catalogId,
        parentDocId: node.parent_id?._id?.$oid || node.parent_id || null,
        charType,
        measureType: node.characteristic_data?.measure_type,
        measureYears: node.characteristic_data?.measure_years,
        size: nodeSize,
        rate: node.rate ?? 1,
        drugs:
          treatmentDisplay.regimen?.drugs?.map((d: any) => d.drug) || [],
        regimen: treatmentDisplay.regimen,
        alternatives: treatmentDisplay.alternatives,
        treatmentCatalogType: node.treatment_data?.type ?? null,
        color: hashColor(catalogId),
        hasDescription: Boolean(
          node.description && String(node.description).trim().length > 0
        ),
        refCount: Array.isArray(node.references) ? node.references.length : 0,
        isOverviewMode: isOverviewMode,
        treeId,
        isOverview: isOverviewMode,
        // Population roots in overview only — not the PI subtree root when drilled in.
        isTreeRoot: isOverviewMode && parentId === null && depth === 0,
        canDrillDown,
        catalogStale: isPatientNodeCatalogStale(node, deps.catalogMasters),
        onClick: canDrillDown
          ? () =>
              navigate(`/patients/${catalogId}`, {
                state: { color: hashColor(catalogId), treeId: treeId },
              })
          : undefined,
      },
    });
  }

  // ──────────────────────────────────────────────────
  // G) Always add an edge parent→this node if needed:
  if (parentId) {
    const edgeId = `${parentId}->${flowNodeId}`;
    if (!edgeSet.has(edgeId)) {
      edges.push(makePatientTreeEdge(parentId, flowNodeId, edgeId));
      edgeSet.add(edgeId);
    }
  }

  const isPrimary = isPrimaryIndicationNode(node);
  if (isOverviewMode && isPrimary) {
    return;
  }

  const kids = isOverviewMode
    ? getOverviewPreviewChildren(node)
    : node.children || [];

  kids.forEach((child: any, i: number) =>
    buildFlowNodes(
      child,
      depth + 1,
      i,
      flowNodeId,
      rawSize,
      kids.length,
      inheritedColor,
      treeId,
      charType ?? null,
      deps,
      childParentIsPopulation
    )
  );
}
