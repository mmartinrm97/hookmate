import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validKeys: Set<string>;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const raw = this.configService.get<string>('API_KEYS') ?? '';
    this.validKeys = new Set(
      raw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    // Check @Public() decorator on the handler or controller
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException();
    }

    if (!this.validKeys.has(token)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
