import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route handler or controller as publicly accessible,
 * bypassing the global API key guard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
