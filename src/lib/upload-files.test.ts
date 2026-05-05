import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configureDirectoryUploadInput,
  getUploadDisplayName,
  getUploadableFiles,
  pickUploadDirectory,
  withUploadPath,
} from "./upload-files.ts";

test("uses browser folder-relative paths when preparing uploads", () => {
  const file = {
    name: "orders.ts",
    size: 128,
    webkitRelativePath: "backend/src/routes/orders.ts",
  } as File & { webkitRelativePath: string };

  assert.equal(getUploadDisplayName(file), "backend/src/routes/orders.ts");
});

test("filters ignored files from imported folders before upload", () => {
  const files = [
    {
      name: "orders.ts",
      size: 128,
      webkitRelativePath: "backend/src/routes/orders.ts",
    },
    {
      name: "index.js",
      size: 256,
      webkitRelativePath: "backend/node_modules/zod/index.js",
    },
  ] as Array<File & { webkitRelativePath: string }>;

  assert.deepEqual(
    getUploadableFiles(files).map((file) => getUploadDisplayName(file)),
    ["backend/src/routes/orders.ts"],
  );
});

test("skips code archives inside imported folders without dropping the folder batch", () => {
  const files = [
    {
      name: "orders.ts",
      size: 128,
      webkitRelativePath: "backend/src/routes/orders.ts",
    },
    {
      name: "backend.zip",
      size: 256,
      webkitRelativePath: "backend/backend.zip",
    },
  ] as Array<File & { webkitRelativePath: string }>;

  assert.deepEqual(
    getUploadableFiles(files).map((file) => getUploadDisplayName(file)),
    ["backend/src/routes/orders.ts"],
  );
});

test("keeps explicit paths collected from dropped folders", () => {
  const file = new File(["export const ok = true;"], "orders.ts", {
    type: "text/typescript",
  });

  const uploadFile = withUploadPath(file, "backend/src/routes/orders.ts");

assert.equal(getUploadDisplayName(uploadFile), "backend/src/routes/orders.ts");
});

test("uses folder input instead of browser directory permissions", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const file = new File(["export const ok = true;"], "orders.ts", {
    type: "text/typescript",
  }) as File & { webkitRelativePath: string };
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: "backend/src/routes/orders.ts",
  });

  let directoryPickerCalled = false;

  const input = {
    files: [file],
    listeners: new Map<string, () => void>(),
    directory: false,
    multiple: false,
    style: {} as CSSStyleDeclaration,
    type: "",
    webkitdirectory: false,
    addEventListener(event: string, listener: () => void) {
      this.listeners.set(event, listener);
    },
    click() {
      this.listeners.get("change")?.();
    },
    remove() {},
    setAttribute() {},
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      showDirectoryPicker: async () => {
        directoryPickerCalled = true;
        return undefined;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {
        append() {},
      },
      createElement(tagName: string) {
        assert.equal(tagName, "input");
        return input;
      },
    },
  });

  try {
    const files = await pickUploadDirectory();

    assert.equal(directoryPickerCalled, false);
    assert.equal(input.directory, true);
    assert.equal(input.webkitdirectory, true);
    assert.deepEqual(
      files.map((pickedFile) => getUploadDisplayName(pickedFile)),
      ["backend/src/routes/orders.ts"],
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
});

test("configures a native input for folder selection", () => {
  const attributes = new Map<string, string>();
  const input = {
    directory: false,
    multiple: false,
    webkitdirectory: false,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  } as unknown as HTMLInputElement & {
    directory: boolean;
    webkitdirectory: boolean;
  };

  configureDirectoryUploadInput(input);

  assert.equal(input.directory, true);
  assert.equal(input.multiple, true);
  assert.equal(input.webkitdirectory, true);
  assert.equal(attributes.get("directory"), "");
  assert.equal(attributes.get("webkitdirectory"), "");
});
