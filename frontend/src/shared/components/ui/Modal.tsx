import React, { useEffect } from "react";
import { createPortal } from "react-dom";
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
    // ESC schließt
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Body-Scroll sperren, solange Modal offen ist
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            className="modal-root"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={closeOnOverlay ? onClose : undefined}
        >
            <div className="modal-overlay" />
            <div
                className="modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
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
