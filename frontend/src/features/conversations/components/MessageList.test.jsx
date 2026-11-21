
import {
    afterEach,
    expect,
    test,
} from "vitest";

import {
    cleanup,
    render,
    screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { MessageList } from "./MessageList";

afterEach(() => {
    cleanup();
});

const messages = [
    {
        _id: "msg-01",
        sender_id: "user-02",
        content: "Olá, tudo bem?",
    },
    {
        _id: "msg-02",
        sender_id: "user-01",
        content: "Tudo certo!",
    },
];

test("deve apresentar estado vazio", () => {
    render(
        <MessageList
            messages={[]}
            currentUserId="user-01"
        />
    );

    expect(
        screen.getByRole("status")
    ).toHaveTextContent(
        "Nenhuma mensagem nesta conversa."
    );
});

test("deve apresentar mensagens do histórico", () => {
    render(
        <MessageList
            messages={messages}
            currentUserId="user-01"
        />
    );

    expect(
        screen.getByText("Olá, tudo bem?")
    ).toBeInTheDocument();

    expect(
        screen.getByText("Tudo certo!")
    ).toBeInTheDocument();
});

test("deve diferenciar mensagens próprias e recebidas", () => {
    render(
        <MessageList
            messages={messages}
            currentUserId="user-01"
        />
    );

    expect(
        screen.getByRole("article", {
            name: "Mensagem enviada por você",
        })
    ).toHaveTextContent("Tudo certo!");

    expect(
        screen.getByRole("article", {
            name: "Mensagem recebida",
        })
    ).toHaveTextContent("Olá, tudo bem?");
});
