export type DemoMockFileFixture = {
  fileKind: string;
  fileName: string;
  id: string;
  mimeType: string;
  relativePath: string;
  viewer: string;
};

export const demoMockFileFixtures: DemoMockFileFixture[] = [
  {
    fileKind: "md",
    fileName: "01.初识Python.md",
    id: "mock-python-intro",
    mimeType: "text/markdown; charset=utf-8",
    relativePath: "01.初识Python.md",
    viewer: "markdown",
  },
  {
    fileKind: "code",
    fileName: "function.py",
    id: "mock-python-function",
    mimeType: "text/x-python; charset=utf-8",
    relativePath: "py/function.py",
    viewer: "code",
  },
  {
    fileKind: "code",
    fileName: "hello.py",
    id: "mock-python-hello",
    mimeType: "text/x-python; charset=utf-8",
    relativePath: "py/hello.py",
    viewer: "code",
  },
  {
    fileKind: "xlsx",
    fileName: "invoice.xlsx",
    id: "mock-invoice",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    relativePath: "invoice.xlsx",
    viewer: "table",
  },
  {
    fileKind: "docx",
    fileName: "实验1运算器实验.docx",
    id: "mock-alu-guide",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    relativePath: "实验1运算器实验.docx",
    viewer: "docx",
  },
  {
    fileKind: "pdf",
    fileName: "实验1运算器实验报告.pdf",
    id: "mock-alu-report",
    mimeType: "application/pdf",
    relativePath: "实验1运算器实验报告.pdf",
    viewer: "pdf",
  },
];

export function getDemoMockFileFixture(fileId: string) {
  return demoMockFileFixtures.find((file) => file.id === fileId) ?? null;
}
