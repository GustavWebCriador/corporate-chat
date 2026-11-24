/** FE-09 — Avatar visual inspirado na branch corporate-chat-completo.
 * Não afirma presença online: a API ainda não fornece esse estado.
 */
const palette = ["#18b998", "#8358e8", "#0caaa6", "#df408b", "#306eb7", "#ad7545"];

export function MvpAvatar({ name = "Usuário", size = 26 }) {
    const safeName = typeof name === "string" && name.trim() ? name.trim() : "Usuário";
    const initials = safeName.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
    const index = [...safeName].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;

    return (
        <span
            className="mvp-avatar"
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                backgroundColor: palette[index],
                fontSize: Math.max(10, Math.round(size * 0.38)),
            }}
        >
            {initials}
        </span>
    );
}