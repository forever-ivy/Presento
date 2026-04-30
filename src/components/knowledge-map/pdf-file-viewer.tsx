"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { Skeleton } from "@/components/ui/skeleton";
import type { FilePreviewUi } from "@/lib/knowledge-map-client";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export function PdfFileViewer({ fallback, preview }: { fallback: ReactNode; preview: FilePreviewUi }) {
  const [state, setState] = useState<{
    document: PDFDocumentProxy | null;
    error: string | null;
    url: string;
  }>({ document: null, error: null, url: "" });
  const currentState = state.url === preview.assetUrl ? state : { document: null, error: null, url: preview.assetUrl ?? "" };
  const isLoading = Boolean(preview.assetUrl && !currentState.document && !currentState.error);

  useEffect(() => {
    if (!preview.assetUrl) return;
    let cancelled = false;
    const url = preview.assetUrl;

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise
      .then((nextDocument) => {
        if (!cancelled) setState({ document: nextDocument, error: null, url });
      })
      .catch((nextError) => {
        if (!cancelled) {
          setState({
            document: null,
            error: nextError instanceof Error ? nextError.message : "PDF 加载失败",
            url,
          });
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [preview.assetUrl]);

  if (!preview.assetUrl) return fallback;

  if (isLoading) {
    return <PdfViewerSkeleton />;
  }

  const activeDocument = currentState.document;

  if (currentState.error || !activeDocument) {
    return (
      <div className="grid gap-3">
        <div className="presento-file-viewer-state">PDF 预览暂不可用：{currentState.error ?? "没有可渲染内容"}</div>
        {fallback}
      </div>
    );
  }

  return (
    <div className="presento-pdf-viewer">
      {Array.from({ length: activeDocument.numPages }, (_, index) => (
        <PdfPageCanvas document={activeDocument} documentKey={currentState.url} key={index + 1} pageNumber={index + 1} />
      ))}
    </div>
  );
}

function PdfViewerSkeleton() {
  return (
    <div className="presento-preview-skeleton presento-preview-skeleton-pdf">
      <Skeleton className="presento-preview-skeleton-title" />
      <div className="presento-preview-skeleton-body">
        <Skeleton className="presento-preview-skeleton-page" />
        <Skeleton className="presento-preview-skeleton-line" />
        <Skeleton className="presento-preview-skeleton-line presento-preview-skeleton-line-short" />
      </div>
    </div>
  );
}

function PdfPageCanvas({ document, documentKey, pageNumber }: { document: PDFDocumentProxy; documentKey: string; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageKey = `${documentKey}:${pageNumber}`;
  const [state, setState] = useState<{ error: string | null; key: string; page: PDFPageProxy | null }>({
    error: null,
    key: "",
    page: null,
  });
  const currentState = state.key === pageKey ? state : { error: null, key: pageKey, page: null };

  useEffect(() => {
    let cancelled = false;

    document.getPage(pageNumber)
      .then((nextPage) => {
        if (!cancelled) setState({ error: null, key: pageKey, page: nextPage });
      })
      .catch((nextError) => {
        if (!cancelled) {
          setState({
            error: nextError instanceof Error ? nextError.message : "页面加载失败",
            key: pageKey,
            page: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [document, pageKey, pageNumber]);

  useEffect(() => {
    if (!currentState.page || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const viewport = currentState.page.getViewport({ scale: 1.2 });
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    const renderTask = currentState.page.render({ canvas, canvasContext: context, viewport });
    renderTask.promise.catch(() => undefined);

    return () => {
      renderTask.cancel();
    };
  }, [currentState.page]);

  return (
    <article className="presento-pdf-canvas-page">
      {currentState.error ? <div className="presento-file-viewer-state">{currentState.error}</div> : <canvas ref={canvasRef} />}
    </article>
  );
}
