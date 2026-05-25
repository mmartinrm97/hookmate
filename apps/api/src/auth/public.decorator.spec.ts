import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('@Public() decorator', () => {
  it('sets metadata IS_PUBLIC_KEY to true on a class', () => {
    @Public()
    class TestController {}

    const metadata: boolean | undefined = Reflect.getOwnMetadata(IS_PUBLIC_KEY, TestController);
    expect(metadata).toBe(true);
  });

  it('exports the IS_PUBLIC_KEY constant value', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });
});
