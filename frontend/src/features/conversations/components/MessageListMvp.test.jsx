import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MessageList } from "./MessageList";

afterEach(cleanup);

test("FE-09: mantém o nome real do remetente e o conteúdo no layout MVP", () => {
    render(
        <MessageList
            currentUserId="user-atual"
            userNames={{ "user-remetente": "Ana Ferreira" }}
            messages={[{
                _id: "msg-01", sender_id: "user-remetente",
                content: "Mensagem de teste do MVP",
                created_at: "2026-11-23T13:14:00.000Z",
            }]}
        />
    );
    expect(screen.getByText("Ana Ferreira")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Mensagem recebida" }))
        .toHaveTextContent("Mensagem de teste do MVP");
});

test("FE-09: mantém a distinção acessível de mensagem enviada", () => {
    render(
        <MessageList
            currentUserId="user-atual" currentUserName="Eduardo"
            messages={[{ _id: "msg-02", sender_id: "user-atual", content: "Olá, equipe" }]}
        />
    );
    expect(screen.getByText("Eduardo")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Mensagem enviada por você" }))
        .toHaveTextContent("Olá, equipe");
});