import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";

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

const ME = { user_id: "me", name: "Alexandre" };
const MARIA = { user_id: "u-1", name: "Maria Oliveira", email: "maria@empresa.com" };
const RAFAEL = { user_id: "u-2", name: "Rafael Santos", email: "rafael@empresa.com" };
const usersById = new Map([[MARIA.user_id, MARIA], [RAFAEL.user_id, RAFAEL]]);

function groupWith(creatorId) {
    return {
        group: {
            _id: "g-1",
            type: "GROUP",
            name: "Equipe",
            created_by: creatorId,
            members: [
                { user_id: creatorId, role: "CREATOR", status: "ACTIVE" },
                ...(creatorId === "me"
                    ? [{ user_id: "u-1", role: "MEMBER", status: "ACTIVE" }]
                    : [{ user_id: "me", role: "MEMBER", status: "ACTIVE" }]),
            ],
        },
    };
}

function renderDialog(props = {}) {
    return render(
        <GroupDetailsDialog
            groupId="g-1"
            currentUser={ME}
            usersById={usersById}
            onClose={vi.fn()}
            {...props}
        />
    );
}

beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    cleanup();
});

test("lista participantes com o papel de cada um", async () => {
    groupService.get.mockResolvedValue(groupWith("me"));

    renderDialog();

    expect(await screen.findByText("Alexandre (você)")).toBeInTheDocument();
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Criador")).toBeInTheDocument();
    expect(screen.getByText("Membro")).toBeInTheDocument();
    expect(screen.getByText("2 de 50 participantes")).toBeInTheDocument();
});

test("criador renomeia o grupo respeitando 30 caracteres (CA09.8)", async () => {
    const onRenamed = vi.fn();
    groupService.get.mockResolvedValue(groupWith("me"));
    groupService.rename.mockResolvedValue({ group: { name: "Equipe Nova" } });

    renderDialog({ onRenamed });

    const input = await screen.findByLabelText("Nome do grupo");
    expect(input).toHaveAttribute("maxLength", "30");

    fireEvent.change(input, { target: { value: "Equipe Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("Equipe Nova"));
    expect(groupService.rename).toHaveBeenCalledWith("g-1", "Equipe Nova");
});

test("criador adiciona participantes (CA09.6)", async () => {
    const onMembersChanged = vi.fn();
    groupService.get.mockResolvedValue(groupWith("me"));
    groupService.addMembers.mockResolvedValue({});

    renderDialog({ onMembersChanged });

    // Maria já participa; somente Rafael aparece para adicionar.
    fireEvent.click(await screen.findByRole("checkbox", { name: /Rafael Santos/ }));
    expect(screen.queryByRole("checkbox", { name: /Maria Oliveira/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));

    await waitFor(() => expect(onMembersChanged).toHaveBeenCalled());
    expect(groupService.addMembers).toHaveBeenCalledWith("g-1", ["u-2"]);
});

test("criador remove participante com confirmação (CA09.7)", async () => {
    groupService.get.mockResolvedValue(groupWith("me"));
    groupService.removeMember.mockResolvedValue(null);

    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "Remover Maria Oliveira" }));
    expect(groupService.removeMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção" }));

    const membersList = () =>
        screen.getByRole("region", { name: /de 50 participantes/ });

    await waitFor(() => {
        expect(within(membersList()).queryByText("Maria Oliveira")).not.toBeInTheDocument();
    });
    expect(within(membersList()).getByText("1 de 50 participantes")).toBeInTheDocument();
    expect(groupService.removeMember).toHaveBeenCalledWith("g-1", "u-1");

    // Removida, Maria volta a ser candidata a adição.
    expect(screen.getByRole("checkbox", { name: /Maria Oliveira/ })).toBeInTheDocument();
});

test("participante sai voluntariamente do grupo (CA09.9)", async () => {
    const onLeft = vi.fn();
    groupService.get.mockResolvedValue(groupWith("u-1"));
    groupService.leave.mockResolvedValue(null);

    renderDialog({ onLeft });

    // Membro comum não vê as ações do criador.
    await screen.findByText("Alexandre (você)");
    expect(screen.queryByLabelText("Nome do grupo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sair do grupo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar saída" }));

    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(groupService.leave).toHaveBeenCalledWith("g-1");
});

test("criador não vê a opção de sair", async () => {
    groupService.get.mockResolvedValue(groupWith("me"));

    renderDialog();

    await screen.findByText("Alexandre (você)");
    expect(screen.queryByRole("button", { name: "Sair do grupo" })).not.toBeInTheDocument();
});

test("mostra erro do backend ao adicionar quem já saiu", async () => {
    groupService.get.mockResolvedValue(groupWith("me"));
    groupService.addMembers.mockRejectedValue(
        Object.assign(new Error("x"), { status: 409, code: "GROUP_MEMBER_REENTRY_NOT_SUPPORTED" })
    );

    renderDialog();

    fireEvent.click(await screen.findByRole("checkbox", { name: /Rafael Santos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Quem saiu ou foi removido do grupo não pode ser adicionado novamente nesta versão."
    );
});
