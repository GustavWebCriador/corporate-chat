import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { adminUserService } from "../../../services/api/adminUserService";

vi.mock("../../../services/api/adminUserService", () => ({
    adminUserService: { list: vi.fn(), create: vi.fn(), changeStatus: vi.fn(), resetPassword: vi.fn() },
}));

const users = [
    { user_id: "admin-1", name: "Admin Teste", email: "admin@teste.com", status: "ACTIVE", is_admin: true },
    { user_id: "user-1", name: "Eduardo Silva", email: "eduardo@teste.com", status: "ACTIVE", is_admin: false },
    { user_id: "user-2", name: "Alexandre Lima", email: "alexandre@teste.com", status: "INACTIVE", is_admin: false },
];

beforeEach(() => {
    vi.resetAllMocks();
    adminUserService.list.mockResolvedValue({ users });
    adminUserService.create.mockResolvedValue({ user: users[1] });
    adminUserService.changeStatus.mockResolvedValue({ user: users[1] });
    adminUserService.resetPassword.mockResolvedValue(null);
});
afterEach(cleanup);

test("FE-08: lista usuários e impede desativar a própria conta", async () => {
    render(<AdminUsersPanel currentUserId="admin-1" />);
    expect(await screen.findByText("Eduardo Silva")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar Admin Teste" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ativar Alexandre Lima" })).toBeEnabled();
});

test("FE-08: filtra usuários por nome ou e-mail", async () => {
    render(<AdminUsersPanel currentUserId="admin-1" />);
    await screen.findByText("Eduardo Silva");
    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), { target: { value: "alexandre@" } });
    expect(screen.getByText("Alexandre Lima")).toBeInTheDocument();
    expect(screen.queryByText("Eduardo Silva")).not.toBeInTheDocument();
});

test("FE-08: cria usuário sem incluir is_admin", async () => {
    render(<AdminUsersPanel currentUserId="admin-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "  Maria Souza  " } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "  MARIA@EXEMPLO.COM  " } });
    fireEvent.change(screen.getByLabelText(/^Senha inicial/i), { target: { value: "SenhaForte123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(adminUserService.create).toHaveBeenCalledWith({
        name: "Maria Souza", email: "maria@exemplo.com", password: "SenhaForte123",
    }));
});

test("FE-08: desativa usuário somente após confirmação", async () => {
    render(<AdminUsersPanel currentUserId="admin-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Desativar Eduardo Silva" }));
    expect(adminUserService.changeStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(adminUserService.changeStatus).toHaveBeenCalledWith("user-1", "INACTIVE"));
});

test("FE-08: redefine senha pelo endpoint dedicado", async () => {
    render(<AdminUsersPanel currentUserId="admin-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Redefinir senha de Eduardo Silva" }));
    fireEvent.change(screen.getByLabelText(/^Nova senha/i), { target: { value: "NovaSenha123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(adminUserService.resetPassword).toHaveBeenCalledWith("user-1", "NovaSenha123"));
});

test("FE-08: apresenta falha HTTP e permite recarregar", async () => {
    adminUserService.list.mockRejectedValueOnce(new Error("Serviço indisponível"))
        .mockResolvedValue({ users });
    render(<AdminUsersPanel currentUserId="admin-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Serviço indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Eduardo Silva")).toBeInTheDocument();
});

test("FE-08: preserva modal e exibe erro do servidor", async () => {
    adminUserService.changeStatus.mockRejectedValueOnce(new Error("Operação não autorizada"));
    render(<AdminUsersPanel currentUserId="admin-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Desativar Eduardo Silva" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Operação não autorizada");
    expect(screen.getByRole("dialog", { name: "Alterar situação" })).toBeInTheDocument();
});
