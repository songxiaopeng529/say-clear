import type {
  Book,
  ClarityReport,
  CreateBookInput,
  CreateHighlightInput,
  Highlight,
  OpinionCard,
  PostMessageResponse,
  SessionDto,
  SessionProgress,
} from '@say-clear/types';

const BASE_URL = '/api';

export interface SessionFinalizationDto {
  required: boolean;
  completed: boolean;
}

/** API may enrich the shared snapshot with these recovery hints. */
export type SessionResponse = SessionDto & {
  progress?: SessionProgress;
  finalization?: SessionFinalizationDto;
  cardId?: string | null;
};

export interface FinishSessionResponse {
  report: ClarityReport;
  session: SessionResponse;
  finalization?: SessionFinalizationDto;
}

export interface AbandonSessionResponse {
  session: SessionResponse;
  progress?: SessionProgress;
  finalization?: SessionFinalizationDto;
}

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
    request<SessionResponse>(`/sessions/${sessionId}`, 'GET'),
  finishSession: (sessionId: string) =>
    request<FinishSessionResponse>(`/sessions/${sessionId}/finish`, 'POST'),
  abandonSession: (sessionId: string) =>
    request<AbandonSessionResponse>(`/sessions/${sessionId}/abandon`, 'POST'),
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
  requestId: string,
): Promise<PostMessageResponse> {
  return request<PostMessageResponse>(
    `/sessions/${sessionId}/messages`,
    'POST',
    { content, requestId },
  );
}
