
import { Outlet } from "react-router-dom";

import { ConnectionStatus } from "../features/realtime/components/ConnectionStatus";

export function AuthenticatedLayout() {
    return (
        <div className="app-surface grid min-h-screen grid-cols-1 bg-navy-950 text-slate-300 sm:grid-cols-[56px_minmax(0,1fr)]">
            {/* Atalho para quem navega pelo teclado (FE-09). */}
            <a
                href="#conteudo"
                className="sr-only rounded-lg bg-teal-500 px-4 py-2 font-semibold text-navy-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
            >
                Pular para o conteúdo
            </a>

            <aside
                aria-label="Identidade da aplicação"
                className="hidden flex-col items-center border-r border-slate-400/10 px-2 py-3 sm:flex"
            >
                <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-navy-950"
                    title="Corporate Chat"
                >
                    Cc
                </div>
            </aside>

            <div className="min-w-0">
                <ConnectionStatus />
                <Outlet />
            </div>
        </div>
    );
}
