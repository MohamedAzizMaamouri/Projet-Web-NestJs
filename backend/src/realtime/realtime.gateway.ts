import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeMessage, RealtimeService } from './realtime.service';

interface JoinEventPayload {
  eventId: number;
}

interface EventMessagePayload {
  eventId: number;
  type?: RealtimeMessage['type'];
  text: string;
  sender?: string;
}

@WebSocketGateway({
  cors: true,
  namespace: 'events',
})
export class RealtimeGateway {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly realtimeService: RealtimeService) {
    this.realtimeService.messages$.subscribe((message) => {
      this.server
        ?.to(this.eventRoom(message.eventId))
        .emit('eventMessage', message);
    });
  }

  @SubscribeMessage('joinEvent')
  async joinEvent(
    @MessageBody() payload: JoinEventPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const eventId = Number(payload?.eventId);
    await client.join(this.eventRoom(eventId));

    const availability = await this.realtimeService.getAvailability(eventId);
    client.emit('availability', availability);

    return { event: 'joinedEvent', data: { eventId } };
  }

  @SubscribeMessage('eventMessage')
  handleEventMessage(@MessageBody() payload: EventMessagePayload) {
    return this.realtimeService.publishMessage({
      eventId: Number(payload.eventId),
      type: payload.type ?? 'message',
      text: payload.text,
      sender: payload.sender,
    });
  }

  private eventRoom(eventId: number): string {
    return `event:${eventId}`;
  }
}
