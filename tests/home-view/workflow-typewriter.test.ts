import assert from "node:assert/strict";
import test from "node:test";

import {
  getVisibleTypewriterGlyphCount,
  mergeTypewriterLineRects,
  splitTypewriterGraphemes,
} from "../../src/views/home-view/ui/workflow-showcase/model/typewriter";

test("typewriter splits user-visible graphemes without breaking unicode", () => {
  assert.deepEqual(splitTypewriterGraphemes("А🚀e\u0301", "ru"), [
    "А",
    "🚀",
    "e\u0301",
  ]);
});

test("typewriter reveals only complete graphemes", () => {
  const glyphCount = 5;

  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, -1), 0);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 0), 0);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 0.199), 0);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 0.2), 1);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 0.799), 3);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 1), glyphCount);
  assert.equal(getVisibleTypewriterGlyphCount(glyphCount, 2), glyphCount);
});

test("typewriter groups glyph bounds by visual line", () => {
  assert.deepEqual(
    mergeTypewriterLineRects([
      { x: 10, y: 20, width: 5, height: 12 },
      { x: 15, y: 21, width: 7, height: 12 },
      { x: 10, y: 38, width: 8, height: 12 },
    ]),
    [
      { x: 10, y: 20, width: 12, height: 13 },
      { x: 10, y: 38, width: 8, height: 12 },
    ],
  );
});
