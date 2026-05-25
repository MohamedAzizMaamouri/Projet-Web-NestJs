import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from './ticket.entity';

/**
 * Defines every valid status transition for a Ticket.
 *
 * Allowed transitions:
 *
 *   PENDING   → CONFIRMED              (payment successful)
 *   PENDING   → CANCELLED              (abandoned before confirmation)
 *   CONFIRMED → CANCELLED              (attendee cancels within the allowed window)
 *   CONFIRMED → REFUNDED               (organizer cancels the event — batch)
 *   CONFIRMED → SCANNED                (ticket scanned at the venue entrance)
 *
 * Everything else is forbidden.
 */
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.PENDING]: [
    TicketStatus.CONFIRMED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.CONFIRMED]: [
    TicketStatus.CANCELLED,
    TicketStatus.REFUNDED,
    TicketStatus.SCANNED,
  ],
  // Terminal states — no further transitions allowed
  [TicketStatus.CANCELLED]: [],
  [TicketStatus.REFUNDED]:  [],
  [TicketStatus.SCANNED]:   [],
};

/**
 * Validates and returns the new status.
 * Throws BadRequestException if the transition is illegal.
 *
 * @param from  Current ticket status
 * @param to    Desired next status
 * @returns     The desired status (for convenient chaining)
 */
export function transition(from: TicketStatus, to: TicketStatus): TicketStatus {
  const allowed = VALID_TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Invalid status transition: cannot move from '${from}' to '${to}'. ` +
      `Allowed transitions from '${from}': [${allowed.join(', ') || 'none'}].`,
    );
  }

  return to;
}
