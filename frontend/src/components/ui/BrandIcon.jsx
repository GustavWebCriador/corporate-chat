const icons = {
    16: "/brand-icon-16.svg",
    32: "/brand-icon-32.svg",
    48: "/brand-icon-48.svg",
};

export function BrandIcon({
    size = 32,
    className = "",
    decorative = true,
}) {
    const assetSize =
        size <= 16 ? 16 :
        size <= 32 ? 32 : 48;

    return (
        <img
            src={icons[assetSize]}
            className={className}
            width={size}
            height={size}
            alt={
                decorative
                    ? ""
                    : "Ícone do Corporate Chat"
            }
            aria-hidden={
                decorative ? "true" : undefined
            }
            draggable={false}
        />
    );
}