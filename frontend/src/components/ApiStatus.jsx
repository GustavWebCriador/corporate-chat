import { useEffect, useState } from "react";
import { getHealth } from "../services/api/healthService";

export function ApiStatus() {
    const [status, setStatus] = useState("checking");

    useEffect(() => {
        const controller = new AbortController();

        async function checkApi() {
            try {
                const result = await getHealth({
                    signal: controller.signal,
                });

                if (!controller.signal.aborted) {
                    setStatus(
                        result?.status === "ok"
                            ? "online"
                            : "offline"
                    );
                }
            } catch {
                if (!controller.signal.aborted) {
                    setStatus("offline");
                }
            }
        }

        checkApi();

        return () => {
            controller.abort();
        };
    }, []);

    const messages = {
        checking: "Verificando conexão...",
        online: "API disponível",
        offline: "API indisponível",
    };

    return (
        <p role="status" aria-live="polite">
            {messages[status]}
        </p>
    );
}