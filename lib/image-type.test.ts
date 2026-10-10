import assert from "node:assert/strict";
import { test } from "node:test";
import { detectImageType } from "./image-type.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

test("jpeg, png and webp are recognised by their first bytes", () => {
  assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "jpg");
  assert.equal(
    detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    "png",
  );
  assert.equal(
    detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), ...ascii("VP8 "))),
    "webp",
  );
});

test("anything else is refused, whatever it is called", () => {
  assert.equal(detectImageType(bytes(...ascii("GIF89a"))), null);
  assert.equal(detectImageType(bytes(...ascii("<svg xmlns"))), null);
  // a RIFF file that isn't WEBP (a WAV)
  assert.equal(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"))), null);
  assert.equal(detectImageType(bytes()), null);
  assert.equal(detectImageType(bytes(0xff, 0xd8)), null);
});
