import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { CreateGroupDialog } from "./CreateGroupDialog";
import { groupService } from "../../../services/api/groupService";

vi.mock("../../../services/api/groupService", () => ({
    groupService: {
        create: vi.fn(),
    },
}));

const contacts = [
    { user_id: "u-1", name: "Maria Oliveira", email: "maria@empresa.com" },
    { user_id: "u-2", name: "Rafael Santos", email: "rafael@empresa.com" },
];

beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    cleanup();
});

function renderDialog(props = {}) {
    return render(
        <CreateGroupDialog
            contacts={contacts}
            onClose={vi.fn()}
            onCreated={vi.fn()}
            {...props}
        />
    );
}

test("cria grupo com nome e participantes selecionados (CA09.1/CA09.2)", async () => {
    const onCreated = vi.fn();
    groupService.create.mockResolvedValue({
        group: { _id: "g-1", type: "GROUP", name: "Equipe" },
    });

    renderDialog({ onCreated });

    expect(screen.getByRole("dialog", { name: "Novo grupo" })).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Criar grupo" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
        target: { value: "  Equipe  " },
    });
    fireEvent.click(screen.getByLabelText(/Maria Oliveira/));

    expect(screen.getByText("2 de 50 participantes (incluindo você)")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await waitFor(() => {
        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "g-1" })
        );
    });

    expect(groupService.create).toHaveBeenCalledWith("Equipe", ["u-1"]);
});

test("limita o nome a 30 caracteres e exige participante (CA09.3/RN08)", () => {
    renderDialog();

    const nameInput = screen.getByLabelText("Nome do grupo");
    expect(nameInput).toHaveAttribute("maxLength", "30");

    fireEvent.change(nameInput, { target: { value: "Grupo sem membros" } });

    expect(screen.getByRole("button", { name: "Criar grupo" })).toBeDisabled();
});

test("mostra a mensagem do backend quando a criação falha", async () => {
    groupService.create.mockRejectedValue(
        Object.assign(new Error("x"), { status: 400, code: "INVALID_GROUP_SIZE" })
    );

    renderDialog();

    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
        target: { value: "Equipe" },
    });
    fireEvent.click(screen.getByLabelText(/Rafael Santos/));
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "O grupo deve ter entre 2 e 50 participantes, incluindo você."
    );
});

test("filtra contatos pela busca e fecha com Esc", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.change(screen.getByLabelText("Buscar participantes"), {
        target: { value: "rafael" },
    });

    expect(screen.queryByText("Maria Oliveira")).not.toBeInTheDocument();
    expect(screen.getByText("Rafael Santos")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
});
