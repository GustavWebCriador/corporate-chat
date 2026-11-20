
import { Outlet } from "react-router-dom";

export function AuthenticatedLayout() {
    return (
        <div className="grid min-h-screen grid-cols-[56px_minmax(0,1fr)] bg-navy-950 text-slate-300">
            <aside
                aria-label="Identidade da aplicação"
                className="flex flex-col items-center border-r border-slate-400/10 px-2 py-3"
            >
                <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-navy-950"
                    title="Corporate Chat"
                >
                    Cc
                </div>
            </aside>

            <div className="min-w-0">
                <Outlet />
            </div>
        </div>
    );
}
