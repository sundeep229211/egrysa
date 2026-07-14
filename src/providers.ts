import type { ChatMessage, ChatRequest, ProviderConfig } from "./types.ts";

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export async function invokeProvider(
  provider: ProviderConfig,
  request: ChatRequest,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  if (!provider.allowedModels.includes(request.model)) {
    throw new ProviderError("model is not approved for this provider", 403);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return provider.kind === "anthropic"
      ? await invokeAnthropic(provider, request, controller.signal)
      : await invokeOpenAiCompatible(provider, request, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeOpenAiCompatible(
  provider: ProviderConfig,
  request: ChatRequest,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const headers = new Headers({ "content-type": "application/json" });
  const key = provider.apiKeyEnv ? Deno.env.get(provider.apiKeyEnv) : undefined;
  if (!provider.local && !key) {
    throw new ProviderError(`credential unavailable for provider ${provider.id}`, 503);
  }
  if (key) headers.set("authorization", `Bearer ${key}`);
  const body = sanitizeOpenAiRequest(request);
  const response = await fetch(
    `${provider.baseUrl.replace(/\/$/, "")}/v1/chat/completions`.replace("/v1/v1/", "/v1/"),
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
      redirect: "error",
    },
  );
  return await parseProviderResponse(response);
}

async function invokeAnthropic(
  provider: ProviderConfig,
  request: ChatRequest,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const key = provider.apiKeyEnv ? Deno.env.get(provider.apiKeyEnv) : undefined;
  if (!key) throw new ProviderError(`credential unavailable for provider ${provider.id}`, 503);
  const system = request.messages.filter((message) => message.role === "system").map((message) =>
    message.content
  ).join("\n\n");
  const messages = request.messages.filter((message) => message.role !== "system").map((
    { role, content },
  ) => ({ role, content }));
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model,
      messages,
      ...(system ? { system } : {}),
      max_tokens: request.max_tokens ?? 1024,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    }),
    signal,
    redirect: "error",
  });
  const raw = await parseProviderResponse(response);
  const blocks = Array.isArray(raw.content) ? raw.content as Array<Record<string, unknown>> : [];
  const content = blocks.filter((block) => block.type === "text").map((block) =>
    String(block.text ?? "")
  ).join("");
  return {
    id: raw.id ?? `sl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: raw.model ?? request.model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: raw.stop_reason ?? "stop",
    }],
    usage: raw.usage ?? {},
  };
}

function sanitizeOpenAiRequest(request: ChatRequest): Record<string, unknown> {
  const allowed = [
    "model",
    "messages",
    "temperature",
    "max_tokens",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
    "stop",
    "response_format",
    "seed",
  ];
  const body: Record<string, unknown> = {};
  for (const key of allowed) if (request[key] !== undefined) body[key] = request[key];
  body.stream = false;
  body.store = false;
  return body;
}

async function parseProviderResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw new ProviderError(
      `provider rejected the request (${response.status})`,
      response.status === 429 ? 429 : 502,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProviderError("provider returned an invalid response");
  }
  return parsed as Record<string, unknown>;
}

export function mapResponseContent(
  response: Record<string, unknown>,
  map: (text: string) => string,
): Record<string, unknown> {
  const choices = Array.isArray(response.choices) ? response.choices : [];
  return {
    ...response,
    choices: choices.map((choice) => {
      if (!choice || typeof choice !== "object") return choice;
      const typed = choice as Record<string, unknown>;
      const message = typed.message;
      if (!message || typeof message !== "object" || Array.isArray(message)) return choice;
      const msg = message as Record<string, unknown>;
      return {
        ...typed,
        message: {
          ...msg,
          content: typeof msg.content === "string" ? map(msg.content) : msg.content,
        },
      };
    }),
  };
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({ ...message }));
}
