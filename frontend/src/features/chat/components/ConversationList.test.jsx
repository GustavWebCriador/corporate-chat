import { afterEach, expect, test, vi } from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { ConversationList } from "./ConversationList";

const conversations = [
    {
        conversation_id: "c-private",
        type: "PRIVATE",
        name: null,
        contact: { user_id: "u-2", name: "Maria Oliveira" },
        last_message: { content: "Bom dia!" },
        last_message_at: "2026-11-19T09:00:00Z",
    },
    {
        conversation_id: "c-group",
        type: "GROUP",
        name: "Equipe Projeto",
        contact: null,
        last_message: null,
        last_message_at: null,
    },
];

afterEach(() => {
    cleanup();
});

test("diferencia grupos das conversas privadas (CA05.3)", () => {
    const { container } = render(
        <ConversationList conversations={conversations} />
    );

    const groupButton = screen.getByRole("button", { name: /Equipe Projeto/ });
    const privateButton = screen.getByRole("button", { name: /Maria Oliveira/ });

    expect(groupButton).toHaveTextContent("Grupo");
    expect(privateButton).not.toHaveTextContent("Grupo");

    expect(container.querySelectorAll('[data-avatar="group"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-avatar="private"]')).toHaveLength(1);
});

test("mostra prévia da última mensagem e marca a conversa ativa", () => {
    render(
        <ConversationList
            conversations={conversations}
            activeId="c-group"
        />
    );

    expect(screen.getByText("Bom dia!")).toBeInTheDocument();
    expect(screen.getByText("Sem mensagens.")).toBeInTheDocument();

    expect(
        screen.getByRole("button", { name: /Equipe Projeto/ })
    ).toHaveAttribute("aria-current", "true");
});

test("seleciona a conversa ao clicar", () => {
    const onSelect = vi.fn();

    render(
        <ConversationList
            conversations={conversations}
            onSelect={onSelect}
        />
    );

    fireEvent.click(screen.getByRole("button", { name: /Maria Oliveira/ }));

    expect(onSelect).toHaveBeenCalledWith(conversations[0]);
});
