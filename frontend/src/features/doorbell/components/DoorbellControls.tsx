import "./DoorbellControls.css";

type Props = Readonly<{
    audible: boolean;
    remoteVolume: number;
    micOn: boolean;
    hasMicTrack: boolean;

    onToggleAudible: () => void;
    onChangeRemoteVolume: (v: number) => void;
    onToggleMic: () => void;
    onPttDown: () => void;
    onPttUp: () => void;
}>;

export default function DoorbellControls({
                                             audible,
                                             remoteVolume,
                                             micOn,
                                             hasMicTrack,
                                             onToggleAudible,
                                             onChangeRemoteVolume,
                                             onToggleMic,
                                             onPttDown,
                                             onPttUp,
                                         }: Props) {
    return (
        <div className="doorbell-controls">
            <button onClick={onToggleAudible}>
                {audible ? "Ton aus" : "Ton an"}
            </button>

            <label className="doorbell-volume">
                Vol{" "}
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={remoteVolume}
                    onChange={(e) => onChangeRemoteVolume(parseFloat(e.target.value))}
                />
            </label>

            <div className="doorbell-divider" />

            <button onClick={onToggleMic} disabled={!hasMicTrack}>
                {micOn ? "Mic Off" : "Mic On"}
            </button>

            <button
                onMouseDown={onPttDown}
                onMouseUp={onPttUp}
                onTouchStart={onPttDown}
                onTouchEnd={onPttUp}
                disabled={!hasMicTrack}
                title="Gedrückt halten zum Sprechen"
            >
                Push-to-Talk
            </button>
        </div>
    );
}
