type Props = Readonly<{
    soundEnabled: boolean;
    remoteMuted: boolean;
    remoteVolume: number;
    canStartIntercom: boolean;
    micOn: boolean;
    hasMicTrack: boolean;
    iceConn: RTCIceConnectionState;

    onEnableSound: () => void;
    onToggleRemoteMute: () => void;
    onChangeRemoteVolume: (v: number) => void;
    onStartIntercom: () => void;
    onToggleMic: () => void;
    onPttDown: () => void;
    onPttUp: () => void;
}>;

export default function DoorbellControls({
                                             soundEnabled,
                                             remoteMuted,
                                             remoteVolume,
                                             canStartIntercom,
                                             micOn,
                                             hasMicTrack,
                                             iceConn,
                                             onEnableSound,
                                             onToggleRemoteMute,
                                             onChangeRemoteVolume,
                                             onStartIntercom,
                                             onToggleMic,
                                             onPttDown,
                                             onPttUp,
                                         }: Props) {
    return (
        <div className="doorbell-controls">
            <button className="btn btn-secondary" onClick={onEnableSound} disabled={soundEnabled}>
                Ton einschalten
            </button>

            <button className="btn btn-secondary" onClick={onToggleRemoteMute}>
                {remoteMuted ? "Unmute" : "Mute"}
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

            <button className="btn btn-primary" onClick={onStartIntercom} disabled={!canStartIntercom}>
                Mikro einschalten
            </button>

            <button className="btn btn-dark" onClick={onToggleMic} disabled={!hasMicTrack}>
                {micOn ? "Mic Off" : "Mic On"}
            </button>

            <button
                className="btn btn-secondary"
                onMouseDown={onPttDown}
                onMouseUp={onPttUp}
                onTouchStart={onPttDown}
                onTouchEnd={onPttUp}
                disabled={!hasMicTrack}
                title="Gedrückt halten zum Sprechen"
            >
                Push-to-Talk
            </button>

            <div className="doorbell-ice">ICE: {iceConn}</div>
        </div>
    );
}