"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import type { FilePreviewUi } from "@/lib/knowledge-map-client";
import { cn } from "@/lib/utils";

type TableData = {
  sheetName?: string;
  sheets: SheetData[];
};

type SheetData = {
  columnWidths: number[];
  matrix: string[][];
  merges: SheetMerge[];
  name: string;
};

type SheetMerge = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

export function TableFileViewer({ fallback, preview }: { fallback: ReactNode; preview: FilePreviewUi }) {
  const fallbackData = useMemo(() => tableDataFromPreview(preview), [preview]);
  const [loaded, setLoaded] = useState<{ data: TableData; error: string | null; url: string } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const data = preview.assetUrl && loaded?.url === preview.assetUrl && !loaded.error ? loaded.data : fallbackData;
  const error = preview.assetUrl && loaded?.url === preview.assetUrl ? loaded.error : null;
  const isLoading = Boolean(preview.assetUrl && (!loaded || loaded.url !== preview.assetUrl));

  useEffect(() => {
    if (!preview.assetUrl) return;

    let cancelled = false;
    const url = preview.assetUrl;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error("表格文件读取失败");
        return response.arrayBuffer();
      })
      .then((buffer) => parseWorkbook(buffer))
      .then((nextData) => {
        if (cancelled) return;
        setLoaded({ data: nextData, error: null, url });
      })
      .catch((nextError) => {
        if (!cancelled) {
          setLoaded({
            data: fallbackData,
            error: nextError instanceof Error ? nextError.message : "表格解析失败",
            url,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackData, preview.assetUrl]);

  const activeData = data.sheets.find((sheet) => sheet.name === selectedSheet) ?? data.sheets[0];

  if (isLoading) return <TableSkeleton />;
  if (!activeData && !preview.headers.length) return fallback;

  return (
    <div className="presento-table-viewer">
      {error ? <div className="presento-file-viewer-state">表格预览暂不可用：{error}</div> : null}
      {data.sheets.length > 1 ? (
        <div className="presento-table-viewer-tabs">
          {data.sheets.map((sheet) => (
            <button
              className={sheet.name === activeData?.name ? "presento-table-viewer-tab-active" : "presento-table-viewer-tab"}
              key={sheet.name}
              onClick={() => setSelectedSheet(sheet.name)}
              type="button"
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : null}
      {activeData ? <DataTable sheet={activeData} /> : fallback}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="presento-preview-skeleton presento-preview-skeleton-table">
      <Skeleton className="presento-preview-skeleton-title" />
      <div className="presento-preview-skeleton-grid">
        {Array.from({ length: 24 }, (_, index) => (
          <Skeleton className="presento-preview-skeleton-cell" key={index} />
        ))}
      </div>
    </div>
  );
}

function DataTable({ sheet }: { sheet: SheetData }) {
  const tableWidth = sheet.columnWidths.reduce((total, width) => total + width, 0);
  const mergeState = useMemo(() => {
    const covered = new Set<string>();
    const starts = new Map<string, SheetMerge>();

    for (const merge of sheet.merges) {
      starts.set(cellKey(merge.row, merge.col), merge);
      for (let row = merge.row; row < merge.row + merge.rowSpan; row += 1) {
        for (let col = merge.col; col < merge.col + merge.colSpan; col += 1) {
          if (row === merge.row && col === merge.col) continue;
          covered.add(cellKey(row, col));
        }
      }
    }

    return { covered, starts };
  }, [sheet.merges]);

  return (
    <div className="presento-knowledge-table-wrap">
      <table
        className="presento-knowledge-table presento-knowledge-spreadsheet"
        style={tableWidth ? { minWidth: "100%", width: `${tableWidth}px` } : undefined}
      >
        {sheet.columnWidths.length ? (
          <colgroup>
            {sheet.columnWidths.map((width, index) => (
              <col key={`${sheet.name}-col-${index}`} style={{ width: `${width}px` }} />
            ))}
          </colgroup>
        ) : null}
        <tbody>
          {sheet.matrix.map((row, rowIndex) => {
            const rowTone = getSpreadsheetRowTone(row, rowIndex);

            return (
              <tr className={cn(rowTone && `presento-knowledge-spreadsheet-row-${rowTone}`)} key={`${sheet.name}-${rowIndex}`}>
                {row.map((cell, colIndex) => {
                  const key = cellKey(rowIndex, colIndex);
                  if (mergeState.covered.has(key)) return null;
                  const merge = mergeState.starts.get(key);

                  return (
                    <td
                      className={cn(!cell.trim() && "presento-knowledge-spreadsheet-cell-empty")}
                      colSpan={merge?.colSpan}
                      key={key}
                      rowSpan={merge?.rowSpan}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseWorkbook(buffer: ArrayBuffer): TableData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames.flatMap((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return [];
    const sheetData = sheetDataFromWorksheet(name, sheet);
    return sheetData ? [sheetData] : [];
  });

  return {
    sheetName: sheets[0]?.name,
    sheets,
  };
}

function tableDataFromPreview(preview: FilePreviewUi): TableData {
  const sheet = {
    columnWidths: [],
    matrix: preview.headers.length ? [preview.headers, ...preview.rows] : preview.rows,
    merges: [],
    name: preview.sheetName ?? "预览",
  };
  return {
    sheetName: sheet.name,
    sheets: sheet.matrix.length ? [sheet] : [],
  };
}

function sheetDataFromWorksheet(name: string, sheet: XLSX.WorkSheet): SheetData | null {
  if (!sheet["!ref"]) return null;

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const maxRows = Math.min(range.e.r, range.s.r + 119);
  const maxCols = Math.min(range.e.c, range.s.c + 39);
  const columnWidths = Array.from({ length: maxCols - range.s.c + 1 }, (_, index) => {
    const column = sheet["!cols"]?.[range.s.c + index];
    return Math.max(56, Math.min(column?.wpx ?? 128, 320));
  });
  const matrix: string[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= maxRows; rowIndex += 1) {
    const row: string[] = [];
    for (let colIndex = range.s.c; colIndex <= maxCols; colIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c: colIndex, r: rowIndex })];
      row.push(cell ? XLSX.utils.format_cell(cell) : "");
    }
    matrix.push(row);
  }

  const merges = (sheet["!merges"] ?? [])
    .map((merge) => {
      const rowStart = Math.max(merge.s.r, range.s.r);
      const rowEnd = Math.min(merge.e.r, maxRows);
      const colStart = Math.max(merge.s.c, range.s.c);
      const colEnd = Math.min(merge.e.c, maxCols);
      if (rowEnd < rowStart || colEnd < colStart) return null;

      return {
        col: colStart - range.s.c,
        colSpan: colEnd - colStart + 1,
        row: rowStart - range.s.r,
        rowSpan: rowEnd - rowStart + 1,
      };
    })
    .filter((merge): merge is SheetMerge => Boolean(merge));

  const trimmedMatrix = trimEmptySpreadsheetEdges(matrix, merges);

  return {
    columnWidths: columnWidths.slice(0, trimmedMatrix[0]?.length ?? columnWidths.length),
    matrix: trimmedMatrix,
    merges,
    name,
  };
}

function trimEmptySpreadsheetEdges(matrix: string[][], merges: SheetMerge[]) {
  let lastRow = matrix.length - 1;
  while (lastRow >= 0 && matrix[lastRow]?.every((cell) => !cell.trim())) {
    const hasMerge = merges.some((merge) => merge.row <= lastRow && merge.row + merge.rowSpan - 1 >= lastRow);
    if (hasMerge) break;
    lastRow -= 1;
  }

  if (lastRow < 0) return [];

  let lastCol = Math.max(...matrix.slice(0, lastRow + 1).map((row) => row.length)) - 1;
  while (lastCol >= 0 && matrix.slice(0, lastRow + 1).every((row) => !row[lastCol]?.trim())) {
    const hasMerge = merges.some((merge) => merge.col <= lastCol && merge.col + merge.colSpan - 1 >= lastCol);
    if (hasMerge) break;
    lastCol -= 1;
  }

  return matrix.slice(0, lastRow + 1).map((row) => row.slice(0, lastCol + 1));
}

function getSpreadsheetRowTone(row: string[], rowIndex: number) {
  const filledCells = row.map((cell) => cell.trim()).filter(Boolean);
  if (rowIndex === 0) return "title";
  if (filledCells.includes("#") || filledCells.some((cell) => /word count|amount|rate per word/i.test(cell))) return "header";
  if (filledCells.length === 1 && /^[\p{L}\s:]+$/u.test(filledCells[0]) && filledCells[0] === filledCells[0].toUpperCase()) return "section";
  return "";
}

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}
