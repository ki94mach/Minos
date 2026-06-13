import Decimal from "decimal.js";
import dagre from "dagre";
import { hashNodeColor } from "../theme/theme";

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

/**
 * Overview preview visibility:
 * - Population is always shown
 * - Every direct Population child is always shown
 * - On branches that reach a PI, show intermediates and stop at PI
 * - Nothing below PI
 */
export function shouldIncludeInOverviewPreview(
  node: any,
  parentIsPopulation: boolean
): boolean {
  if (isPopulationNode(node)) return true;
  if (parentIsPopulation) return true;
  if (isPrimaryIndicationNode(node)) return true;
  return subtreeContainsPrimaryIndication(node);
}

/** Children to recurse into when building the overview preview graph. */
export function getOverviewPreviewChildren(node: any): any[] {
  const children = node.children || [];
  if (children.length === 0) return [];

  if (isPopulationNode(node)) {
    return children;
  }

  if (isPrimaryIndicationNode(node)) {
    return [];
  }

  if (subtreeContainsPrimaryIndication(node)) {
    return children.filter((child: any) =>
      shouldIncludeInOverviewPreview(child, false)
    );
  }

  return [];
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

export function findNodeById(node: any, id: string): any | null {
  const thisId = getUniqueCharId(node);
  if (thisId === id) return node;
  // 1) Check if this node is a “characteristic” and if so, compare its characteristic_data._id
  const charId =
    node.characteristic_data?._id?.$oid || node.characteristic_data?._id;
  // 2) Otherwise, if it’s a “treatment,” compare its treatment_data._id
  const treatId = node.treatment_data?._id?.$oid || node.treatment_data?._id;
  // 3) Finally, compare the node’s own document _id
  const nodeDocId = node._id?.$oid || node._id;

  if (id === charId || id === treatId || id === nodeDocId) {
    return node;
  }
  // 4) If no match yet, recurse into children (if any)
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  // 5) No match in this subtree
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
    const width = isOverview ? 120 : 190;
    const height = isOverview ? 120 : estimateDrillDownNodeHeight(n.data ?? {});
    g.setNode(n.id, { width, height });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const isOverview = n.data?.isOverviewMode === true;
    const width = isOverview ? 120 : 190;
    const height = isOverview ? 120 : estimateDrillDownNodeHeight(n.data ?? {});
    return {
      ...n,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
}