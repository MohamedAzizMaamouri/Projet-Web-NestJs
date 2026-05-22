import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../users/user.entity';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  purchase(@Body() dto: CreateTicketDto, @Req() req: Request) {
    return this.ticketsService.purchaseTicket(dto, req.user as User);
  }

  @Get('my')
  getMyTickets(@Req() req: Request) {
    return this.ticketsService.getMyTickets(req.user as User);
  }
}
