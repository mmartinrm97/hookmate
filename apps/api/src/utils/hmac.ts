import * as crypto from 'crypto';

export function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!secret) {
    return true;
  }

  const prefix = 'sha256=';

  if (!signature.startsWith(prefix)) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = signature.slice(prefix.length);

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
