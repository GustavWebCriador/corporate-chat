import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

import { AppRoutes } from "./AppRoutes";

test("deve apresentar a página de solicitação de acesso", () => {
    render(
        <MemoryRouter
            initialEntries={["/solicitar-acesso"]}
        >
            <AppRoutes />
        </MemoryRouter>
    );

    expect(
        screen.getByRole("heading", {
            name: "Solicitar acesso",
        })
    ).toBeInTheDocument();
});

test("deve apresentar página não encontrada", () => {
    render(
        <MemoryRouter
            initialEntries={["/pagina-inexistente"]}
        >
            <AppRoutes />
        </MemoryRouter>
    );

    expect(
        screen.getByRole("heading", {
            name: "Página não encontrada",
        })
    ).toBeInTheDocument();
});