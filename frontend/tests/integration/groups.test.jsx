import { describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CreateGroupDialog } from "../../src/features/groups/components/CreateGroupDialog";
import { GroupDetailsDialog } from "../../src/features/groups/components/GroupDetailsDialog";
import { dashboardService } from "../../src/services/api/dashboardService";
import { groupService } from "../../src/services/api/groupService";

import { RUN_ID, SEED, loginAs } from "./helpers";

describe("Gerenciamento de grupos (FE-05 — RF09/RF10)", () => {
    test("cria, gerencia e sai de um grupo pela interface", async () => {
        const alex = await loginAs(SEED.alexandre);
        const dash = await dashboardService.getDashboard();
        const byEmail = (email) => dash.contacts.find((contact) => contact.email === email);
        const edu = byEmail(SEED.eduardo);
        const mau = byEmail(SEED.mauricio);
        const gus = byEmail(SEED.gustavo);
        const usersById = new Map(dash.contacts.map((c) => [c.user_id, c]));

        // Regras validadas pelo backend.
        await expect(groupService.create("x".repeat(31), [edu.user_id])).rejects.toMatchObject({ code: "GROUP_NAME_TOO_LONG" });
        await expect(groupService.create("Sem membros", [])).rejects.toMatchObject({ status: 400 });

        // Criação pela tela.
        let created;
        const nome = `Grupo ${RUN_ID}`.slice(0, 26);
        render(<CreateGroupDialog contacts={dash.contacts} onClose={() => {}} onCreated={(g) => { created = g; }} />);
        fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: nome } });
        fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(edu.name) }));
        fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(mau.name) }));
        fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
        await waitFor(() => expect(created?._id).toBeTruthy(), { timeout: 10000 });
        cleanup();

        const after = await dashboardService.getDashboard();
        expect(after.conversations.some((c) => c.conversation_id === created._id && c.type === "GROUP" && c.name === nome)).toBe(true);

        // Painel do criador: renomear, adicionar, remover.
        let renamed;
        render(<GroupDetailsDialog groupId={created._id} currentUser={alex.user} usersById={usersById} onClose={() => {}} onRenamed={(n) => { renamed = n; }} />);
        await screen.findByText("3 de 50 participantes", {}, { timeout: 10000 });
        fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: `${nome} R` } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        await waitFor(() => expect(renamed).toBe(`${nome} R`), { timeout: 10000 });

        fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(gus.name) }));
        fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));
        await screen.findByText("4 de 50 participantes", {}, { timeout: 10000 });

        fireEvent.click(screen.getByRole("button", { name: `Remover ${mau.name}` }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção" }));
        await screen.findByText("3 de 50 participantes", {}, { timeout: 10000 });

        // Reentrada não suportada: mensagem clara.
        fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(mau.name) }));
        fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));
        expect(await screen.findByRole("alert", {}, { timeout: 10000 })).toHaveTextContent("não pode ser adicionado novamente");
        cleanup();

        await expect(groupService.leave(created._id)).rejects.toMatchObject({ code: "GROUP_CREATOR_CANNOT_LEAVE" });

        // Eduardo sai pelo painel.
        const eduSession = await loginAs(SEED.eduardo);
        let left = false;
        render(<GroupDetailsDialog groupId={created._id} currentUser={eduSession.user} usersById={new Map([[alex.user.user_id, alex.user], [gus.user_id, gus]])} onClose={() => {}} onLeft={() => { left = true; }} />);
        await screen.findByRole("button", { name: "Sair do grupo" }, { timeout: 10000 });
        expect(screen.queryByLabelText("Nome do grupo")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Sair do grupo" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar saída" }));
        await waitFor(() => expect(left).toBe(true), { timeout: 10000 });
        await expect(groupService.get(created._id)).rejects.toMatchObject({ status: 403 });
    });
});
