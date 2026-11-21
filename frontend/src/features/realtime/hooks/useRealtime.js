import { useContext } from "react";

import { RealtimeContext } from "../context/realtimeContext";

/**
 * Acesso à conexão Socket.IO da sessão (FE-06).
 */
export function useRealtime() {
    return useContext(RealtimeContext);
}
