"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";
import type { FilePreviewUi } from "@/lib/knowledge-map-client";

type DocxPreviewPayload = {
  blocks?: Array<
    | {
      alignment?: "center" | "end" | "justify" | "start";
      kind: "paragraph";
      runs?: Array<{ bold?: boolean; italic?: boolean; text?: string; underline?: boolean }>;
      style?: "heading1" | "heading2" | "heading3" | "title";
      text?: string;
    }
    | {
      kind: "table";
      rows?: string[][];
    }
  >;
  fileName?: string;
  title?: string;
};

export function DocumentFileViewer({ preview }: { preview: FilePreviewUi }) {
  const docxUrl = docxAssetUrl(preview);
  const fallbackDocxUrl = docxPreviewUrl(preview);
  const textUrl = textAssetUrl(preview);
  const docxHostRef = useRef<HTMLDivElement | null>(null);
  const [nativeDocxState, setNativeDocxState] = useState<{ error: string | null; loading: boolean; url: string } | null>(null);
  const [docxLoaded, setDocxLoaded] = useState<{ document: DocxPreviewPayload | null; error: string | null; url: string } | null>(null);
  const [loaded, setLoaded] = useState<{ error: string | null; text: string; url: string } | null>(null);
  const body = textUrl && loaded?.url === textUrl && !loaded.error
    ? loaded.text
    : preview.text || "当前资料暂无正文预览，AI 会基于已解析片段进行讲解。";
  const activeNativeDocxState = docxUrl && nativeDocxState?.url === docxUrl ? nativeDocxState : null;
  const nativeDocxError = activeNativeDocxState?.error ?? null;
  const isNativeDocxLoading = Boolean(docxUrl && (!activeNativeDocxState || activeNativeDocxState.loading));

  useEffect(() => {
    if (!docxUrl) return;

    let cancelled = false;
    const host = docxHostRef.current;
    if (!host) return;

    host.innerHTML = "";
    setNativeDocxState({ error: null, loading: true, url: docxUrl });

    fetch(docxUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("DOCX 文件读取失败");
        return response.arrayBuffer();
      })
      .then(async (buffer) => {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(buffer, host, undefined, {
          breakPages: true,
          className: "presento-docx-native",
          experimental: true,
          ignoreHeight: false,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          inWrapper: true,
          renderComments: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
          useBase64URL: true,
        });
        if (!cancelled) setNativeDocxState({ error: null, loading: false, url: docxUrl });
      })
      .catch((error) => {
        if (!cancelled) {
          host.innerHTML = "";
          setNativeDocxState({
            error: error instanceof Error ? error.message : "DOCX 文件渲染失败",
            loading: false,
            url: docxUrl,
          });
        }
      });

    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [docxUrl]);

  useEffect(() => {
    if (!fallbackDocxUrl || !nativeDocxError) return;

    let cancelled = false;
    fetch(fallbackDocxUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("DOCX 文档读取失败");
        return response.json() as Promise<DocxPreviewPayload>;
      })
      .then((document) => {
        if (!cancelled) setDocxLoaded({ document, error: null, url: fallbackDocxUrl });
      })
      .catch((error) => {
        if (!cancelled) {
          setDocxLoaded({
            document: null,
            error: error instanceof Error ? error.message : "DOCX 文档解析失败",
            url: fallbackDocxUrl,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackDocxUrl, nativeDocxError]);

  useEffect(() => {
    if (!textUrl || docxUrl) return;

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
  }, [docxUrl, textUrl]);

  if (docxUrl) {
    const fallbackLoaded = docxLoaded?.url === fallbackDocxUrl ? docxLoaded : null;
    const isFallbackLoading = Boolean(nativeDocxError && fallbackDocxUrl && !fallbackLoaded);
    return (
      <div className="presento-docx-viewer presento-docx-viewer-native">
        {isNativeDocxLoading ? <DocumentSkeleton /> : null}
        <div
          className={[
            "presento-docx-native-host",
            nativeDocxError ? "presento-docx-native-host-hidden" : "",
            isNativeDocxLoading ? "presento-docx-native-host-loading" : "",
          ].filter(Boolean).join(" ")}
          ref={docxHostRef}
        />
        {isFallbackLoading ? <DocumentSkeleton /> : null}
        {nativeDocxError && fallbackLoaded?.error ? (
          <div className="presento-file-viewer-state">DOCX 预览暂不可用：{nativeDocxError}；兜底预览失败：{fallbackLoaded.error}</div>
        ) : null}
        {nativeDocxError && fallbackLoaded?.document && !fallbackLoaded.error ? (
          <StructuredDocxPreview document={fallbackLoaded.document} fallbackTitle={preview.fileName ?? preview.title} />
        ) : null}
      </div>
    );
  }

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

function StructuredDocxPreview({
  document,
  fallbackTitle,
}: {
  document: DocxPreviewPayload;
  fallbackTitle: string;
}) {
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  if (!blocks.length) {
    return (
      <div className="presento-file-viewer-state">
        这个 DOCX 暂时没有解析到可展示的正文，文件名：{document.fileName ?? fallbackTitle}
      </div>
    );
  }

  return (
    <article className="presento-docx-page" aria-label={document.title ?? fallbackTitle}>
      {blocks.map((block, index) => {
        if (block.kind === "table") {
          return <DocxTable block={block} key={`table-${index}`} />;
        }
        return <DocxParagraph block={block} key={`paragraph-${index}`} />;
      })}
    </article>
  );
}

function DocxParagraph({
  block,
}: {
  block: Extract<NonNullable<DocxPreviewPayload["blocks"]>[number], { kind: "paragraph" }>;
}) {
  const Tag = block.style === "title" ? "h1" : block.style === "heading1" ? "h2" : block.style === "heading2" ? "h3" : "p";
  return (
    <Tag
      className={[
        "presento-docx-paragraph",
        block.style ? `presento-docx-paragraph-${block.style}` : "",
        block.alignment ? `presento-docx-align-${block.alignment}` : "",
      ].filter(Boolean).join(" ")}
    >
      {(block.runs?.length ? block.runs : [{ text: block.text ?? "" }]).map((run, index) => (
        <span
          className={[
            run.bold ? "presento-docx-run-bold" : "",
            run.italic ? "presento-docx-run-italic" : "",
            run.underline ? "presento-docx-run-underline" : "",
          ].filter(Boolean).join(" ")}
          key={`${run.text ?? ""}-${index}`}
        >
          {run.text}
        </span>
      ))}
    </Tag>
  );
}

function DocxTable({
  block,
}: {
  block: Extract<NonNullable<DocxPreviewPayload["blocks"]>[number], { kind: "table" }>;
}) {
  const rows = Array.isArray(block.rows) ? block.rows : [];
  return (
    <div className="presento-docx-table-wrap">
      <table className="presento-docx-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("|")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>
                  {cell.split("\n").map((line, lineIndex) => (
                    <span key={`${line}-${lineIndex}`}>{line}</span>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

function docxAssetUrl(preview: FilePreviewUi) {
  if (!preview.assetUrl) return undefined;
  const mimeType = preview.mimeType?.toLowerCase() ?? "";
  const fileName = preview.fileName?.toLowerCase() ?? "";
  const isDocx = mimeType.includes("wordprocessingml") || fileName.endsWith(".docx");
  return isDocx ? preview.assetUrl : undefined;
}

function docxPreviewUrl(preview: FilePreviewUi) {
  if (!preview.assetUrl) return undefined;
  const mimeType = preview.mimeType?.toLowerCase() ?? "";
  const fileName = preview.fileName?.toLowerCase() ?? "";
  const isDocx = mimeType.includes("wordprocessingml") || fileName.endsWith(".docx");
  if (!isDocx) return undefined;
  return preview.assetUrl.replace(/\/content(\?.*)?$/u, "/docx-preview");
}
