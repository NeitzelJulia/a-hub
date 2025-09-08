import { useEffect, type RefObject } from "react";

export function useRemoteAudioSync(
    audioRef: RefObject<HTMLAudioElement | null>,
    audible: boolean,
    remoteVolume: number
) {
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        a.muted = !audible;
        a.volume = remoteVolume;
    }, [audioRef, audible, remoteVolume]);
}
