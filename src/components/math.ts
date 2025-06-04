import Decimal from "decimal.js";

// ―― core multiply ――――――――――――――――――――――――――――――――――――――
export function mul(parent: Decimal.Value, rate: Decimal.Value) {
  return new Decimal(parent).times(rate);
}

// ―― how EVERY node turns that value into text ―――――――――――――
export function format(val: Decimal) {
  // whole persons, thousands-grouped: “45 494 999”
  return val.toNearest(1).toNumber().toLocaleString();
}
