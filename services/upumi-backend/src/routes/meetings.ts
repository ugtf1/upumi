import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

// ---------------------------------------------------------------------------
// Gemini-based AI summarisation
// ---------------------------------------------------------------------------
async function summariseWithGemini(transcript: string, title: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  // If no API key is configured, return a plain truncated excerpt so the
  // feature still works without blocking the save.
  if (!apiKey) {
    const excerpt = transcript.length > 600 ? transcript.slice(0, 600) + '…' : transcript;
    return `(AI summary unavailable — add GEMINI_API_KEY to .env)\n\n${excerpt}`;
  }

  const prompt = `You are a professional meeting secretary for a community organisation. Summarise the following meeting transcript concisely using clear bullet points. Cover: key decisions made, action items, important announcements, financial discussions, and any other notable points. Keep the language professional and easy to read.

Meeting title: ${title}

Transcript:
${transcript}

---
Provide a well-structured summary now:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    'Summary could not be generated.'
  );
}

// Helper to ensure meetings table exists in PostgreSQL database if migration hasn't run
async function ensureMeetingsTableExists() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "meetings" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "transcription" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    // Non-fatal warning
  }
}

// ---------------------------------------------------------------------------
// Admin-only meeting routes
// ---------------------------------------------------------------------------
export const meetingRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/admin/meetings
  // Body: { title, transcript, date? }
  app.post('/meetings', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    await ensureMeetingsTableExists();

    const Body = z
      .object({
        title: z.string().min(1, 'Title is required'),
        transcript: z.string().min(1, 'Transcript is required'),
        date: z.string().optional(),
      })
      .parse(req.body ?? {});

    const meetingDate = Body.date ? new Date(Body.date) : new Date();
    if (isNaN(meetingDate.getTime())) {
      return reply.code(400).send({ message: 'Invalid date' });
    }

    // Generate AI summary (gracefully degrades if Gemini key is missing)
    let summary: string;
    try {
      summary = await summariseWithGemini(Body.transcript, Body.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.warn(`Gemini summarisation failed: ${msg}`);
      summary =
        Body.transcript.length > 600
          ? Body.transcript.slice(0, 600) + '…'
          : Body.transcript;
    }

    const meeting = await (prisma as any).meeting.create({
      data: {
        title: Body.title,
        date: meetingDate,
        transcription: Body.transcript,
        summary,
      },
    });

    return meeting;
  });

  // GET /api/admin/meetings
  app.get('/meetings', { preHandler: requireRole('ADMIN') }, async () => {
    await ensureMeetingsTableExists();
    return (prisma as any).meeting.findMany({
      orderBy: { date: 'desc' },
    });
  });

  // DELETE /api/admin/meetings/:id
  app.delete('/meetings/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    await ensureMeetingsTableExists();
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const existing = await (prisma as any).meeting.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: 'Meeting not found' });
    await (prisma as any).meeting.delete({ where: { id } });
    return { ok: true };
  });
};

// ---------------------------------------------------------------------------
// Member-safe (read-only) meeting route
// ---------------------------------------------------------------------------
export const memberMeetingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/members/meetings
  // Returns only the summary (not the full raw transcription) for privacy.
  app.get('/meetings', { preHandler: requireAuth }, async () => {
    await ensureMeetingsTableExists();
    return (prisma as any).meeting.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        title: true,
        date: true,
        summary: true,
        createdAt: true,
      },
    });
  });
};

