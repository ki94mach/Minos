import Decimal from "decimal.js";
import dagre from "dagre";
import { hashNodeColor } from "../theme/theme";

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
    const nodeId = getUniqueCharId(node);

    if (nodeId === targetId) {
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
    const height = isOverview ? 120 : 88;
    g.setNode(n.id, { width, height });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const isOverview = n.data?.isOverviewMode === true;
    const width = isOverview ? 120 : 190;
    const height = isOverview ? 120 : 88;
    return {
      ...n,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
}