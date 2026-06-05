// ============================================================
// SHARED TYPES
// ============================================================

export interface User {
  uid: string;
  phone: string;
  name: string;
  createdAt: Date;
}

export type MessageRole = 'user' | 'assistant';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string; previewUrl?: string };

export interface Message {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRequest {
  sessionId: string;
  userId: string;
  userName: string;
  history: Array<{
    role: MessageRole;
    content: string;
  }>;
  message: MessagePart[];
}

export interface AgentResponse {
  text: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface Capability {
  id: string;
  icon: string;
  title: string;
  description: string;
  prompt: string;
}
