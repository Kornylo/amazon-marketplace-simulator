import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SpApiGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'] || '';

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const sellerId = await this.authService.validateToken(token);

    if (!sellerId) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.sellerId = sellerId;
    return true;
  }
}
