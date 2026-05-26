import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketTiersService } from './ticket-tiers.service';
import { CreateTicketTierDto } from './dto/create-ticket-tier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Request } from 'express';
import { User } from '../users/user.entity';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('ticket-tiers')
@UseGuards(JwtAuthGuard)
export class TicketTiersController {
  constructor(private readonly tiersService: TicketTiersService) {}

  /**
   * POST /ticket-tiers
   * Organizer creates a new tier for one of their events.
   * Example body: { eventId: 1, name: "VIP", price: 150, capacity: 50 }
   */
  @Post('create')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('organizer', 'admin')
  create(@Body() dto: CreateTicketTierDto, @Req() req: Request) {
    return this.tiersService.createTier(dto, req.user as User);
  }

  /**
   * GET /ticket-tiers/event/:eventId
   * Public — list all tiers for a given event.
   */
  @Get('tiers/event/:eventId')
  @ApiBearerAuth()
  findByEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.tiersService.getTiersByEvent(eventId);
  }

  /**
   * DELETE /ticket-tiers/:id
   * Organizer deletes a tier (only if no tickets have been sold in it).
   */
  @Delete('delete/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('organizer', 'admin')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.tiersService.deleteTier(id, req.user as User);
  }
}