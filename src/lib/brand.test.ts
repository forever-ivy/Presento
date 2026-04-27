import assert from "node:assert/strict";
import test from "node:test";

import { presentoBrandLogo } from "./brand.ts";

test("uses the cropped topbar logo asset", () => {
  assert.equal(presentoBrandLogo.src, "/brand/presento-logo-topbar-transparent.png");
  assert.equal(presentoBrandLogo.alt, "Presento");
  assert.ok(presentoBrandLogo.width >= 1000);
  assert.ok(presentoBrandLogo.width > presentoBrandLogo.height);
});
