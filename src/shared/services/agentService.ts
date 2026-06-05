// ============================================================
// AGENT SERVICE
// Single point of contact with your existing multimodal API.
// Replace BASE_URL and adapt request/response shape to match
// your API specification.
// ============================================================

import type { AgentRequest, AgentResponse, MessagePart } from '@/shared/types';

const BASE_URL = import.meta.env.VITE_AGENT_API_URL as string;
const API_KEY  = import.meta.env.VITE_AGENT_API_KEY  as string;

function buildHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
}

// Helper: convert image Part to base64 string if needed
function serializeParts(parts: MessagePart[]): unknown[] {
  return parts.map((part) => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'image') {
      return {
        type: 'image',
        mimeType: part.mimeType,
        data: part.data, // base64
      };
    }
    return part;
  });
}

/**
 * Send a message to the agent and receive the full response.
 */
export async function sendToAgent(req: AgentRequest): Promise<AgentResponse> {
  const body = {
    session_id: req.sessionId,
    user_id:    req.userId,
    user_name:  req.userName,
    history:    req.history,
    message:    serializeParts(req.message),
  };

  const response = await fetch(`${BASE_URL}`, {
    method:  'POST',
    headers: buildHeaders(),
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Agent API error ${response.status}: ${error}`);
  }

  const data = await response.json() as { text?: string; response?: string; content?: string };

  return {
    text:      data.text ?? data.response ?? data.content ?? '',
    sessionId: req.sessionId,
    metadata:  data as Record<string, unknown>,
  };
}

/**
 * Send a message and stream the response token by token (SSE).
 * Only works if your API supports Server-Sent Events or streaming JSON.
 * Set VITE_AGENT_SUPPORTS_STREAMING=true to enable.
 */
export async function* sendToAgentStreaming(
  req: AgentRequest,
): AsyncGenerator<string> {
  const body = {
    session_id: req.sessionId,
    user_id:    req.userId,
    user_name:  req.userName,
    history:    req.history,
    message:    serializeParts(req.message),
    stream:     true,
  };

  const response = await fetch(`${BASE_URL}`, {
    method:  'POST',
    headers: buildHeaders(),
    body:    JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent streaming error ${response.status}`);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Handle SSE format: "data: {...}\n\n"
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          const parsed = JSON.parse(raw) as { token?: string; text?: string };
          const token  = parsed.token ?? parsed.text ?? '';
          if (token) yield token;
        } catch {
          // raw text chunk (non-JSON streaming)
          if (raw) yield raw;
        }
      }
    }
  }
}

export const supportsStreaming =
  import.meta.env.VITE_AGENT_SUPPORTS_STREAMING === 'true';
