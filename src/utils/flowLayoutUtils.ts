import { Edge } from "reactflow";
import { treeTokens } from "../theme/theme";
import { applyDagreLayout } from "./patientTreeUtils";
import {
  getOverviewNodeDimensions,
  OVERVIEW_SEGMENT_SIZE,
} from "./overviewNodeStyle";

type FlowNode = {
  id: string;
  position: { x: number; y: number };
  data?: {
    isOverviewMode?: boolean;
    isTreeRoot?: boolean;
    charType?: string | null;
  };
};

type Side = "top" | "right" | "bottom" | "left";

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const OVERVIEW_NODE_SIZE = OVERVIEW_SEGMENT_SIZE;
const DUAL_RING_THRESHOLD = 9;

export function getNodeDimensions(node: FlowNode): { width: number; height: number } {
  if (node.data?.isOverviewMode) {
    return getOverviewNodeDimensions(node.data);
  }
  return { width: 190, height: 88 };
}

/** Minimum ring radius so N circular nodes do not overlap. */
export function computeRingRadius(
  childCount: number,
  nodeSize = OVERVIEW_NODE_SIZE,
  minGap = 44,
  minRadius = 200
): number {
  if (childCount <= 1) return minRadius;
  const span = nodeSize + minGap;
  const required = span / (2 * Math.sin(Math.PI / childCount));
  return Math.max(minRadius, Math.ceil(required));
}

function nodeCenter(node: FlowNode): { x: number; y: number } {
  const { width, height } = getNodeDimensions(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

function pickSourceSide(dx: number, dy: number): Side {
  if (Math.abs(dx) > Math.abs(dy) * 0.55) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "bottom" : "top";
}

/** Route each edge through the handle closest to the other node. */
export function assignEdgeHandles(nodes: FlowNode[], edges: Edge[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return edge;

    const sc = nodeCenter(source);
    const tc = nodeCenter(target);
    const srcSide = pickSourceSide(tc.x - sc.x, tc.y - sc.y);

    return {
      ...edge,
      sourceHandle: `source-${srcSide}`,
      targetHandle: `target-${OPPOSITE[srcSide]}`,
    };
  });
}

/** Drop nodes not reachable from any root via directed edges (overview orphan cleanup). */
export function keepReachableNodes(
  nodes: FlowNode[],
  edges: Edge[],
  rootIds: string[]
): FlowNode[] {
  if (rootIds.length === 0) return nodes;

  const reachable = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of edges) {
      if (edge.source === id && !reachable.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return nodes.filter((node) => reachable.has(node.id));
}

export function filterEdgesForNodes(nodes: FlowNode[], edges: Edge[]): Edge[] {
  const ids = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
}

export function collectDescendantIds(
  rootId: string,
  edges: Edge[]
): Set<string> {
  const removed = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (removed.has(edge.source) && !removed.has(edge.target)) {
        removed.add(edge.target);
        changed = true;
      }
    }
  }
  return removed;
}

export function makePatientTreeEdge(
  source: string,
  target: string,
  id?: string
): Edge {
  return {
    id: id ?? `${source}->${target}`,
    source,
    target,
    type: "simplebezier",
    style: {
      stroke: treeTokens.edgeStroke,
      strokeWidth: treeTokens.edgeStrokeWidth,
    },
  };
}

function placeOnRing(
  childIds: string[],
  byId: Map<string, FlowNode>,
  center: { x: number; y: number },
  radius: number
): void {
  childIds.forEach((childId, i) => {
    const child = byId.get(childId);
    if (!child) return;
    const angle = (2 * Math.PI * i) / childIds.length - Math.PI / 2;
    const dim = getNodeDimensions(child);
    child.position = {
      x: center.x + radius * Math.cos(angle) - dim.width / 2,
      y: center.y + radius * Math.sin(angle) - dim.height / 2,
    };
  });
}

export type RadialLayoutResult = {
  nodes: FlowNode[];
  clusterRadius: number;
};

/** Place overview population roots with primary indications on scalable ring(s). */
export function applyRadialOverviewLayout(
  nodes: FlowNode[],
  edges: Edge[],
  rootId: string,
  center = { x: 400, y: 280 },
  minRadius = 200
): RadialLayoutResult {
  const childrenByParent = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!childrenByParent.has(edge.source)) {
      childrenByParent.set(edge.source, []);
    }
    childrenByParent.get(edge.source)!.push(edge.target);
  });

  const byId = new Map(nodes.map((n) => [n.id, { ...n, position: { ...n.position } }]));
  const root = byId.get(rootId);
  if (!root) {
    return { nodes, clusterRadius: minRadius };
  }

  const rootDim = getNodeDimensions(root);
  root.position = {
    x: center.x - rootDim.width / 2,
    y: center.y - rootDim.height / 2,
  };

  const ring = childrenByParent.get(rootId) || [];
  let clusterRadius = computeRingRadius(ring.length, OVERVIEW_NODE_SIZE, 44, minRadius);

  if (ring.length === 0) {
    clusterRadius = minRadius;
  } else if (ring.length <= DUAL_RING_THRESHOLD) {
    placeOnRing(ring, byId, center, clusterRadius);
  } else {
    const innerCount = Math.ceil(ring.length / 2);
    const inner = ring.slice(0, innerCount);
    const outer = ring.slice(innerCount);
    const innerR = computeRingRadius(inner.length, OVERVIEW_NODE_SIZE, 44, minRadius);
    const outerR = innerR + OVERVIEW_NODE_SIZE + 56;
    clusterRadius = outerR + OVERVIEW_NODE_SIZE / 2;
    placeOnRing(inner, byId, center, innerR);
    placeOnRing(outer, byId, center, outerR);
  }

  return { nodes: Array.from(byId.values()), clusterRadius };
}

export type OverviewClusterLayoutResult = {
  nodes: FlowNode[];
  clusterWidth: number;
};

/**
 * Layout an overview preview cluster (Population → … → Primary Indication) with
 * dagre so intermediate characteristics are positioned, not only direct children.
 */
export function layoutOverviewPreviewCluster(
  allNodes: FlowNode[],
  allEdges: Edge[],
  rootId: string,
  center = { x: 400, y: 280 }
): OverviewClusterLayoutResult {
  const reachable = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of allEdges) {
      if (edge.source === id && !reachable.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  if (reachable.size === 0) {
    return { nodes: allNodes, clusterWidth: 360 };
  }

  const clusterNodes = allNodes.filter((node) => reachable.has(node.id));
  const clusterEdges = allEdges.filter(
    (edge) => reachable.has(edge.source) && reachable.has(edge.target)
  );

  if (clusterNodes.length === 0) {
    return { nodes: allNodes, clusterWidth: 360 };
  }

  const laidOut = applyDagreLayout(clusterNodes, clusterEdges);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of laidOut) {
    const dim = getNodeDimensions(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + dim.width);
    maxY = Math.max(maxY, node.position.y + dim.height);
  }

  const clusterCenterX = (minX + maxX) / 2;
  const clusterCenterY = (minY + maxY) / 2;
  const dx = center.x - clusterCenterX;
  const dy = center.y - clusterCenterY;

  const byId = new Map(
    allNodes.map((node) => [node.id, { ...node, position: { ...node.position } }])
  );

  for (const node of laidOut) {
    byId.set(node.id, {
      ...node,
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy,
      },
    });
  }

  const clusterWidth = Math.max(maxX - minX + 160, 360);
  return { nodes: Array.from(byId.values()), clusterWidth };
}
