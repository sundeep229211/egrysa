import type { ChatMessage, ChatRequest, ProviderConfig, ToolCall } from "./types.ts";

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export type ProviderInvocation =
  | { type: "json"; data: Record<string, unknown> }
  | { type: "stream"; response: Response; complete: () => void };

export async function invokeProvider(
  provider: ProviderConfig,
  request: ChatRequest,
  timeoutMs: number,
): Promise<ProviderInvocation> {
  if (!provider.allowedModels.includes(request.model)) {
    throw new ProviderError("model is not approved for this provider", 403);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (request.stream && provider.kind === "anthropic") {
      throw new ProviderError("streaming is not supported by the Anthropic adapter", 422);
    }
    if (provider.kind === "anthropic") {
      const data = await invokeAnthropic(provider, request, controller.signal);
      clearTimeout(timeout);
      return { type: "json", data };
    }
    const invocation = await invokeOpenAiCompatible(provider, request, controller.signal);
    if (invocation.type === "stream") {
      return { ...invocation, complete: () => clearTimeout(timeout) };
    }
    clearTimeout(timeout);
    return invocation;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function invokeOpenAiCompatible(
  provider: ProviderConfig,
  request: ChatRequest,
  signal: AbortSignal,
): Promise<ProviderInvocation> {
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
  if (request.stream) {
    if (!response.ok || !response.body) {
      await throwProviderResponse(response);
    }
    return { type: "stream", response, complete: () => undefined };
  }
  return { type: "json", data: await parseProviderResponse(response) };
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
  const messages = toAnthropicMessages(request.messages);
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
      ...(request.tools?.length && request.tool_choice !== "none"
        ? {
          tools: request.tools.map((tool) => ({
            name: tool.function.name,
            ...(tool.function.description === undefined
              ? {}
              : { description: tool.function.description }),
            input_schema: tool.function.parameters ?? { type: "object", properties: {} },
          })),
        }
        : {}),
      ...anthropicToolChoice(request.tool_choice),
    }),
    signal,
    redirect: "error",
  });
  const raw = await parseProviderResponse(response);
  const blocks = Array.isArray(raw.content) ? raw.content as Array<Record<string, unknown>> : [];
  const content = blocks.filter((block) => block.type === "text").map((block) =>
    String(block.text ?? "")
  ).join("");
  const toolCalls: ToolCall[] = blocks.filter((block) => block.type === "tool_use").map((
    block,
  ) => ({
    id: String(block.id ?? ""),
    type: "function" as const,
    function: {
      name: String(block.name ?? ""),
      arguments: JSON.stringify(block.input ?? {}),
    },
  }));
  return {
    id: raw.id ?? `egrysa-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: raw.model ?? request.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: content || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: mapAnthropicFinishReason(raw.stop_reason),
    }],
    usage: raw.usage ?? {},
  };
}

function sanitizeOpenAiRequest(request: ChatRequest): Record<string, unknown> {
  const allowed: Array<keyof ChatRequest> = [
    "model",
    "messages",
    "temperature",
    "max_tokens",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
    "seed",
    "tools",
    "tool_choice",
    "parallel_tool_calls",
    "stream_options",
  ];
  const body: Record<string, unknown> = {};
  for (const key of allowed) if (request[key] !== undefined) body[key] = request[key];
  body.stream = request.stream ?? false;
  body.store = false;
  return body;
}

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.filter((message) => message.role !== "system").map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: message.content ?? "",
        }],
      };
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      return {
        role: "assistant",
        content: [
          ...(message.content ? [{ type: "text", text: message.content }] : []),
          ...message.tool_calls.map((call) => ({
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input: parseToolArguments(call.function.arguments),
          })),
        ],
      };
    }
    return { role: message.role, content: message.content ?? "" };
  });
}

function parseToolArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new ProviderError("tool call arguments must be valid JSON", 422);
  }
}

function anthropicToolChoice(
  choice: ChatRequest["tool_choice"],
): Record<string, unknown> {
  if (choice === undefined || choice === "auto") return {};
  if (choice === "none") return {};
  if (choice === "required") return { tool_choice: { type: "any" } };
  return { tool_choice: { type: "tool", name: choice.function.name } };
}

function mapAnthropicFinishReason(value: unknown): string {
  switch (value) {
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "refusal":
      return "content_filter";
    case "end_turn":
    case "stop_sequence":
    default:
      return "stop";
  }
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

async function throwProviderResponse(response: Response): Promise<never> {
  await response.body?.cancel();
  throw new ProviderError(
    `provider rejected the request (${response.status})`,
    response.status === 429 ? 429 : 502,
  );
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
      const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined;
      return {
        ...typed,
        message: {
          ...msg,
          content: typeof msg.content === "string" ? map(msg.content) : msg.content,
          ...(toolCalls
            ? {
              tool_calls: toolCalls.map((call) => {
                if (!call || typeof call !== "object" || Array.isArray(call)) return call;
                const typedCall = call as Record<string, unknown>;
                const fn = typedCall.function;
                if (!fn || typeof fn !== "object" || Array.isArray(fn)) return call;
                const typedFunction = fn as Record<string, unknown>;
                return {
                  ...typedCall,
                  function: {
                    ...typedFunction,
                    arguments: typeof typedFunction.arguments === "string"
                      ? map(typedFunction.arguments)
                      : typedFunction.arguments,
                  },
                };
              }),
            }
            : {}),
        },
      };
    }),
  };
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({ ...message }));
}
