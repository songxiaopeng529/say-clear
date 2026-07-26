import type {
  Book,
  ClarityReport,
  CreateBookInput,
  CreateHighlightInput,
  Highlight,
  OpinionCard,
  Turn,
} from '@say-clear/types';

const BASE_URL = '/api';

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  data?: unknown,
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `请求失败 ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listBooks: () => request<Book[]>('/books', 'GET'),
  createBook: (input: CreateBookInput) => request<Book>('/books', 'POST', input),
  deleteBook: (id: string) => request<{ ok: true }>(`/books/${id}`, 'DELETE'),
  getBook: (id: string) =>
    request<Book & { highlights: Highlight[]; cards: OpinionCard[] }>(
      `/books/${id}`,
      'GET',
    ),
  addHighlight: (bookId: string, input: CreateHighlightInput) =>
    request<Highlight>(`/books/${bookId}/highlights`, 'POST', input),
  startSession: (bookId: string) =>
    request<{ id: string; firstQuestion: string }>(
      `/books/${bookId}/sessions`,
      'POST',
    ),
  getSession: (sessionId: string) =>
    request<{
      id: string;
      bookId: string;
      status: string;
      turns: Turn[];
      clarityReport: ClarityReport | null;
    }>(`/sessions/${sessionId}`, 'GET'),
  finishSession: (sessionId: string) =>
    request<ClarityReport>(`/sessions/${sessionId}/finish`, 'POST'),
  createCard: (sessionId: string) =>
    request<OpinionCard & { sourceQuotes?: string[] }>(
      `/sessions/${sessionId}/card`,
      'POST',
    ),
  listCards: () => request<OpinionCard[]>('/cards', 'GET'),
};

export async function sendFeynmanMessage(
  sessionId: string,
  content: string,
  onChunk: (delta: string) => void,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `追问失败 ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}
