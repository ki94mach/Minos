import Decimal from "decimal.js";
import { Edge } from "reactflow";
import { NavigateFunction } from "react-router-dom";

export function buildFlowNodes(
  node: any,
  depth: number,
  index: number,
  parentId: string | null = null,
  parentSize: Decimal,
  siblingsCount: number,
  inheritedColor: string,
  treeId: string,
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

  // ──────────────────────────────────────────────────
  // A) Use the *characteristic_data._id* (or treatment_data._id) as one shared nodeId.
  //    THAT ensures all “Iran” occurrences collapse into the same React-Flow node.
  const uniqueCharId =
    node.characteristic_data?._id?.$oid ||
    node.treatment_data?._id?.$oid ||
    node._id?.$oid ||
    node._id;
  const nodeId = uniqueCharId;

  // ──────────────────────────────────────────────────
  // B) If we’re NOT in overview (i.e. we drilled in), and have seen this unique ID,
  //    then we only want to add its edge + recurse children (to merge grandchildren).
  if (!isOverviewMode && visited.has(uniqueCharId)) {
    // 1) Add parent→this node edge if needed
    if (parentId) {
      const edgeId = `${parentId}->${nodeId}`;
      if (!edgeSet.has(edgeId)) {
        edges.push({ id: edgeId,
                     source: parentId,
                     target: nodeId,
                     type: "default",
                     style: { stroke: "#000000", strokeWidth: 0.75 },
                   });
        edgeSet.add(edgeId);
      }
    }
    // 2) Recurse into children so we collect grandchildren under this single node

    const kids = node.children || [];
    kids.forEach((child: any, i: number) =>
      buildFlowNodes(
        child,
        depth + 1,
        i,
        nodeId,
        new Decimal(parentSize).times(node.rate ?? 1),
        kids.length,
        inheritedColor,
        treeId,
        deps
      )
    );
    // 3) Bail out (don’t re‐create or re‐position this node)
    return;
  }

  // ──────────────────────────────────────────────────
  // C) First time we see this uniqueCharId (or we are in overview). Mark “visited”:
  visited.add(uniqueCharId);

  // ──────────────────────────────────────────────────
  // D) If we’re drilling in on a specific root, and this is depth=0 but NOT that root, skip.
  if (selectedRootId && depth === 0 && nodeId !== selectedRootId) {
    return;
  }

  // ──────────────────────────────────────────────────
  // E) Compute “rawSize” based on whether this is a top‐level root or a descendant:

  const nodeRate = node.rate ?? 1;
  // if (rootId && depth === 0 && nodeId !== rootId) return;
  if (selectedRootId && depth === 0 && nodeId !== selectedRootId) {
    return;
  }

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

  // ──────────────────────────────────────────────────
  // F) Create the React-Flow node object once:
  const isNewNode = !nodesById.has(nodeId);
  if (isNewNode) {
    nodesById.set(nodeId, {
      id: nodeId,
      position: { x: 0, y: 0 }, // we will re‐position later
      type: "custom",
      data: {
        label:
          node.characteristic_data?.name || node.treatment_data?.name || "Node",
        type: node.node_type,
        docId: node._id?.$oid || node._id,
        parentDocId: node.parent_id?._id?.$oid || node.parent_id || null,
        charType: node.characteristic_data?.type,
        size: nodeSize,
        rate: node.rate ?? 1,
        drugs:
          node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) || [],
        regimen: node.treatment_data?.regimen || null,
        alternatives: node.treatment_data?.alternatives || [],
        color: hashColor(uniqueCharId),
        isOverviewMode: isOverviewMode,
        treeId: treeIdMap.get(nodeId),
        isOverview: isOverviewMode,
        onClick: () =>
          navigate(`/patients/${nodeId}`, {
            state: { color: hashColor(uniqueCharId), treeId: treeId },
          }),
      },
    });
  }

  // ──────────────────────────────────────────────────
  // G) Always add an edge parent→this node if needed:
  if (parentId) {
    const edgeId = `${parentId}->${nodeId}`;
    if (!edgeSet.has(edgeId)) {
      edges.push({
        id: edgeId,
        source: parentId,
        target: nodeId,
        type: "default",
        style: { stroke: "#000000", strokeWidth: 0.75 },
      });
      edgeSet.add(edgeId);
    }
  }

  function containsPrimaryIndication(node: any): boolean {
    if (node.characteristic_data?.type === "Primary Indication") return true;
    return (node.children || []).some(containsPrimaryIndication);
  }

  function shouldRenderNode(node: any, isOverviewMode: boolean): boolean {
    if (!isOverviewMode) return true;
    const isPrimary = node.characteristic_data?.type === "Primary Indication";
    const hasPrimaryDescendant = containsPrimaryIndication(node);

    return isPrimary || hasPrimaryDescendant;
  }

  if (!shouldRenderNode(node, isOverviewMode)) return;
  const isPrimary = node.characteristic_data?.type === "Primary Indication";
  if (!(isOverviewMode && isPrimary)) {
    const kids = (node.children || []).filter((child: any) =>
      shouldRenderNode(child, isOverviewMode)
    );
    kids.forEach((child: any, i: number) =>
      buildFlowNodes(
        child,
        depth + 1,
        i,
        nodeId,
        rawSize,
        kids.length,
        inheritedColor,
        treeId,
        deps
      )
    );
  }
};
