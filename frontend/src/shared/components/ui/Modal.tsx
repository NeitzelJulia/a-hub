import React, { useEffect, useRef } from "react";
import "./Modal.css";

type ModalProps = Readonly<{
    open: boolean;
    onClose: () => void;
    titleId?: string;
    closeOnOverlay?: boolean;
    children: React.ReactNode;
}>;

export function Modal({
                          open,
                          onClose,
                          titleId,
                          closeOnOverlay = true,
                          children,
                      }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;

        if (open && !dlg.hasAttribute("open")) {
            try {
                dlg.setAttribute("open", "");
            } catch {
                dlg.setAttribute("open", "");
            }
        } else if (!open && dlg.hasAttribute("open")) {
            dlg.removeAttribute("open");
        }
    }, [open]);

    // ESC → schließen
    useEffect(() => {
        if (!open) return;
        const dlg = dialogRef.current;
        if (!dlg) return;

        const onCancel = (e: Event) => {
            e.preventDefault();
            onClose();
        };
        dlg.addEventListener("cancel", onCancel);
        return () => dlg.removeEventListener("cancel", onCancel);
    }, [open, onClose]);

    useEffect(() => {
        if (!open || !closeOnOverlay) return;

        const handler = (e: PointerEvent) => {
            const panel = panelRef.current;
            if (!panel) return;

            const path = (e.composedPath?.() ?? []);
            const clickedInside =
                path.includes(panel) ||
                (e.target instanceof Node && panel.contains(e.target));

            if (!clickedInside) {
                onClose();
            }
        };

        document.addEventListener("pointerdown", handler, { capture: true });
        return () => document.removeEventListener("pointerdown", handler, { capture: true });
    }, [open, closeOnOverlay, onClose]);

    if (!open) return null;

    return (
        <dialog
            ref={dialogRef}
            className="modal"
            aria-labelledby={titleId}
            aria-modal="true"
        >
            <div
                ref={panelRef}
                className="modal-panel"
                tabIndex={-1}
            >
                {children}
            </div>
        </dialog>
    );
}

export function ModalHeader(props: Readonly<{
    title: string;
    titleId?: string;
    onClose: () => void;
}>) {
    const { title, titleId = "modal-title", onClose } = props;
    return (
        <div className="modal-header">
            <h3 id={titleId}>{title}</h3>
            <button
                type="button"
                onClick={onClose}
                aria-label="Dialog schließen"
            >
                ✖
            </button>
        </div>
    );
}
