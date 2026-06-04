import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('LWA Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('o2/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue LWA access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        grant_type: { type: 'string', example: 'refresh_token' },
        refresh_token: { type: 'string' },
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
      },
    },
  })
  async issueToken(@Body() body: any) {
    const { grant_type, refresh_token, client_id, client_secret } = body;

    if (!client_id || !client_secret) {
      throw new UnauthorizedException('client_id and client_secret are required');
    }

    return this.authService.issueToken({
      grantType: grant_type,
      refreshToken: refresh_token,
      clientId: client_id,
      clientSecret: client_secret,
    });
  }
}
