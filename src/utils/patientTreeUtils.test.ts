import {
  buildDrillDownViewTree,
  canDrillDownPatientNode,
  findNodeByDocId,
  findNodeById,
  findPathToNode,
  getDrillTargetId,
  getOverviewPreviewChildren,
  getUniqueCharId,
  isPopulationNode,
  isPrimaryIndicationNode,
  overviewFlowNodeId,
  patientIdFromOverviewFlowNodeId,
  shouldIncludeInOverviewPreview,
  subtreeContainsPrimaryIndication,
} from "./patientTreeUtils";

function charNode(
  id: string,
  charType: string,
  children: any[] = []
) {
  return {
    _id: id,
    characteristic_data: { _id: id, char_type: charType },
    children,
  };
}

function treeNode(
  docId: string,
  catalogId: string,
  charType: string,
  children: any[] = []
) {
  return {
    _id: docId,
    characteristic_data: { _id: catalogId, char_type: charType },
    children,
  };
}

describe("isPrimaryIndicationNode", () => {
  it("detects Primary Indication characteristic", () => {
    const node = charNode("pi-1", "Primary Indication");
    expect(isPrimaryIndicationNode(node)).toBe(true);
  });

  it("returns false for other types", () => {
    const node = charNode("pop-1", "Population");
    expect(isPrimaryIndicationNode(node)).toBe(false);
  });
});

describe("isPopulationNode", () => {
  it("detects Population characteristic", () => {
    const node = charNode("pop-1", "Population");
    expect(isPopulationNode(node)).toBe(true);
  });
});

describe("subtreeContainsPrimaryIndication", () => {
  it("returns true when descendant is PI", () => {
    const pi = charNode("pi-1", "Primary Indication");
    const parent = charNode("mid-1", "Stage", [pi]);
    expect(subtreeContainsPrimaryIndication(parent)).toBe(true);
  });

  it("returns false when no PI in subtree", () => {
    const child = charNode("c-1", "Stage");
    const root = charNode("r-1", "Population", [child]);
    expect(subtreeContainsPrimaryIndication(root)).toBe(false);
  });
});

describe("shouldIncludeInOverviewPreview", () => {
  it("includes any node in the preview walk", () => {
    const pop = charNode("pop-1", "Population");
    const child = charNode("child-1", "Stage");
    const grandchild = charNode("gc-1", "Comorbidity");
    expect(shouldIncludeInOverviewPreview(pop)).toBe(true);
    expect(shouldIncludeInOverviewPreview(child)).toBe(true);
    expect(shouldIncludeInOverviewPreview(grandchild)).toBe(true);
  });
});

describe("getOverviewPreviewChildren", () => {
  it("returns all children for Population node", () => {
    const c1 = charNode("c1", "Stage");
    const c2 = charNode("c2", "Stage");
    const pop = charNode("pop-1", "Population", [c1, c2]);
    expect(getOverviewPreviewChildren(pop)).toEqual([c1, c2]);
  });

  it("returns all children for intermediate nodes", () => {
    const pi = charNode("pi-1", "Primary Indication");
    const mid = charNode("mid-1", "Stage", [pi]);
    const grandchild = charNode("gc-1", "Comorbidity");
    const child = charNode("child-1", "Stage", [mid, grandchild]);
    expect(getOverviewPreviewChildren(child)).toEqual([mid, grandchild]);
  });

  it("returns no children for Primary Indication node", () => {
    const pi = charNode("pi-1", "Primary Indication", [
      charNode("fu-1", "Followup"),
    ]);
    expect(getOverviewPreviewChildren(pi)).toEqual([]);
  });
});

describe("canDrillDownPatientNode", () => {
  it("allows drill-down on PI in overview mode", () => {
    const pi = charNode("pi-1", "Primary Indication");
    expect(canDrillDownPatientNode(pi, true, null)).toBe(true);
  });

  it("disallows drill-down outside overview mode", () => {
    const pi = charNode("pi-1", "Primary Indication");
    expect(canDrillDownPatientNode(pi, false, null)).toBe(false);
  });
});

describe("getUniqueCharId", () => {
  it("reads characteristic _id", () => {
    const node = charNode("abc-123", "Population");
    expect(getUniqueCharId(node)).toBe("abc-123");
  });
});

describe("overviewFlowNodeId", () => {
  it("scopes flow id to patient tree", () => {
    expect(overviewFlowNodeId("patient-1", "catalog-2")).toBe(
      "patient-1:catalog-2"
    );
  });
});

describe("patientIdFromOverviewFlowNodeId", () => {
  it("extracts patient id from scoped flow id", () => {
    expect(patientIdFromOverviewFlowNodeId("patient-1:catalog-2")).toBe(
      "patient-1"
    );
  });

  it("returns null when no separator", () => {
    expect(patientIdFromOverviewFlowNodeId("noseparator")).toBeNull();
  });
});

describe("findPathToNode", () => {
  it("returns root-to-target path", () => {
    const leaf = charNode("leaf", "Stage");
    const mid = charNode("mid", "Stage", [leaf]);
    const root = charNode("root", "Population", [mid]);
    expect(findPathToNode(root, "leaf")).toEqual([root, mid, leaf]);
  });

  it("returns null when target is missing", () => {
    const root = charNode("root", "Population");
    expect(findPathToNode(root, "missing")).toBeNull();
  });
});

describe("buildDrillDownViewTree", () => {
  it("prunes siblings and keeps path to target", () => {
    const target = charNode("target", "Primary Indication");
    const sibling = charNode("sibling", "Stage");
    const mid = charNode("mid", "Stage", [target, sibling]);
    const root = charNode("root", "Population", [mid]);

    const pruned = buildDrillDownViewTree(root, "target");
    expect(pruned).not.toBeNull();
    expect(pruned.children).toHaveLength(1);
    expect(pruned.children[0].children).toHaveLength(1);
    expect(pruned.children[0].children[0]._id).toBe("target");
  });

  it("drills to the correct instance when catalog id is duplicated", () => {
    const pi1 = treeNode("doc-pi-1", "catalog-ra", "Primary Indication");
    const pi2 = treeNode("doc-pi-2", "catalog-ra", "Primary Indication");
    const branchA = treeNode("doc-a", "catalog-a", "Stage", [pi1]);
    const branchB = treeNode("doc-b", "catalog-b", "Stage", [pi2]);
    const root = treeNode("doc-root", "catalog-pop", "Population", [
      branchA,
      branchB,
    ]);

    const pruned = buildDrillDownViewTree(root, "doc-pi-2");
    expect(pruned).not.toBeNull();
    expect(pruned.children).toHaveLength(1);
    expect(pruned.children[0]._id).toBe("doc-b");
    expect(pruned.children[0].children[0]._id).toBe("doc-pi-2");
  });
});

describe("getDrillTargetId", () => {
  it("prefers focusNodeDocId over URL param", () => {
    expect(getDrillTargetId("catalog-id", "doc-id")).toBe("doc-id");
  });

  it("falls back to URL param when focus is absent", () => {
    expect(getDrillTargetId("catalog-id", undefined)).toBe("catalog-id");
  });
});

describe("findNodeByDocId", () => {
  it("returns the exact node instance by document id", () => {
    const pi1 = treeNode("doc-pi-1", "catalog-ra", "Primary Indication");
    const pi2 = treeNode("doc-pi-2", "catalog-ra", "Primary Indication");
    const root = treeNode("doc-root", "catalog-pop", "Population", [pi1, pi2]);

    expect(findNodeByDocId(root, "doc-pi-2")?._id).toBe("doc-pi-2");
  });

  it("does not match by catalog id alone", () => {
    const pi1 = treeNode("doc-pi-1", "catalog-ra", "Primary Indication");
    const pi2 = treeNode("doc-pi-2", "catalog-ra", "Primary Indication");
    const root = treeNode("doc-root", "catalog-pop", "Population", [pi1, pi2]);

    expect(findNodeByDocId(root, "catalog-ra")).toBeNull();
  });
});

describe("findNodeById with duplicate catalog", () => {
  it("returns the first catalog match via DFS", () => {
    const pi1 = treeNode("doc-pi-1", "catalog-ra", "Primary Indication");
    const pi2 = treeNode("doc-pi-2", "catalog-ra", "Primary Indication");
    const root = treeNode("doc-root", "catalog-pop", "Population", [pi1, pi2]);

    expect(findNodeById(root, "catalog-ra")?._id).toBe("doc-pi-1");
  });
});
