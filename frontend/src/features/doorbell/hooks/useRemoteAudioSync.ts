import { useEffect, type RefObject } from "react";

export function useRemoteAudioSync(
    audioRef: RefObject<HTMLAudioElement | null>,
    soundEnabled: boolean,
    remoteMuted: boolean,
    remoteVolume: number
) {
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        a.muted = !(soundEnabled && !remoteMuted);
        a.volume = remoteVolume;

        if (soundEnabled && !a.muted) {
            a.play().catch((e) => console.debug("audio play retry failed:", e));
        }
    }, [audioRef, soundEnabled, remoteMuted, remoteVolume]);
}
