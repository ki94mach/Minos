import {
  formatDrugLabel,
  formatDrugStrengthUnit,
} from "./drugFormat";

describe("formatDrugStrengthUnit", () => {
  it("returns strength and unit when both are set", () => {
    expect(formatDrugStrengthUnit(10, "mg")).toBe("10 mg");
  });

  it("returns strength only when unit is missing", () => {
    expect(formatDrugStrengthUnit(5, null)).toBe("5");
    expect(formatDrugStrengthUnit(5, "")).toBe("5");
  });

  it("returns unit only when strength is missing", () => {
    expect(formatDrugStrengthUnit(null, "IU")).toBe("IU");
  });

  it("returns empty string when both are missing", () => {
    expect(formatDrugStrengthUnit(null, null)).toBe("");
    expect(formatDrugStrengthUnit(undefined, undefined)).toBe("");
  });

  it("treats NaN strength as missing", () => {
    expect(formatDrugStrengthUnit(Number.NaN, "mg")).toBe("mg");
  });
});

describe("formatDrugLabel", () => {
  it("includes strength and unit in label", () => {
    expect(formatDrugLabel("Aspirin", 100, "mg")).toBe("Aspirin - 100 mg");
  });

  it("returns name only when no strength or unit", () => {
    expect(formatDrugLabel("Aspirin", null, null)).toBe("Aspirin");
  });
});
