import type {
  NotebookCitation,
  NotebookExplanationMode,
  ParsedFileResult,
} from "../../shared/src/domain.ts";

type FetchLike = typeof fetch;

export type ParseFileRequest = {
  fileId: string;
  fileName: string;
  fileKind: string;
  mimeType?: string;
  storagePath?: string;
  storageKey?: string;
  signedUrl?: string;
  contentBase64?: string;
};

export type ExplainFileRequest = {
  fileId: string;
  fileName: string;
  mode: NotebookExplanationMode;
  chunks: Array<{ content: string; metadata?: Record<string, unknown> }>;
  question?: string;
};

export type ExplainFileResponse = {
  summary: string;
  outline: string[];
  answer?: string;
  citations: NotebookCitation[];
  followUps?: string[];
  quiz?: string[];
  weaknessCandidates?: string[];
  metadata?: Record<string, unknown>;
};

export type NotebookRagClient = {
  parseFile(input: ParseFileRequest): Promise<ParsedFileResult>;
  explainFile(input: ExplainFileRequest): Promise<ExplainFileResponse>;
  chatFile(input: ExplainFileRequest & { question: string }): Promise<ExplainFileResponse>;
};

export function createNotebookRagClient({
  baseUrl = process.env.NOTEBOOK_RAG_BASE_URL,
  apiKey = process.env.NOTEBOOK_RAG_API_KEY,
  fetchImpl = fetch,
}: {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
} = {}): NotebookRagClient | null {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/u, "");
  if (!normalizedBaseUrl) return null;

  async function request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Notebook RAG sidecar ${path} failed: ${response.status} ${detail}`.trim());
    }

    return response.json() as Promise<T>;
  }

  return {
    parseFile(input) {
      return request<ParsedFileResult>("/parse-file", input);
    },
    explainFile(input) {
      return request<ExplainFileResponse>("/explain-file", input);
    },
    chatFile(input) {
      return request<ExplainFileResponse>("/chat-file", input);
    },
  };
}
