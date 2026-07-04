import {
  buildDrillDownViewTree,
  canDrillDownPatientNode,
  findPathToNode,
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
  it("always includes Population nodes", () => {
    const pop = charNode("pop-1", "Population");
    expect(shouldIncludeInOverviewPreview(pop, false)).toBe(true);
  });

  it("includes direct children of Population", () => {
    const child = charNode("child-1", "Stage");
    expect(shouldIncludeInOverviewPreview(child, true)).toBe(true);
  });
});

describe("getOverviewPreviewChildren", () => {
  it("returns all children for Population node", () => {
    const c1 = charNode("c1", "Stage");
    const c2 = charNode("c2", "Stage");
    const pop = charNode("pop-1", "Population", [c1, c2]);
    expect(getOverviewPreviewChildren(pop)).toEqual([c1, c2]);
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
});
