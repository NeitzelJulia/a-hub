export function getIntercomText(ready: boolean, on: boolean): string {
    if (!ready) return "not started";
    return on ? "mic on" : "mic off";
}

export function attachStream(
    el: HTMLMediaElement | null,
    stream: MediaStream | null
) {
    if (!el) return;
    el.srcObject = stream;
}

export function clearStream(el: HTMLMediaElement | null) {
    if (!el) return;

    if (!el.paused) {
        try {
            el.pause();
        } catch (e) {
            console.debug("clearStream: pause() threw, continuing to clear stream", e);
        }
    }

    el.srcObject = null;

    try {
        el.removeAttribute("src");
        el.load();
    } catch (e) {
        console.debug("clearStream: load() threw", e);
    }
}