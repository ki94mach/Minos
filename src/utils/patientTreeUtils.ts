import Decimal from "decimal.js";
import dagre from "dagre";
import { hashNodeColor } from "../theme/theme";
import { getOverviewNodeDimensions } from "./overviewNodeStyle";

export function getEmbeddedCharType(node: any): string | undefined {
  return node.characteristic_data?.type ?? node.characteristic_data?.char_type;
}

export function isPrimaryIndicationNode(node: any): boolean {
  return getEmbeddedCharType(node) === "Primary Indication";
}

/** True when this node or any descendant is a Primary Indication. */
export function subtreeContainsPrimaryIndication(node: any): boolean {
  if (isPrimaryIndicationNode(node)) return true;
  return (node.children || []).some(subtreeContainsPrimaryIndication);
}

export function isPopulationNode(node: any): boolean {
  return getEmbeddedCharType(node) === "Population";
}

export type OverviewViewMode = "path" | "primaryIndication";

export function shouldIncludeInPrimaryIndicationOverview(node: any): boolean {
  return isPrimaryIndicationNode(node);
}

/**
 * Overview preview visibility:
 * - Show every branch from Population down to Primary Indication (inclusive)
 * - Nothing below Primary Indication
 */
export function shouldIncludeInOverviewPreview(_node: any): boolean {
  return true;
}

/** Children to recurse into when building the overview preview graph. */
export function getOverviewPreviewChildren(node: any): any[] {
  if (isPrimaryIndicationNode(node)) {
    return [];
  }
  return node.children || [];
}

/** Overview drill-down: any visible Primary Indication node. */
export function canDrillDownPatientNode(
  node: any,
  isOverviewMode: boolean,
  _parentCharType: string | null | undefined
): boolean {
  if (!isOverviewMode) return false;
  return isPrimaryIndicationNode(node);
}

export function getUniqueCharId(node: any): string {
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

/** Overview React-Flow id scoped to one patient tree (avoids cross-tree merge). */
export function overviewFlowNodeId(treeId: string, catalogId: string): string {
  return `${treeId}:${catalogId}`;
}

export function patientIdFromOverviewFlowNodeId(flowNodeId: string): string | null {
  const sep = flowNodeId.indexOf(":");
  return sep > 0 ? flowNodeId.slice(0, sep) : null;
}

export function overviewNodeDocId(node: any): string {
  return String(node._id?.$oid || node._id);
}

/** Resolve legacy `treeId:catalogId` focus targets to a document-based flow node id. */
export function resolveOverviewFocusFlowNodeId(
  focusOverviewNodeId: string,
  nodes: { id: string; data?: { treeId?: string; catalogId?: string } }[]
): string {
  const patientId = patientIdFromOverviewFlowNodeId(focusOverviewNodeId);
  if (!patientId) {
    return focusOverviewNodeId;
  }
  const catalogId = focusOverviewNodeId.slice(focusOverviewNodeId.indexOf(":") + 1);
  const match = nodes.find(
    (node) =>
      String(node.data?.treeId) === String(patientId) &&
      String(node.data?.catalogId) === String(catalogId)
  );
  return match?.id ?? focusOverviewNodeId;
}

/** Patient documents whose embedded tree root is this population catalog entry. */
export function listPatientsWithPopulationRoot(
  patients: any[],
  populationCatalogId: string
): any[] {
  return patients.filter((patient) => {
    const root = patient?.tree;
    if (!root) return false;
    return (
      isPopulationNode(root) &&
      String(getUniqueCharId(root)) === String(populationCatalogId)
    );
  });
}

function nodeDocId(node: any): string | undefined {
  const id = node._id?.$oid || node._id;
  return id != null ? String(id) : undefined;
}

/** Prefer explicit focus doc id over URL param for unambiguous drill targets. */
export function getDrillTargetId(
  urlRootId: string | null,
  focusNodeDocId?: string
): string | null {
  return focusNodeDocId ?? urlRootId;
}

/** Find a tree node by embedded document _id only (not catalog reference). */
export function findNodeByDocId(node: any, docId: string): any | null {
  if (nodeDocId(node) === String(docId)) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeByDocId(child, docId);
    if (found) return found;
  }
  return null;
}

/** Find drill target by document id first, then legacy catalog/id match. */
export function findDrillTargetInTree(root: any, targetId: string): any | null {
  return findNodeByDocId(root, targetId) ?? findNodeById(root, targetId);
}

function nodeMatchesId(node: any, id: string): boolean {
  if (getUniqueCharId(node) === id) return true;
  const charId =
    node.characteristic_data?._id?.$oid || node.characteristic_data?._id;
  const treatId = node.treatment_data?._id?.$oid || node.treatment_data?._id;
  const docId = node._id?.$oid || node._id;
  return id === charId || id === treatId || id === docId;
}

/** Root-to-target chain inclusive; null when target is not in this tree. */
export function findPathToNode(root: any, targetId: string): any[] | null {
  if (nodeMatchesId(root, targetId)) return [root];
  for (const child of root.children || []) {
    const childPath = findPathToNode(child, targetId);
    if (childPath) return [root, ...childPath];
  }
  return null;
}

/**
 * Drill-down view: population root through ancestors on the target path only,
 * with the target's full descendant subtree. Sibling branches are omitted.
 */
export function buildDrillDownViewTree(
  root: any,
  targetId: string
): any | null {
  const path = findPathToNode(root, targetId);
  if (!path || path.length === 0) return null;

  let pruned = path[path.length - 1];
  for (let i = path.length - 2; i >= 0; i--) {
    pruned = { ...path[i], children: [pruned] };
  }
  return pruned;
}

export function findNodeById(node: any, id: string): any | null {
  if (nodeMatchesId(node, id)) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function calculateSizeFromTree(
  tree: any,
  targetId: string
): Decimal | null {
  // (1) We now pass around a `Decimal` object instead of a plain number
  const dfs = (node: any, acc: Decimal): Decimal | null => {
    const catalogId = getUniqueCharId(node);
    const docId = nodeDocId(node);

    if (targetId === catalogId || (docId != null && targetId === docId)) {
      return acc;
    }

    if (!node.children) return null;

    for (const child of node.children) {
      // Multiply the Decimal `acc` by the child’s rate (wrapped in Decimal)
      const rateDecimal = new Decimal(
        typeof child.rate === "number" ? child.rate : 1
      );
      const nextAcc = acc.mul(rateDecimal);
      const result = dfs(child, nextAcc);
      if (result !== null) return result;
    }
    return null;
  };

  // (2) Initialize with the root’s size as a Decimal
  const rootSizeDecimal = new Decimal(
    typeof tree.size === "number" ? tree.size : 1
  );

  return dfs(tree, rootSizeDecimal);
}

export function hashColor(str: string): string {
  return hashNodeColor(str);
}

export function estimateDrillDownNodeHeight(nodeData: { type?: string }): number {
  if (nodeData.type === "treatment") return 148;
  return 120;
}

export function applyDagreLayout(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    ranksep: 90,
    nodesep: 70,
    edgesep: 24,
    ranker: "network-simplex",
  });

  nodes.forEach((n) => {
    const isOverview = n.data?.isOverviewMode === true;
    const { width, height } = isOverview
      ? getOverviewNodeDimensions(n.data)
      : { width: 190, height: estimateDrillDownNodeHeight(n.data ?? {}) };
    g.setNode(n.id, { width, height });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const isOverview = n.data?.isOverviewMode === true;
    const { width, height } = isOverview
      ? getOverviewNodeDimensions(n.data)
      : { width: 190, height: estimateDrillDownNodeHeight(n.data ?? {}) };
    return {
      ...n,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
}