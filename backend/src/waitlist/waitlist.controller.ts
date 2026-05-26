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
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
@UseGuards(JwtAuthGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @ApiBearerAuth()
  join(@Body() dto: JoinWaitlistDto, @Req() req: Request) {
    return this.waitlistService.joinWaitlist(dto, req.user as User);
  }

  @Get('my')
  @ApiBearerAuth()
  getMyEntries(@Req() req: Request) {
    return this.waitlistService.getMyEntries(req.user as User);
  }

  @Get('event/:eventId')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('organizer', 'admin')
  getEventEntries(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Req() req: Request,
  ) {
    return this.waitlistService.getEventEntries(eventId, req.user as User);
  }
}
