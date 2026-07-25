import { buildFeynmanSystemPrompt } from '@say-clear/core';
import { streamFeynmanReply, type CoreMessage } from '@say-clear/ai';
import { postMessageSchema, type Turn } from '@say-clear/types';
import { handleApiError, notFound } from '@/lib/api-error';
import { requireUser } from '@/lib/auth';
import { loadBookContext } from '@/lib/book-context';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await requireUser();
    const body = postMessageSchema.parse(await request.json());
    const session = await prisma.feynmanSession.findFirst({
      where: { id: params.id, userId },
    });
    if (!session) notFound('会话不存在');

    const ctx = await loadBookContext(session.bookId);
    if (!ctx) notFound('书不存在');

    const turns = session.turns as unknown as Turn[];
    turns.push({ role: 'user', content: body.content, ts: new Date().toISOString() });
    const messages: CoreMessage[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    const result = streamFeynmanReply({
      system: buildFeynmanSystemPrompt(ctx),
      messages,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let full = '';
        try {
          for await (const chunk of result.textStream) {
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          turns.push({ role: 'assistant', content: full, ts: new Date().toISOString() });
          await prisma.feynmanSession.update({
            where: { id: params.id },
            data: { turns: turns as unknown as object },
          });
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
