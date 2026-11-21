import { afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { setAuthToken } from "../../src/services/api/httpClient";
import { BACKEND_URL, PASSWORD } from "./helpers";

beforeAll(async () => {
    if (!BACKEND_URL || !PASSWORD) {
        throw new Error(
            "Configure VITE_BACKEND_URL e INTEGRATION_PASSWORD " +
            "(senha do seed de desenvolvimento) para os testes de integração."
        );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/health`).catch(() => null);
    const health = await response?.json().catch(() => null);

    if (health?.data?.status !== "ok") {
        throw new Error(
            `Backend indisponível em ${BACKEND_URL}. ` +
            "Inicie o backend com PostgreSQL e MongoDB antes de executar."
        );
    }
});

afterEach(() => {
    cleanup();
    setAuthToken(null);
});
