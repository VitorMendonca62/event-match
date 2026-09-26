/**
 * Stand-in for `POST https://api.brevo.com/v3/smtp/email` used only by the containerized E2E
 * suite. It stores accepted messages in memory and never forwards anything to the internet.
 */
interface BrevoEmail {
  readonly to: Array<{ readonly email: string }>;
  readonly subject: string;
  readonly textContent: string;
  readonly htmlContent: string;
  readonly headers?: { readonly idempotencyKey?: string };
}

interface StoredEmail {
  readonly to: string[];
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly idempotencyKey: string | null;
}

const messages: StoredEmail[] = [];
const seenKeys = new Map<string, string>();

const server = Bun.serve({
  port: Number(process.env.FAKE_BREVO_PORT ?? 4010),
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/v3/smtp/email') {
      if (!request.headers.get('api-key')) {
        return Response.json({ code: 'unauthorized', message: 'Missing API key' }, { status: 401 });
      }
      const body = (await request.json()) as BrevoEmail;
      const key = body.headers?.idempotencyKey ?? null;
      const existing = key ? seenKeys.get(key) : undefined;
      if (existing) return Response.json({ messageId: existing }, { status: 201 });

      const messageId = crypto.randomUUID();
      if (key) seenKeys.set(key, messageId);
      messages.push({
        to: body.to.map((recipient) => recipient.email),
        subject: body.subject,
        text: body.textContent,
        html: body.htmlContent,
        idempotencyKey: key,
      });
      return Response.json({ messageId }, { status: 201 });
    }
    if (request.method === 'GET' && url.pathname === '/__messages') return Response.json(messages);
    if (request.method === 'GET' && url.pathname === '/health') return new Response('ok');
    return new Response('not found', { status: 404 });
  },
});

console.log(`fake Brevo listening on ${server.port}`);
