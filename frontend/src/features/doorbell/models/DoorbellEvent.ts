export type DoorbellEvent = {
    id: number;
    occurredAtMillis: number;
    answered: boolean;
    talkSeconds: number;
};

export type DoorbellEventCreateResponseDto = {
    id: number;
    occurredAtMillis: number;
};
