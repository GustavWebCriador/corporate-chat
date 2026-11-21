import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChatPanel } from "../../src/features/chat/components/ChatPanel";
import { conversationService } from "../../src/services/api/conversationService";
import { dashboardService } from "../../src/services/api/dashboardService";
import { groupService } from "../../src/services/api/groupService";

import { RUN_ID, SEED, loginAs } from "./helpers";

function usersMap(contacts) {
    return new Map(contacts.map((contact) => [contact.user_id, contact]));
}

describe("Conversas privadas e mensagens (FE-04 — RF05 a RF08, RF11)", () => {
    test("abre conversa pelo contato, envia mensagem e o destinatário vê no histórico", async () => {
        const alex = await loginAs(SEED.alexandre);
        const dashboard = await dashboardService.getDashboard();
        const eduardo = dashboard.contacts.find((contact) => contact.email === SEED.eduardo);

        expect(eduardo).toBeTruthy();

        const opened = await conversationService.openPrivate(eduardo.user_id);
        const reopened = await conversationService.openPrivate(eduardo.user_id);
        const conversationId = opened.conversation._id;

        expect(reopened.conversation._id).toBe(conversationId);

        render(
            <ChatPanel
                conversation={{
                    conversation_id: conversationId,
                    type: "PRIVATE",
                    name: null,
                    contact: eduardo,
                }}
                currentUser={alex.user}
                usersById={usersMap(dashboard.contacts)}
            />
        );

        const text = `Integração FE-04 ${RUN_ID}`;

        fireEvent.change(await screen.findByLabelText("Mensagem"), {
            target: { value: text },
        });
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

        await waitFor(() => {
            const item = screen.getByText(text).closest("li");
            expect(item.querySelector("[data-status]").dataset.status).toBe("sent");
        });

        // O destinatário encontra a mensagem no histórico.
        await loginAs(SEED.eduardo);
        const history = await conversationService.getHistory(conversationId);

        expect(history.items.some((message) => message.content === text)).toBe(true);
        expect(
            history.items.find((message) => message.content === text).sender_id
        ).toBe(alex.user.user_id);
    });

    test("aplica os limites de conteúdo e o envio idempotente (CA07.2/CA07.3/CA08.4)", async () => {
        await loginAs(SEED.alexandre);
        const dashboard = await dashboardService.getDashboard();
        const eduardo = dashboard.contacts.find((contact) => contact.email === SEED.eduardo);
        const { conversation } = await conversationService.openPrivate(eduardo.user_id);

        await expect(
            conversationService.sendMessage(conversation._id, {
                clientMessageId: `int-long-${RUN_ID}`,
                content: "x".repeat(1001),
            })
        ).rejects.toMatchObject({ status: 400 });

        await expect(
            conversationService.sendMessage(conversation._id, {
                clientMessageId: `int-empty-${RUN_ID}`,
                content: "   ",
            })
        ).rejects.toMatchObject({ status: 400 });

        const payload = {
            clientMessageId: `int-idem-${RUN_ID}`,
            content: "y".repeat(1000),
        };

        const first = await conversationService.sendMessage(conversation._id, payload);
        const retry = await conversationService.sendMessage(conversation._id, payload);

        expect(retry.reused).toBe(true);
        expect(retry.message._id).toBe(first.message._id);
    });

    test("carrega 50 mensagens e as anteriores ao pedir o histórico (CA11.2/CA11.3)", async () => {
        const alex = await loginAs(SEED.alexandre);
        const dashboard = await dashboardService.getDashboard();
        const eduardo = dashboard.contacts.find((contact) => contact.email === SEED.eduardo);

        // Conversa nova e exclusiva desta execução.
        const { group } = await groupService.create(`Pag ${RUN_ID}`.slice(0, 30), [eduardo.user_id]);

        for (let index = 1; index <= 55; index += 1) {
            await conversationService.sendMessage(group._id, {
                clientMessageId: `int-page-${RUN_ID}-${index}`,
                content: `Paginação ${index}`,
            });
        }

        render(
            <ChatPanel
                conversation={{
                    conversation_id: group._id,
                    type: "GROUP",
                    name: group.name,
                    contact: null,
                }}
                currentUser={alex.user}
                usersById={usersMap(dashboard.contacts)}
            />
        );

        expect(await screen.findByText("Paginação 55")).toBeInTheDocument();
        expect(screen.queryByText("Paginação 5")).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "Carregar mensagens anteriores" })
        );

        expect(await screen.findByText("Paginação 1")).toBeInTheDocument();
        expect(screen.getAllByText(/^Paginação \d+$/)).toHaveLength(55);
        expect(
            screen.queryByRole("button", { name: "Carregar mensagens anteriores" })
        ).not.toBeInTheDocument();
    });

    test("terceiros não acessam conversa privada alheia (RNF03)", async () => {
        await loginAs(SEED.alexandre);
        const dashboard = await dashboardService.getDashboard();
        const eduardo = dashboard.contacts.find((contact) => contact.email === SEED.eduardo);
        const { conversation } = await conversationService.openPrivate(eduardo.user_id);

        await loginAs(SEED.mauricio);

        await expect(
            conversationService.getHistory(conversation._id)
        ).rejects.toMatchObject({ status: 403 });
    });
});
