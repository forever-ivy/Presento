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
  repositoryUrl?: string;
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
  retrievalMode?: "quick" | "mastery" | "auto";
  topK?: number;
  conversationContext?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  question?: string;
};

export type ExplainFileResponse = {
  summary: string;
  outline: string[];
  answer?: string;
  citations: NotebookCitation[];
  grounded: boolean;
  insufficientEvidence: boolean;
  followUps?: string[];
  quiz?: string[];
  weaknessCandidates?: string[];
  metadata?: Record<string, unknown>;
};

export type RetrievalPreparedChunk = {
  id?: string;
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
  retrieval?: {
    embeddingV2: number[];
    sourceId?: string;
    chunkKind?: string;
    page?: number;
    slide?: number;
    sheet?: string;
    codePath?: string;
    lineStart?: number;
    lineEnd?: number;
    retrievalText?: string;
  };
};

export type PrepareRetrievalChunksRequest = {
  chunks: Array<{
    id?: string;
    content: string;
    source: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type PrepareRetrievalChunksResponse = {
  chunks: RetrievalPreparedChunk[];
};

export type RetrieveChunksRequest = {
  projectId: string;
  query: string;
  limit?: number;
  fileId?: string;
  sourceId?: string;
  slideId?: string;
};

export type RetrieveChunksResponse = {
  chunks: Array<{
    id: string;
    projectId: string;
    artifactId?: string;
    fileId?: string;
    content: string;
    source: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  mode: "hybrid" | "lexical" | "vector" | "fallback";
  trace?: Record<string, unknown>;
};

export type ExplainFileStreamEvent =
  | ({ type: "started" } & Record<string, unknown>)
  | ({ type: "retrieval"; retrievalCount: number; retrievalMode?: string } & Record<string, unknown>)
  | { type: "delta"; delta: string }
  | { type: "citations"; citations: NotebookCitation[] }
  | { type: "fallback"; engine?: string; reason?: string }
  | { type: "completed"; response: ExplainFileResponse }
  | { type: "error"; error: string };

export type NotebookRagClient = {
  parseFile(input: ParseFileRequest): Promise<ParsedFileResult>;
  prepareRetrievalChunks(input: PrepareRetrievalChunksRequest): Promise<PrepareRetrievalChunksResponse>;
  retrieveChunks(input: RetrieveChunksRequest): Promise<RetrieveChunksResponse>;
  explainFile(input: ExplainFileRequest): Promise<ExplainFileResponse>;
  chatFile(input: ExplainFileRequest & { question: string }): Promise<ExplainFileResponse>;
  explainFileStream(input: ExplainFileRequest): Promise<AsyncIterable<ExplainFileStreamEvent>>;
  chatFileStream(input: ExplainFileRequest & { question: string }): Promise<AsyncIterable<ExplainFileStreamEvent>>;
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

  async function requestStream(path: string, body: unknown) {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Notebook RAG sidecar ${path} failed: ${response.status} ${detail}`.trim());
    }

    if (!response.body) {
      throw new Error(`Notebook RAG sidecar ${path} did not return a stream body.`);
    }

    return readNotebookRagEventStream(response.body);
  }

  return {
    parseFile(input) {
      return request<ParsedFileResult>("/parse-file", input);
    },
    prepareRetrievalChunks(input) {
      return request<PrepareRetrievalChunksResponse>("/prepare-retrieval-chunks", input);
    },
    retrieveChunks(input) {
      return request<RetrieveChunksResponse>("/retrieve-chunks", input);
    },
    explainFile(input) {
      return request<ExplainFileResponse>("/explain-file", input);
    },
    chatFile(input) {
      return request<ExplainFileResponse>("/chat-file", input);
    },
    explainFileStream(input) {
      return requestStream("/explain-file-stream", input);
    },
    chatFileStream(input) {
      return requestStream("/chat-file-stream", input);
    },
  };
}

export async function* readNotebookRagEventStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separatorIndex = buffer.indexOf("\n\n");
        if (separatorIndex === -1) break;
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseEventBlock(rawEvent, currentEvent, dataLines);
        currentEvent = "message";
        dataLines = [];
        if (parsed === null) continue;
        if (parsed === "done") return;
        yield parsed;
      }
    }

    const tail = parseEventBlock(buffer, currentEvent, dataLines);
    if (tail && tail !== "done") {
      yield tail;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventBlock(
  rawEvent: string,
  defaultEventName: string,
  inheritedDataLines: string[],
): ExplainFileStreamEvent | "done" | null {
  let eventName = defaultEventName;
  const dataLines = [...inheritedDataLines];

  for (const line of rawEvent.split(/\r?\n/u)) {
    if (!line.trim() || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  if (dataLines.length === 1 && dataLines[0] === "[DONE]") return "done";
  const payload = mergeEventData(dataLines);
  return mapNotebookRagEvent(eventName, payload);
}

function mergeEventData(lines: string[]) {
  const parsedValues = lines.map((line) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      return line;
    }
  });

  if (parsedValues.every((value) => value && typeof value === "object" && !Array.isArray(value))) {
    return Object.assign({}, ...parsedValues) as Record<string, unknown>;
  }

  return parsedValues.length === 1 ? parsedValues[0] : parsedValues;
}

function mapNotebookRagEvent(eventName: string, payload: unknown): ExplainFileStreamEvent | null {
  const data = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};

  switch (eventName) {
    case "started":
      return { type: "started", ...data };
    case "retrieval":
      return {
        type: "retrieval",
        retrievalCount: typeof data.retrievalCount === "number" ? data.retrievalCount : 0,
        retrievalMode: typeof data.retrievalMode === "string" ? data.retrievalMode : undefined,
        ...data,
      };
    case "delta":
      return {
        type: "delta",
        delta: typeof data.delta === "string" ? data.delta : "",
        ...data,
      };
    case "citations":
      return {
        type: "citations",
        citations: Array.isArray(data.citations) ? data.citations as NotebookCitation[] : [],
      };
    case "fallback":
      return {
        type: "fallback",
        engine: typeof data.engine === "string" ? data.engine : undefined,
        reason: typeof data.reason === "string" ? data.reason : undefined,
      };
    case "completed":
      return {
        type: "completed",
        response: data as unknown as ExplainFileResponse,
      };
    case "error":
      return {
        type: "error",
        error: typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "Notebook RAG stream failed.",
      };
    default:
      return null;
  }
}
