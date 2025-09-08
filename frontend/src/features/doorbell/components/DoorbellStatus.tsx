type Props = Readonly<{
    wsOpen: boolean;
    sigState: RTCSignalingState;
    iceConn: RTCIceConnectionState;
    modalOpen: boolean;
    intercomText: string;
    err?: string | null;
}>;

export default function DoorbellStatus({
                                           wsOpen,
                                           sigState,
                                           iceConn,
                                           modalOpen,
                                           intercomText,
                                           err,
                                       }: Readonly<Props>) {
    return (
        <div>
            <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
                <div>
                    WS: <strong>{wsOpen ? "connected" : "disconnected"}</strong>
                </div>
                <div>
                    Signaling: <strong>{sigState}</strong>
                </div>
                <div>
                    ICE: <strong>{iceConn}</strong>
                </div>
                <div>
                    Modal: <strong>{modalOpen ? "open" : "closed"}</strong>
                </div>
                <div>
                    Intercom: <strong>{intercomText}</strong>
                </div>
            </div>

            {err && (
                <div style={{ color: "#f66", fontFamily: "monospace", fontSize: 12 }}>
                    {err}
                </div>
            )}
        </div>
    );
}