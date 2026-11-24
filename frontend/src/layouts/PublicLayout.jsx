import { Outlet, useLocation } from "react-router-dom";

export function PublicLayout() {
    const { pathname } = useLocation();
    if (pathname === "/login" || pathname === "/") return <Outlet />;
    return (
        <div className="mvp-public-shell">
            <header className="mvp-public-header"><span className="mvp-logo-mark">Cc</span><strong>Corporate Chat</strong></header>
            <main className="mvp-public-content"><Outlet /></main>
        </div>
    );
}