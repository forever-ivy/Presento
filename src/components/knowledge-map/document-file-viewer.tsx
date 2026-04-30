"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";
import type { FilePreviewUi } from "@/lib/knowledge-map-client";

export function DocumentFileViewer({ preview }: { preview: FilePreviewUi }) {
  const textUrl = textAssetUrl(preview);
  const [loaded, setLoaded] = useState<{ error: string | null; text: string; url: string } | null>(null);
  const body = textUrl && loaded?.url === textUrl && !loaded.error
    ? loaded.text
    : preview.text || "当前资料暂无正文预览，AI 会基于已解析片段进行讲解。";

  useEffect(() => {
    if (!textUrl) return;

    let cancelled = false;
    fetch(textUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("文档读取失败");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setLoaded({ error: null, text, url: textUrl });
      })
      .catch((error) => {
        if (!cancelled) {
          setLoaded({
            error: error instanceof Error ? error.message : "文档解析失败",
            text: "",
            url: textUrl,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [textUrl]);

  return (
    <div className="presento-markdown-viewer">
      {textUrl && (!loaded || loaded.url !== textUrl) ? <DocumentSkeleton /> : null}
      {textUrl && loaded?.url === textUrl && loaded.error ? (
        <div className="presento-file-viewer-state">文档预览暂不可用：{loaded.error}</div>
      ) : null}
      {textUrl && (!loaded || loaded.url !== textUrl) ? null : (
        <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
          {body}
        </ReactMarkdown>
      )}
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="presento-preview-skeleton presento-preview-skeleton-document">
      <Skeleton className="presento-preview-skeleton-title" />
      <div className="presento-preview-skeleton-body">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton
            className="presento-preview-skeleton-line"
            key={index}
            style={{ width: `${index % 2 === 0 ? 88 : 72}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function textAssetUrl(preview: FilePreviewUi) {
  if (!preview.assetUrl) return undefined;
  const mimeType = preview.mimeType?.toLowerCase() ?? "";
  const fileName = preview.fileName?.toLowerCase() ?? "";
  if (mimeType.startsWith("text/") || mimeType.includes("markdown")) return preview.assetUrl;
  if (fileName.endsWith(".md") || fileName.endsWith(".markdown") || fileName.endsWith(".txt")) return preview.assetUrl;
  return undefined;
}
