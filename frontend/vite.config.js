import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    test: {
        // Os testes de integração exigem o backend em execução
        // e rodam separadamente: npm run test:integration
        exclude: [
            ...configDefaults.exclude,
            "tests/integration/**",
        ],
    },
});
