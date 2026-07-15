import { constantTimeEqual, sha256 } from "./crypto.ts";

export class InboundAuth {
  private constructor(private readonly hashes: string[]) {}

  static async fromEnvironment(): Promise<InboundAuth> {
    const keys = (Deno.env.get("EGRYSA_INBOUND_KEYS") ?? "").split(",").map((key) => key.trim())
      .filter(Boolean);
    if (!keys.length || keys.some((key) => key.length < 24)) {
      throw new Error(
        "EGRYSA_INBOUND_KEYS must contain long, random keys of at least 24 characters",
      );
    }
    return new InboundAuth(await Promise.all(keys.map(sha256)));
  }

  async authorize(header: string | null): Promise<boolean> {
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = await sha256(header.slice(7));
    return this.hashes.reduce(
      (matched, hash) => constantTimeEqual(candidate, hash) || matched,
      false,
    );
  }
}
