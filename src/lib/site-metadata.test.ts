import assert from "node:assert/strict";
import test from "node:test";

import { siteMetadata } from "./site-metadata.ts";

test("uses Presento as the site title and icon", () => {
  assert.equal(siteMetadata.title, "Presento");
  assert.equal(siteMetadata.applicationName, "Presento");
  assert.deepEqual(siteMetadata.icons, {
    apple: "/brand/presento-icon-panda.png",
    icon: "/brand/presento-icon-panda.png",
    shortcut: "/brand/presento-icon-panda.png",
  });
});
