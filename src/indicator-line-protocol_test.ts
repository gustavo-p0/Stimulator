import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LineProtocol, encodeMessage } from "./indicator-line-protocol.ts";

const encoder = new TextEncoder();
test("two adjacent commands are decoded independently", () => {
  const parser = new LineProtocol();
  assert.deepEqual(parser.push(encoder.encode("Activate\nshowShowButton\n")), ["Activate", "showShowButton"]);
});
test("fragmented commands are held until newline", () => {
  const parser = new LineProtocol();
  assert.deepEqual(parser.push(encoder.encode("Activ")), []);
  assert.deepEqual(parser.push(encoder.encode("ate\nshow")), ["Activate"]);
  assert.deepEqual(parser.push(encoder.encode("ShowButton\n")), ["showShowButton"]);
});
test("decoder retains UTF-8 characters split between chunks", () => {
  const parser = new LineProtocol();
  const bytes = encoder.encode("café\n");
  assert.deepEqual(parser.push(bytes.subarray(0, 4)), []);
  assert.deepEqual(parser.push(bytes.subarray(4)), ["café"]);
});
test("multiple independent chunks do not leak partial messages", () => {
  const parser = new LineProtocol();
  assert.deepEqual(parser.push(encodeMessage("Ready")), ["Ready"]);
  assert.deepEqual(parser.push(encodeMessage("Show")), ["Show"]);
});
test("empty lines are discarded", () => {
  const parser = new LineProtocol();
  assert.deepEqual(parser.push(encoder.encode("\n  \nReady\n")), ["Ready"]);
});
test("encoder applies consistent line framing", () => {
  assert.equal(new TextDecoder().decode(encodeMessage("Activate")), "Activate\n");
  assert.throws(() => encodeMessage("Activate\nClose"));
});
