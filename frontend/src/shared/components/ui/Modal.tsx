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

    // ESC schließt
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Öffnen/Schließen steuern
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;

        if (open && !dlg.open) {
            try {
                if (typeof dlg.showModal === "function") dlg.showModal();
                else dlg.setAttribute("open", ""); // Safari Fallback
            } catch {
                dlg.setAttribute("open", "");
            }
        }
        if (!open && dlg.open) {
            try {
                dlg.close();
            } finally {
                dlg.removeAttribute("open");
            }
        }
    }, [open]);


    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;

        const onPointerDown = (e: PointerEvent) => {
            if (!closeOnOverlay) return;
            if (e.target === dlg) onClose();
        };


        const onCancel = (e: Event) => {
            e.preventDefault();
            onClose();
        };

        dlg.addEventListener("pointerdown", onPointerDown);
        dlg.addEventListener("cancel", onCancel);
        return () => {
            dlg.removeEventListener("pointerdown", onPointerDown);
            dlg.removeEventListener("cancel", onCancel);
        };
    }, [closeOnOverlay, onClose]);

    if (!open) return null;

    return (
        <dialog
            ref={dialogRef}
            className="modal-content"
            aria-labelledby={titleId}
        >
            {children}
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
