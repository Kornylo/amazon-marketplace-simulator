import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ScenariosService } from './scenarios.service';

@ApiTags('Scenarios (Internal)')
@Controller('mock/scenario')
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active scenario for a seller' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', example: 'A1MOCKSELLER123' },
        scenario: {
          type: 'string',
          enum: ['HEALTHY', 'LISTING_SUPPRESSION', 'OUT_OF_STOCK', 'PRICE_MISMATCH', 'BUY_BOX_HIJACKER', 'DIMENSION_CHANGE', 'MIXED_INCIDENTS'],
        },
        config: { type: 'object' },
      },
    },
  })
  async switchScenario(@Body() body: any) {
    const { sellerId, scenario, config } = body;
    return this.scenariosService.switchScenario(sellerId || 'A1MOCKSELLER123', scenario, config);
  }

  @Get()
  @ApiOperation({ summary: 'Get active scenario for a seller' })
  @ApiQuery({ name: 'sellerId', required: false })
  async getScenario(@Query('sellerId') sellerId: string) {
    return this.scenariosService.getScenario(sellerId || 'A1MOCKSELLER123');
  }
}
