import Decimal from "decimal.js";
import { makePatientTreeEdge } from "./flowLayoutUtils";
import { Edge } from "reactflow";
import { NavigateFunction } from "react-router-dom";
import {
  type CatalogMasterSnapshots,
  isPatientNodeCatalogStale,
} from "./catalogStale";
import {
  canDrillDownPatientNode,
  getEmbeddedCharType,
} from "./patientTreeUtils";

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
  deps: {
    selectedRootId: string | null;
    isOverviewMode: boolean;
    visited: Set<string>;
    edgeSet: Set<string>;
    nodesById: Map<string, any>;
    edges: Edge[];
    hashColor: (str: string) => string;
    getUniqueCharId: (node: any) => string;
    treeIdMap: Map<string, string>;
    navigate: NavigateFunction;
    depthLimit: number;
    catalogMasters?: CatalogMasterSnapshots | null;
  }
): void {
  const {
    selectedRootId,
    isOverviewMode,
    visited,
    edgeSet,
    nodesById,
    edges,
    hashColor,
    treeIdMap,
    navigate,
    depthLimit,
  } = deps;

  if (depth > depthLimit) return;

  // Catalog id (characteristic/treatment/followup reference) — shared across trees in overview.
  const catalogId =
    node.characteristic_data?._id?.$oid ||
    node.characteristic_data?._id ||
    node.treatment_data?._id?.$oid ||
    node.treatment_data?._id ||
    node.followup_data?._id?.$oid ||
    node.followup_data?._id ||
    node._id?.$oid ||
    node._id;

  // Overview: one React-Flow node per catalog entity. Drill-down: one node per tree instance.
  const flowNodeId = isOverviewMode
    ? catalogId
    : node._id?.$oid || node._id;

  // ──────────────────────────────────────────────────
  // Overview only: merge duplicate catalog ids (e.g. same Population across patients).
  if (isOverviewMode && visited.has(catalogId)) {
    if (parentId) {
      const edgeId = `${parentId}->${flowNodeId}`;
      if (!edgeSet.has(edgeId)) {
        edges.push(makePatientTreeEdge(parentId, flowNodeId, edgeId));
        edgeSet.add(edgeId);
      }
    }

    const kids = node.children || [];
    const thisCharType = getEmbeddedCharType(node) ?? null;
    kids.forEach((child: any, i: number) =>
      buildFlowNodes(
        child,
        depth + 1,
        i,
        flowNodeId,
        new Decimal(parentSize).times(node.rate ?? 1),
        kids.length,
        inheritedColor,
        treeId,
        thisCharType,
        deps
      )
    );
    return;
  }

  if (isOverviewMode) {
    visited.add(catalogId);
  }

  // Drill-in URL uses catalog id; skip unrelated roots at depth 0.
  if (selectedRootId && depth === 0 && catalogId !== selectedRootId) {
    return;
  }

  // ──────────────────────────────────────────────────
  // E) Compute “rawSize” based on whether this is a top‐level root or a descendant:

  const nodeRate = node.rate ?? 1;

  let rawSize: Decimal;
  if (depth === 0 && selectedRootId) {
    rawSize = parentSize;
  } else if (parentId == null) {
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
  const charType = getEmbeddedCharType(node);
  const canDrillDown = canDrillDownPatientNode(
    node,
    isOverviewMode,
    parentCharType
  );

  // ──────────────────────────────────────────────────
  // F) Create the React-Flow node object once:
  const isNewNode = !nodesById.has(flowNodeId);
  if (isNewNode) {
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
        size: nodeSize,
        rate: node.rate ?? 1,
        drugs:
          node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) || [],
        regimen: node.treatment_data?.regimen || null,
        alternatives: node.treatment_data?.alternatives || [],
        color: hashColor(catalogId),
        isOverviewMode: isOverviewMode,
        treeId: isOverviewMode ? treeIdMap.get(catalogId) : treeId,
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

  function containsPrimaryIndication(node: any): boolean {
    if (getEmbeddedCharType(node) === "Primary Indication") return true;
    return (node.children || []).some(containsPrimaryIndication);
  }

  function shouldRenderNode(node: any, isOverviewMode: boolean): boolean {
    if (!isOverviewMode) return true;
    const charType = getEmbeddedCharType(node);
    // Overview centers on Population roots (e.g. Iran) plus Primary Indication branches.
    if (charType === "Population") return true;
    if (charType === "Primary Indication") return true;
    return containsPrimaryIndication(node);
  }

  if (!shouldRenderNode(node, isOverviewMode)) return;
  const isPrimary = getEmbeddedCharType(node) === "Primary Indication";
  if (!(isOverviewMode && isPrimary)) {
    const kids = (node.children || []).filter((child: any) =>
      shouldRenderNode(child, isOverviewMode)
    );
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
        deps
      )
    );
  }
};
