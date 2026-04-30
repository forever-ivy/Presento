"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Editor from "@monaco-editor/react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FilePreviewUi } from "@/lib/knowledge-map-client";

export function CodeFileViewer({ fallback, preview }: { fallback: ReactNode; preview: FilePreviewUi }) {
  const fallbackFiles = preview.codeFiles.length ? preview.codeFiles : [];
  const [loaded, setLoaded] = useState<{ content: string; error: string | null; url: string } | null>(null);
  const loadedFile = preview.assetUrl && loaded?.url === preview.assetUrl && !loaded.error
    ? {
        content: loaded.content,
        language: preview.language ?? fallbackFiles[0]?.language,
        path: preview.codePath ?? preview.fileName ?? fallbackFiles[0]?.path ?? "source",
      }
    : null;
  const files = loadedFile ? [loadedFile] : fallbackFiles;
  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
  const activeFile = files.find((file) => file.path === activePath) ?? files[0];
  const isLoading = Boolean(preview.assetUrl && (!loaded || loaded.url !== preview.assetUrl));

  useEffect(() => {
    if (!preview.assetUrl) return;

    let cancelled = false;
    const url = preview.assetUrl;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error("代码文件读取失败");
        return response.text();
      })
      .then((content) => {
        if (!cancelled) setLoaded({ content, error: null, url });
      })
      .catch((error) => {
        if (!cancelled) {
          setLoaded({
            content: "",
            error: error instanceof Error ? error.message : "代码文件解析失败",
            url,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview.assetUrl]);

  if (isLoading) return <CodeSkeleton />;
  if (!activeFile) return fallback;

  return (
    <div className="presento-code-viewer">
      {files.length > 1 ? (
        <div className="presento-code-viewer-tabs">
          {files.map((file) => (
            <button
              className={file.path === activeFile.path ? "presento-code-viewer-tab-active" : "presento-code-viewer-tab"}
              key={file.path}
              onClick={() => setActivePath(file.path)}
              type="button"
            >
              {file.path}
            </button>
          ))}
        </div>
      ) : null}
      <div className="presento-code-viewer-editor">
        <Editor
          height="100%"
          language={activeFile.language ?? preview.language ?? "plaintext"}
          options={{
            minimap: { enabled: false },
            readOnly: true,
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
          theme="vs"
          value={activeFile.content}
        />
      </div>
    </div>
  );
}

function CodeSkeleton() {
  return (
    <div className="presento-preview-skeleton presento-preview-skeleton-code">
      <Skeleton className="presento-preview-skeleton-title" />
      <div className="presento-preview-skeleton-body">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            className="presento-preview-skeleton-line"
            key={index}
            style={{ width: `${index % 4 === 0 ? 58 : index % 4 === 1 ? 82 : index % 4 === 2 ? 68 : 92}%` }}
          />
        ))}
      </div>
    </div>
  );
}
