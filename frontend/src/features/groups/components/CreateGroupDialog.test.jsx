
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { groupService } from "../../../services/api/groupService";

vi.mock("../../../services/api/groupService", () => ({ groupService: { create: vi.fn() } }));

const contacts = [
    { user_id: "user-01", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE" },
];
const createdGroup = { _id: "507f1f77bcf86cd799439011", type: "GROUP", name: "Equipe" };

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function fillForm() {
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do grupo" }), {
        target: { value: "  Equipe  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" }));
}

test("deve impedir criação sem nome e participantes", () => {
    render(<CreateGroupDialog contacts={contacts} />);
    expect(screen.getByRole("button", { name: "Criar grupo" })).toBeDisabled();
    expect(groupService.create).not.toHaveBeenCalled();
});

test("deve criar o grupo com participantes selecionados", async () => {
    const onCreated = vi.fn();
    groupService.create.mockResolvedValue({ group: createdGroup });
    render(<CreateGroupDialog contacts={contacts} onCreated={onCreated} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    await waitFor(() => {
        expect(groupService.create).toHaveBeenCalledWith("Equipe", ["user-01"]);
        expect(onCreated).toHaveBeenCalledWith(createdGroup);
    });
});

test("deve apresentar erro retornado pela API", async () => {
    groupService.create.mockRejectedValue({ status: 400, code: "GROUP_NAME_TOO_LONG" });
    render(<CreateGroupDialog contacts={contacts} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O nome deve ter no máximo 30 caracteres.");
});

test("deve permitir tentar novamente após falha", async () => {
    groupService.create.mockRejectedValueOnce(new Error("Falha de rede")).mockResolvedValueOnce({ group: createdGroup });
    const onCreated = vi.fn();
    render(<CreateGroupDialog contacts={contacts} onCreated={onCreated} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    await waitFor(() => {
        expect(groupService.create).toHaveBeenCalledTimes(2);
        expect(onCreated).toHaveBeenCalledTimes(1);
    });
});

test("deve rejeitar uma resposta sem grupo válido", async () => {
    groupService.create.mockResolvedValue({ group: null });
    render(<CreateGroupDialog contacts={contacts} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível criar o grupo.");
});

test("deve permitir cancelar a criação", () => {
    const onClose = vi.fn();
    render(<CreateGroupDialog contacts={contacts} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("deve fechar com Escape", () => {
    const onClose = vi.fn();
    render(<CreateGroupDialog contacts={contacts} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
});
