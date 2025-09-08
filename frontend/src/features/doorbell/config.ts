export const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
];

export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    video: false,
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export const CHIME_ENDPOINT: string =
    (import.meta.env.VITE_CHIME_URL as string) ?? "/api/chime/play";