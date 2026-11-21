
import {
    afterEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { ContactList } from "./ContactList";

const contacts = [
    {
        user_id: "user-01",
        name: "Maria Oliveira",
        email: "maria@empresa.com",
        status: "ACTIVE",
    },
    {
        user_id: "user-02",
        name: "Rafael Santos",
        email: "rafael@empresa.com",
        status: "ACTIVE",
    },
];

afterEach(() => {
    cleanup();
});

test("deve apresentar os contatos disponíveis", () => {
    render(<ContactList contacts={contacts} />);

    expect(
        screen.getByText("Maria Oliveira")
    ).toBeInTheDocument();

    expect(
        screen.getByText("Rafael Santos")
    ).toBeInTheDocument();
});

test("deve informar quando não existem contatos", () => {
    render(<ContactList contacts={[]} />);

    expect(
        screen.getByRole("status")
    ).toHaveTextContent("Nenhum contato disponível.");
});

test("deve filtrar contatos pelo nome", () => {
    render(<ContactList contacts={contacts} />);

    fireEvent.change(
        screen.getByRole("searchbox", {
            name: "Buscar contatos",
        }),
        {
            target: {
                value: "MARIA",
            },
        }
    );

    expect(
        screen.getByText("Maria Oliveira")
    ).toBeInTheDocument();

    expect(
        screen.queryByText("Rafael Santos")
    ).not.toBeInTheDocument();
});

test("deve informar quando a pesquisa não encontra resultados", () => {
    render(<ContactList contacts={contacts} />);

    fireEvent.change(
        screen.getByRole("searchbox", {
            name: "Buscar contatos",
        }),
        {
            target: {
                value: "Inexistente",
            },
        }
    );

    expect(
        screen.getByRole("status")
    ).toHaveTextContent("Nenhum contato encontrado.");
});

test("deve selecionar o contato para iniciar conversa", () => {
    const onSelect = vi.fn();

    render(<ContactList contacts={contacts} onSelect={onSelect} />);

    fireEvent.click(
        screen.getByRole("button", {
            name: "Conversar com Rafael Santos",
        })
    );

    expect(onSelect).toHaveBeenCalledWith(contacts[1]);
});
