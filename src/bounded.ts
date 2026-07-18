export class BodySizeLimitError extends Error {}

interface BodySource {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly headers: Headers;
}

export async function readBoundedBytes(source: BodySource, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(source.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await source.body?.cancel().catch(() => undefined);
    throw new BodySizeLimitError("body exceeded configured size limit");
  }
  if (!source.body) return new Uint8Array();
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodySizeLimitError("body exceeded configured size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedText(source: BodySource, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBoundedBytes(source, maxBytes));
}
