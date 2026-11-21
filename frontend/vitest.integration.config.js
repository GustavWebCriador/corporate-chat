import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Testes de integração front/back (FE-07).
 *
 * Executam o código real do frontend contra o backend em execução,
 * com PostgreSQL e MongoDB populados pelo seed de desenvolvimento.
 *
 * Variáveis obrigatórias:
 *   VITE_BACKEND_URL      URL do backend (ex.: http://localhost:3000)
 *   INTEGRATION_PASSWORD  senha dos usuários do seed (DEV_SEED_PASSWORD)
 */
export default defineConfig({
    plugins: [react()],
    test: {
        include: ["tests/integration/**/*.test.{js,jsx}"],
        environment: "jsdom",
        environmentOptions: {
            jsdom: {
                // Origem do frontend em desenvolvimento (CORS e Socket.IO).
                url: "http://localhost:5173/",
            },
        },
        setupFiles: ["tests/integration/setup.js"],
        fileParallelism: false,
        testTimeout: 60000,
        hookTimeout: 30000,
    },
});
