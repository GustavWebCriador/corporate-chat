import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "./AdminPage";
import { useAuth } from "../features/auth/hooks/useAuth";

vi.mock("../features/auth/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../features/admin/components/RegistrationRequestsPanel", () => ({
    RegistrationRequestsPanel: () => <div>Conteúdo de solicitações</div>,
}));
vi.mock("../features/admin/components/AdminUsersPanel", () => ({
    AdminUsersPanel: () => <div>Conteúdo de usuários</div>,
}));

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { user_id: "admin-1", name: "Admin Teste", is_admin: true } });
});
afterEach(cleanup);

test("FE-08: inicia na aba de solicitações e identifica o administrador", () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Administração" })).toBeInTheDocument();
    expect(screen.getByText(/Acesso administrativo: Admin Teste/)).toBeInTheDocument();
    expect(screen.getByText("Conteúdo de solicitações")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Solicitações de cadastro" })).toHaveAttribute("aria-selected", "true");
});

test("FE-08: alterna entre solicitações e usuários", () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Gerenciamento de usuários" }));
    expect(screen.getByText("Conteúdo de usuários")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo de solicitações")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gerenciamento de usuários" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Solicitações de cadastro" }));
    expect(screen.getByText("Conteúdo de solicitações")).toBeInTheDocument();
});