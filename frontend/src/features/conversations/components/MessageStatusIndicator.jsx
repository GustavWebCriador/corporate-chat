
const STATUS_CONFIG = {
    sent: {
        label: "Enviada",
        symbol: "✓",
        className: "text-slate-400",
    },

    delivered: {
        label: "Entregue",
        symbol: "✓✓",
        className: "text-slate-300",
    },

    read: {
        label: "Lida",
        symbol: "✓✓",
        className: "text-sky-400",
    },
};

export function MessageStatusIndicator({ status }) {
    const config = STATUS_CONFIG[status];

    if (!config) {
        return null;
    }

    return (
        <span
            aria-label={`Status da mensagem: ${config.label}`}
            className={`inline-flex items-center gap-1 text-xs ${config.className}`}
        >
            <span aria-hidden="true">
                {config.symbol}
            </span>

            <span>
                {config.label}
            </span>
        </span>
    );
}
