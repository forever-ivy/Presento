import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ObjectStorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export function readObjectStorageConfig(env: NodeJS.ProcessEnv = process.env): ObjectStorageConfig | null {
  const config = {
    endpoint: env.OBJECT_STORAGE_ENDPOINT?.trim() || undefined,
    region: env.OBJECT_STORAGE_REGION?.trim() || "",
    bucket: env.OBJECT_STORAGE_BUCKET?.trim() || "",
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() || "",
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
  };

  const filled = Object.entries(config).filter(([, value]) => typeof value === "string" && value.length > 0);
  if (filled.length === 0) return null;

  const missing = [
    !config.region ? "OBJECT_STORAGE_REGION" : null,
    !config.bucket ? "OBJECT_STORAGE_BUCKET" : null,
    !config.accessKeyId ? "OBJECT_STORAGE_ACCESS_KEY_ID" : null,
    !config.secretAccessKey ? "OBJECT_STORAGE_SECRET_ACCESS_KEY" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Object storage is partially configured. Missing: ${missing.join(", ")}`);
  }

  return config;
}

export function createObjectStorageClient(config = readObjectStorageConfig()) {
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadObjectToStorage({
  key,
  body,
  contentType,
  client = createObjectStorageClient(),
  config = readObjectStorageConfig(),
}: {
  key: string;
  body: Buffer;
  contentType?: string;
  client?: S3Client;
  config?: ObjectStorageConfig | null;
}) {
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return {
    storageKey: key,
    storagePath: buildObjectStoragePath(config.bucket, key),
  };
}

export async function readObjectFromStorage({
  key,
  client = createObjectStorageClient(),
  config = readObjectStorageConfig(),
}: {
  key: string;
  client?: S3Client;
  config?: ObjectStorageConfig | null;
}) {
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  const response = await client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`Object storage returned an empty body for key ${key}.`);
  }

  return bodyToBuffer(response.Body);
}

export async function createSignedReadUrl({
  key,
  expiresIn = 900,
  client = createObjectStorageClient(),
  config = readObjectStorageConfig(),
}: {
  key: string;
  expiresIn?: number;
  client?: S3Client;
  config?: ObjectStorageConfig | null;
}) {
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn },
  );
}

export function buildObjectStoragePath(bucket: string, key: string) {
  return `s3://${bucket}/${key}`;
}

async function bodyToBuffer(body: {
  transformToByteArray?: () => Promise<Uint8Array>;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
}) {
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const iteratorFactory = body[Symbol.asyncIterator];
  if (typeof iteratorFactory === "function") {
    const chunks: Uint8Array[] = [];
    const iterator = iteratorFactory.call(body);
    let item = await iterator.next();
    while (!item.done) {
      chunks.push(item.value);
      item = await iterator.next();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  throw new Error("Unsupported object storage response body.");
}
