import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { UsersPanel } from "./UsersPanel";
import { adminService } from "../../../services/api/adminService";

vi.mock("../../../services/api/adminService", () => ({
    adminService: {
        listUsers: vi.fn(),
        createUser: vi.fn(),
        setUserStatus: vi.fn(),
        resetPassword: vi.fn(),
    },
}));

const users = [
    { user_id: "admin", name: "Gestora", email: "gestora@empresa.com", status: "ACTIVE", is_admin: true, last_login_at: null },
    { user_id: "u-1", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE", is_admin: false, last_login_at: "2026-11-20T10:00:00Z" },
    { user_id: "u-2", name: "Rafael Santos", email: "rafael@empresa.com", status: "INACTIVE", is_admin: false, last_login_at: null },
];

beforeEach(() => {
    vi.resetAllMocks();
    adminService.listUsers.mockResolvedValue({ users });
});

afterEach(() => {
    cleanup();
});

function renderPanel() {
    return render(<UsersPanel currentUserId="admin" />);
}

test("lista usuários com situação e perfil (CA03.1)", async () => {
    renderPanel();

    expect(await screen.findByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getAllByText("Ativo")).toHaveLength(2);
    expect(screen.getByText("Inativo")).toBeInTheDocument();
});

test("cadastra usuário validando a senha (CA03.1)", async () => {
    adminService.createUser.mockResolvedValue({ user: { user_id: "u-3" } });

    renderPanel();
    await screen.findByText("Maria Oliveira");

    fireEvent.click(screen.getByRole("button", { name: "+ Novo usuário" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " Ana Souza " } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ANA@Empresa.com" } });
    fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: "semmaiuscula1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("letra maiúscula");
    expect(adminService.createUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: "SenhaValida1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));

    await waitFor(() => {
        expect(adminService.createUser).toHaveBeenCalledWith({
            name: "Ana Souza",
            email: "ana@empresa.com",
            password: "SenhaValida1",
        });
    });
    expect(await screen.findByText("Usuário Ana Souza cadastrado.")).toBeInTheDocument();
});

test("informa e-mail já cadastrado", async () => {
    adminService.createUser.mockRejectedValue(
        Object.assign(new Error("x"), { status: 409, code: "EMAIL_ALREADY_EXISTS" })
    );

    renderPanel();
    await screen.findByText("Maria Oliveira");

    fireEvent.click(screen.getByRole("button", { name: "+ Novo usuário" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "maria@empresa.com" } });
    fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: "SenhaValida1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um usuário com este e-mail.");
});

test("desativa usuário com confirmação (CA03.3)", async () => {
    adminService.setUserStatus.mockResolvedValue({});

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Desativar Maria Oliveira" }));
    expect(adminService.setUserStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar desativação" }));

    await waitFor(() => {
        expect(adminService.setUserStatus).toHaveBeenCalledWith("u-1", "INACTIVE");
    });
    await waitFor(() => {
        expect(adminService.listUsers).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText(/foi desativado/)).toBeInTheDocument();
});

test("reativa usuário inativo", async () => {
    adminService.setUserStatus.mockResolvedValue({});

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Ativar Rafael Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ativação" }));

    await waitFor(() => {
        expect(adminService.setUserStatus).toHaveBeenCalledWith("u-2", "ACTIVE");
    });
});

test("administrador não pode desativar a própria conta", async () => {
    renderPanel();

    expect(
        await screen.findByRole("button", { name: "Desativar Gestora" })
    ).toBeDisabled();
});

test("redefine senha validando a política (CA03.5)", async () => {
    adminService.resetPassword.mockResolvedValue(null);

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Redefinir senha de Maria Oliveira" }));

    const input = screen.getByLabelText("Nova senha");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.change(input, { target: { value: "SemNumero" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos um número");

    fireEvent.change(input, { target: { value: "NovaSenha123" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
        expect(adminService.resetPassword).toHaveBeenCalledWith("u-1", "NovaSenha123");
    });
});

test("filtra usuários pela busca", async () => {
    renderPanel();
    await screen.findByText("Maria Oliveira");

    fireEvent.change(screen.getByLabelText("Buscar usuários"), { target: { value: "rafael" } });

    expect(screen.queryByText("Maria Oliveira")).not.toBeInTheDocument();
    expect(screen.getByText("Rafael Santos")).toBeInTheDocument();
});
