import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../users/user.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoCodesService } from './promo-codes.service';

@Controller('promo-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('organizer', 'admin')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post('create')
  @ApiBearerAuth()
  create(@Body() dto: CreatePromoCodeDto, @Req() req: Request) {
    return this.promoCodesService.createPromoCode(dto, req.user as User);
  }

  @Get('event/:eventId')
  @ApiBearerAuth()
  findForEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Req() req: Request,
  ) {
    return this.promoCodesService.getEventPromoCodes(eventId, req.user as User);
  }
}
