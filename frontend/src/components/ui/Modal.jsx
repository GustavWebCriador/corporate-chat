import { useEffect, useId, useRef } from "react";

/**
 * Janela modal acessível: título associado, fecha com Esc e
 * leva o foco para dentro ao abrir.
 */
export function Modal({ title, onClose, children }) {
    const titleId = useId();
    const dialogRef = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;

        dialogRef.current
            ?.querySelector("input, button, textarea, select")
            ?.focus();

        function handleKey(event) {
            if (event.key === "Escape") {
                onClose?.();
            }
        }

        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("keydown", handleKey);
            previous?.focus?.();
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose?.();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-400/15 bg-navy-900 text-slate-300 shadow-xl"
            >
                <header className="flex items-center justify-between border-b border-slate-400/10 px-5 py-4">
                    <h2 id={titleId} className="text-base font-semibold">
                        {title}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="rounded-lg px-2 py-1 text-slate-400 hover:bg-navy-800"
                    >
                        ✕
                    </button>
                </header>

                <div className="min-h-0 overflow-y-auto px-5 py-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
