import assert from "node:assert/strict";
import { test } from "node:test";
import { slugFromName } from "./slug.ts";

test("a name becomes lowercase words joined by hyphens", () => {
  assert.equal(slugFromName("Video Streaming Premium"), "video-streaming-premium");
  assert.equal(slugFromName("  Music + Podcasts (1 year)  "), "music-podcasts-1-year");
  assert.equal(slugFromName("Café Plus"), "cafe-plus");
});

test("a name with no latin letters or digits gives an empty slug", () => {
  assert.equal(slugFromName("—"), "");
});

test("long names are cut without leaving a trailing hyphen", () => {
  const slug = slugFromName(`${"a".repeat(59)} b`);
  assert.equal(slug, "a".repeat(59));
  assert.match(slugFromName("x ".repeat(80)), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});
