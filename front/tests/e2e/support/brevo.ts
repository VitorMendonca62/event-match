import { requireEnv } from './env';

type FakeEmail = Readonly<{ to: string[]; subject: string; text: string }>;

async function messagesTo(address: string): Promise<FakeEmail[]> {
  const response = await fetch(new URL('/__messages', requireEnv('E2E_FAKE_BREVO_URL')));
  const all = (await response.json()) as FakeEmail[];
  return all.filter((message) => message.to.includes(address));
}

/** Delivery is synchronous in the backend, but polling keeps the helper robust to slow containers. */
async function lastMessage(address: string, count = 1): Promise<FakeEmail> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = await messagesTo(address);
    const last = messages.at(-1);
    if (last && messages.length >= count) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no email delivered to ${address}`);
}

/** Latest six-digit code sent to `address`; pass `count` to wait for a resend. */
export async function lastOtp(address: string, count = 1): Promise<string> {
  const otp = (await lastMessage(address, count)).text.match(/\b(\d{6})\b/)?.[1];
  if (!otp) throw new Error('no OTP in the latest email');
  return otp;
}

/** Callback URL of the latest email (`confirm-link`, ADR-024). */
export async function lastLink(address: string): Promise<string> {
  const link = (await lastMessage(address)).text.match(/https?:\/\/\S+token=[A-Za-z0-9_-]{43}/)?.[0];
  if (!link) throw new Error('no link in the latest email');
  return link;
}
