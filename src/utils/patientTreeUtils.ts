import Decimal from "decimal.js";
import dagre from "dagre";

export function getStableNodeId(node: any): string {
  return (
    node.characteristic_data?._id?.$oid ||
    node.treatment_data?._id?.$oid ||
    node._id?.$oid ||
    node._id
  );
}
export function getDocId(node: any): string {
  const id = node._id?.$oid || node._id;
  if (!id) {
    console.warn("❌ getDocId failed for node:", node);
    throw new Error("Node is missing _id");
  }
  return id;
}

export function findNodeById(node: any, id: string): any | null {
  const thisId = getDocId(node);
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
    const nodeId = getDocId(node);

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
  let h = 0,
    s = 0,
    l = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    s = (s << 3) - s + str.charCodeAt(i);
    l = (l << 2) - l + str.charCodeAt(i);
  }

  const hue = Math.abs(h % 360); // 0–359
  const sat = 65 + (Math.abs(s) % 20); // 65–84%
  const light = 80 + (Math.abs(l) % 10); // 80–89%

  return `hsl(${hue}, ${sat}%, ${light}%)`;
} 

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export function applyDagreLayout(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 20 });

  // 1) register nodes & edges
  nodes.forEach((n) =>
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  );
  edges.forEach((e) => g.setEdge(e.source, e.target));

  // 2) run layout
  dagre.layout(g);

  // 3) read back positions
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return {
      ...n,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
    };
  });
}