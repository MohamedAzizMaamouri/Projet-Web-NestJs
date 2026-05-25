import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Request } from 'express';
import { User } from '../users/user.entity';
import {ApiBearerAuth} from "@nestjs/swagger";

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * POST /tickets
   * Any authenticated user can purchase a ticket.
   */
  @Post('purchase')
  @ApiBearerAuth()
  purchase(@Body() dto: CreateTicketDto, @Req() req: Request) {
    return this.ticketsService.purchaseTicket(dto, req.user as User);
  }

  /**
   * GET /tickets/my
   * Returns all tickets belonging to the authenticated user.
   */
  @Get('my')
  @ApiBearerAuth()
  getMyTickets(@Req() req: Request) {
    return this.ticketsService.getMyTickets(req.user as User);
  }

  /**
   * PATCH /tickets/:id/cancel
   * The ticket owner or an admin can cancel a CONFIRMED ticket.
   * The state machine rejects the request if the ticket is in any other status.
   */
  @Patch('cancel/:id')
  @ApiBearerAuth()
  cancelTicket(
      @Param('id', ParseIntPipe) id: number,
      @Req() req: Request,
  ) {
    return this.ticketsService.cancelTicket(id, req.user as User);
  }

  /**
   * PATCH /tickets/:id/scan
   * Only organizers (of that specific event) or admins can scan a ticket.
   * A SCANNED ticket cannot be scanned again — the state machine blocks it.
   */
  @Patch('scan/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('organizer', 'admin')
  scanTicket(
      @Param('id', ParseIntPipe) id: number,
      @Req() req: Request,
  ) {
    return this.ticketsService.scanTicket(id, req.user as User);
  }

  @Patch('refund/:id')
  @ApiBearerAuth()
  refundTicket(
      @Param('id', ParseIntPipe) id: number,
      @Req() req: Request,
  ) {
    return this.ticketsService.refundTicket(id, req.user as User);
  }
}