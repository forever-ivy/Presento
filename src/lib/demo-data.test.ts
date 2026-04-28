import assert from "node:assert/strict";
import test from "node:test";

import { demoDefenseSlides } from "./demo-data.ts";

test("provides enough mock slides for the defense gallery", () => {
  assert.ok(demoDefenseSlides.length >= 8);
  assert.equal(demoDefenseSlides[1]?.page, "02");

  for (const slide of demoDefenseSlides) {
    assert.ok(slide.image.startsWith("data:image/svg+xml"));
    assert.ok(slide.risks.length > 0);
    assert.ok(slide.keywords.length > 0);
  }
});
