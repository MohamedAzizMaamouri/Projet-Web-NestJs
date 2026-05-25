import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Request } from 'express';
import { User } from '../users/user.entity';
import {ApiBearerAuth} from "@nestjs/swagger";
import {TransitionEventStatusDto} from "./dto/transition-event-status.dto";

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('all')
  @ApiBearerAuth()
  findAll() {
    return this.eventsService.getAllEvents();
  }

  @Get(':id')
  @ApiBearerAuth()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.getEventById(id);
  }

  @Post('create')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizer', 'admin')
  create(@Body() dto: CreateEventDto, @Req() req: Request) {
    return this.eventsService.createEvent(dto, req.user as User);
  }

  @Patch('update/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateEventDto,
      @Req() req: Request,
  ) {
    return this.eventsService.updateEvent(id, dto, req.user as User);
  }

  @Delete('delete/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.eventsService.deleteEvent(id, req.user as User);
  }

  @Patch('cancel/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.eventsService.cancelEvent(id, req.user as User);
  }

  /**
   * GET /events/:id/revenue
   * Returns total revenue and tickets sold for an event.
   * Restricted to the event's organizer or an admin.
   */
  @Get('revenue/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizer', 'admin')
  getRevenue(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.eventsService.getEventRevenue(id, req.user as User);
  }

  @Patch('status/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  transition(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: TransitionEventStatusDto,
      @Req() req: Request,
  ) {
    return this.eventsService.transitionStatus(id, dto.status, req.user as User);
  }
}