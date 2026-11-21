// Paleta e cálculo de iniciais aproveitados do protótipo visual.
// Tons escuros: texto branco com contraste mínimo de 4,5:1 (WCAG AA).
const COLORS = [
    "bg-teal-700",
    "bg-violet-600",
    "bg-pink-700",
    "bg-amber-700",
    "bg-blue-600",
];

function getInitials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

    return (first + last).toUpperCase() || "?";
}

function colorFor(name = "") {
    let hash = 0;

    for (const char of name) {
        hash = (hash * 31 + char.charCodeAt(0)) % COLORS.length;
    }

    return COLORS[hash];
}

const SIZES = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-10 w-10 text-sm",
};

/**
 * Avatar com iniciais.
 *
 * Grupos usam formato e ícone próprios para se diferenciarem
 * visualmente das conversas privadas (CA05.3 / CA09.5).
 */
export function Avatar({ name, size = "md", isGroup = false }) {
    const sizeClass = SIZES[size] ?? SIZES.md;

    if (isGroup) {
        return (
            <span
                aria-hidden="true"
                data-avatar="group"
                className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-teal-400/40 bg-navy-700 text-teal-300`}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-1/2 w-1/2"
                >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            </span>
        );
    }

    return (
        <span
            aria-hidden="true"
            data-avatar="private"
            className={`${sizeClass} ${colorFor(name)} flex shrink-0 items-center justify-center rounded-lg font-semibold text-white`}
        >
            {getInitials(name)}
        </span>
    );
}
