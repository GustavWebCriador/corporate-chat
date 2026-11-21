import { useContext } from "react";

import { RealtimeContext } from "../context/realtimeContext";

export function useRealtime() {
    const context = useContext(RealtimeContext);

    if (!context) {
        throw new Error(
            "useRealtime deve ser utilizado dentro do RealtimeProvider."
        );
    }

    return context;
}
