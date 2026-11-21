
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GroupDetailsDialog } from "./GroupDetailsDialog";
import { groupService } from "../../../services/api/groupService";

vi.mock("../../../services/api/groupService", () => ({
    groupService: {
        get: vi.fn(),
        rename: vi.fn(),
        addMembers: vi.fn(),
        removeMember: vi.fn(),
        leave: vi.fn(),
    },
}));

const groupId = "507f1f77bcf86cd799439011";
const creator = { user_id: "user-01", name: "Carlos" };
const contacts = [
    { user_id: "user-02", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE" },
    { user_id: "user-03", name: "Rafael Santos", email: "rafael@empresa.com", status: "ACTIVE" },
];
const group = {
    _id: groupId,
    type: "GROUP",
    name: "Equipe",
    members: [
        { user_id: "user-01", role: "CREATOR", status: "ACTIVE" },
        { user_id: "user-02", role: "MEMBER", status: "ACTIVE" },
    ],
};

beforeEach(() => {
    vi.resetAllMocks();
    groupService.get.mockResolvedValue({ group });
    groupService.rename.mockResolvedValue({ group });
    groupService.addMembers.mockResolvedValue({ group });
    groupService.removeMember.mockResolvedValue(null);
    groupService.leave.mockResolvedValue(null);
});
afterEach(cleanup);

function renderDialog(props = {}) {
    return render(
        <GroupDetailsDialog groupId={groupId} currentUser={creator} contacts={contacts} {...props} />
    );
}

test("deve carregar o grupo e listar participantes", async () => {
    renderDialog();
    expect(await screen.findByText("Equipe")).toBeInTheDocument();
    expect(screen.getByText("Carlos (você)")).toBeInTheDocument();
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(groupService.get).toHaveBeenCalledWith(groupId);
});

test("deve permitir renomear o grupo ao criador", async () => {
    renderDialog();
    fireEvent.change(await screen.findByRole("textbox", { name: "Novo nome do grupo" }), {
        target: { value: "Equipe Nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() => expect(groupService.rename).toHaveBeenCalledWith(groupId, "Equipe Nova"));
});

test("deve permitir adicionar participantes", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Rafael Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao grupo" }));
    await waitFor(() => expect(groupService.addMembers).toHaveBeenCalledWith(groupId, ["user-03"]));
});

test("deve exigir confirmação para remover participante", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Remover Maria Oliveira" }));
    expect(groupService.removeMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Maria Oliveira" }));
    await waitFor(() => expect(groupService.removeMember).toHaveBeenCalledWith(groupId, "user-02"));
});

test("não deve permitir remover o criador", async () => {
    renderDialog();
    await screen.findByText("Equipe");
    expect(screen.queryByRole("button", { name: "Remover Carlos (você)" })).not.toBeInTheDocument();
});

test("deve restringir operações administrativas aos membros comuns", async () => {
    renderDialog({ currentUser: { user_id: "user-02", name: "Maria Oliveira" } });
    await screen.findByText("Equipe");
    expect(screen.queryByRole("button", { name: "Salvar nome" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao grupo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair do grupo" })).toBeInTheDocument();
});

test("deve permitir a saída de participante comum", async () => {
    const onLeft = vi.fn();
    renderDialog({ currentUser: { user_id: "user-02", name: "Maria Oliveira" }, onLeft });
    fireEvent.click(await screen.findByRole("button", { name: "Sair do grupo" }));
    await waitFor(() => {
        expect(groupService.leave).toHaveBeenCalledWith(groupId);
        expect(onLeft).toHaveBeenCalledTimes(1);
    });
});

test("deve apresentar erro de autorização da API", async () => {
    groupService.rename.mockRejectedValue({ status: 403, code: "GROUP_CREATOR_REQUIRED" });
    renderDialog();
    fireEvent.change(await screen.findByRole("textbox", { name: "Novo nome do grupo" }), {
        target: { value: "Outro nome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Somente o criador pode realizar esta operação."
    );
});

test("deve permitir repetir consulta após falha", async () => {
    groupService.get
        .mockRejectedValueOnce(new Error("Falha de rede"))
        .mockResolvedValueOnce({ group });
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar os dados do grupo."
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Equipe")).toBeInTheDocument();
    expect(groupService.get).toHaveBeenCalledTimes(2);
});

test("deve permitir fechar o painel com Escape", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
});
