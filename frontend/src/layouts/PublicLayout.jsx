import { Outlet } from "react-router-dom";

export function PublicLayout() {
    return (
        <div className="app-shell">
            <header className="app-header">
                <strong>Corporate Chat</strong>
            </header>

            <main className="app-main">
                <Outlet />
            </main>
        </div>
    );
}