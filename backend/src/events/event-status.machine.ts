import {EventStatus} from "./event.entity";
import {BadRequestException} from "@nestjs/common";

export const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    [EventStatus.PUBLISHED]: [EventStatus.ONGOING, EventStatus.CANCELLED],
    [EventStatus.ONGOING]:   [EventStatus.ENDED,   EventStatus.CANCELLED],
    [EventStatus.ENDED]:     [],
    [EventStatus.CANCELLED]: [],
};

export function transitionEvent(from: EventStatus, to: EventStatus): EventStatus {
    const allowed = ALLOWED_TRANSITIONS[from];

    if (!allowed.includes(to)) {
        throw new BadRequestException(
            `Invalid status transition: cannot move from '${from}' to '${to}'. ` +
            `Allowed transitions from '${from}': [${allowed.join(', ') || 'none'}].`,
        );
    }

    return to;
}