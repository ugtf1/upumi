import { toSmsPhone } from './phone.js';

export async function sendOtpSms(phone: string, otp: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const from = process.env.TWILIO_FROM_PHONE ?? '';

  if (!accountSid || !authToken || !from) {
    const err: any = new Error('Twilio SMS is not configured');
    err.statusCode = 500;
    throw err;
  }

  const body = new URLSearchParams({
    To: toSmsPhone(phone),
    From: from,
    Body: `Your UPUMI login code is ${otp}. It expires in 10 minutes.`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(`Twilio SMS failed (${res.status}): ${text.slice(0, 180)}`);
    err.statusCode = 502;
    throw err;
  }
}
