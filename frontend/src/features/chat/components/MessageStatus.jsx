import { MESSAGE_STATUS } from "../utils/messages";

// Rótulos do fluxo Enviando → Enviada → Entregue → Lida, ou Falha (RF07).
const LABELS = {
    [MESSAGE_STATUS.SENDING]: { symbol: "…", text: "Enviando" },
    [MESSAGE_STATUS.SENT]: { symbol: "✓", text: "Enviada" },
    [MESSAGE_STATUS.DELIVERED]: { symbol: "✓✓", text: "Entregue" },
    [MESSAGE_STATUS.READ]: { symbol: "✓✓", text: "Lida" },
    [MESSAGE_STATUS.FAILED]: { symbol: "!", text: "Falha no envio" },
};

const COLORS = {
    [MESSAGE_STATUS.READ]: "text-teal-300",
    [MESSAGE_STATUS.FAILED]: "text-rose-500",
};

export function MessageStatus({ status }) {
    const label = LABELS[status];

    if (!label) {
        return null;
    }

    return (
        <span
            data-status={status}
            className={`inline-flex items-center gap-1 text-xs ${COLORS[status] ?? "text-slate-400"}`}
        >
            <span aria-hidden="true">{label.symbol}</span>
            <span>{label.text}</span>
        </span>
    );
}
