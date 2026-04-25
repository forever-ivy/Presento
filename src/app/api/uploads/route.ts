import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  buildStoredFileRecord,
  uploadDateFolder,
} from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return NextResponse.json(
      { error: "No files were uploaded." },
      { status: 400 },
    );
  }

  const uploadedAt = new Date().toISOString();
  const dateFolder = uploadDateFolder(uploadedAt);
  const uploadDirectory = path.join(process.cwd(), ".data", "uploads", dateFolder);
  await mkdir(uploadDirectory, { recursive: true });

  const uploadedFiles = await Promise.all(
    files.map(async (file) => {
      const nonce = crypto.randomUUID().slice(0, 8);
      const record = buildStoredFileRecord(
        {
          name: file.name,
          size: file.size,
          type: file.type,
        },
        {
          nonce,
          uploadedAt,
        },
      );

      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDirectory, record.storedName), bytes);

      return record;
    }),
  );

  return NextResponse.json({ uploadedFiles });
}
