import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  it('compiles without errors with mocked ConfigService', async () => {
    await expect(
      Test.createTestingModule({
        imports: [AuthModule],
      })
        .useMocker((token: unknown) => {
          if (token === ConfigService) {
            return {
              get: vi.fn((key: string) => {
                if (key === 'API_KEYS') return 'test-key';
                return undefined;
              }),
            };
          }
          return undefined;
        })
        .compile(),
    ).resolves.toBeDefined();
  });

  it('rejects compile without ConfigService mock', async () => {
    await expect(
      Test.createTestingModule({
        imports: [AuthModule],
      }).compile(),
    ).rejects.toThrow();
  });
});
