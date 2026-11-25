import { Outlet, useLocation } from "react-router-dom";
import { BrandIcon } from "../components/ui/BrandIcon";

export function PublicLayout() {
    const { pathname } = useLocation();
    if (pathname === "/login" || pathname === "/") return <Outlet />;
    return (
        <div className="mvp-public-shell">
            <header className="mvp-public-header">
            <BrandIcon size={32} alt="" />
            <strong>Corporate Chat</strong>
            </header>
            <main className="mvp-public-content"><Outlet /></main>
        </div>
    );
}