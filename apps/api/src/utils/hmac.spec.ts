import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from './hmac';

const SECRET = 'whsec_test_secret_key_123';
const PAYLOAD = Buffer.from(
  JSON.stringify({ event: 'user.signup', data: { email: 'test@example.com' } }),
);

describe('verifySignature', () => {
  describe('valid signature', () => {
    it('returns true for a correctly computed HMAC-SHA256 signature', () => {
      const signature = computeExpectedSignature(PAYLOAD, SECRET);

      const result = verifySignature(PAYLOAD, signature, SECRET);

      expect(result).toBe(true);
    });
  });

  describe('invalid signature', () => {
    it('returns false when the signature does not match', () => {
      const result = verifySignature(
        PAYLOAD,
        'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        SECRET,
      );

      expect(result).toBe(false);
    });

    it('returns false when the payload has been tampered with', () => {
      const signature = computeExpectedSignature(PAYLOAD, SECRET);
      const tamperedPayload = Buffer.from(
        JSON.stringify({ event: 'user.signup', data: { email: 'hacker@example.com' } }),
      );

      const result = verifySignature(tamperedPayload, signature, SECRET);

      expect(result).toBe(false);
    });
  });

  describe('missing or empty secret', () => {
    it('returns true when secret is null', () => {
      const result = verifySignature(PAYLOAD, 'sha256=anything', null as unknown as string);

      expect(result).toBe(true);
    });

    it('returns true when secret is undefined', () => {
      const result = verifySignature(PAYLOAD, 'sha256=anything', undefined as unknown as string);

      expect(result).toBe(true);
    });

    it('returns true when secret is empty string', () => {
      const result = verifySignature(PAYLOAD, 'sha256=anything', '');

      expect(result).toBe(true);
    });
  });

  describe('malformed signature format', () => {
    it('returns false when signature does not have sha256= prefix', () => {
      const result = verifySignature(PAYLOAD, 'abc123', SECRET);

      expect(result).toBe(false);
    });

    it('returns false when signature is empty', () => {
      const result = verifySignature(PAYLOAD, '', SECRET);

      expect(result).toBe(false);
    });
  });

  describe('length mismatch safety', () => {
    it('returns false when expected and actual have different lengths', () => {
      const result = verifySignature(PAYLOAD, 'sha256=abc', SECRET);

      expect(result).toBe(false);
    });
  });
});

function computeExpectedSignature(payload: Buffer, secret: string): string {
  const digest = createHmac('sha256', secret).update(payload).digest('hex');

  return `sha256=${digest}`;
}
