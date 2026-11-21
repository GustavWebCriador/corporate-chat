
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
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { MessageComposer } from "./MessageComposer";

afterEach(() => {
    cleanup();
});

test("deve impedir envio de mensagens vazias ou muito longas", () => {
    const onSend = vi.fn();

    render(<MessageComposer onSend={onSend} />);

    const field = screen.getByRole("textbox", {
        name: "Mensagem",
    });

    const button = screen.getByRole("button", {
        name: "Enviar",
    });

    expect(button).toBeDisabled();

    fireEvent.change(field, {
        target: {
            value: "   ",
        },
    });

    expect(button).toBeDisabled();

    fireEvent.change(field, {
        target: {
            value: "a".repeat(1001),
        },
    });

    expect(button).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
});

test("deve enviar a mensagem e limpar o campo após sucesso", async () => {
    const onSend = vi.fn().mockResolvedValue({});
    const createClientMessageId = vi.fn()
        .mockReturnValue("msg-001");

    render(
        <MessageComposer
            onSend={onSend}
            createClientMessageId={createClientMessageId}
        />
    );

    const field = screen.getByRole("textbox", {
        name: "Mensagem",
    });

    fireEvent.change(field, {
        target: {
            value: "Olá, tudo bem?",
        },
    });

    fireEvent.click(
        screen.getByRole("button", {
            name: "Enviar",
        })
    );

    await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith({
            clientMessageId: "msg-001",
            content: "Olá, tudo bem?",
        });

        expect(field).toHaveValue("");
    });

    expect(createClientMessageId).toHaveBeenCalledTimes(1);
});

test("deve reutilizar o mesmo identificador após falha", async () => {
    const onSend = vi.fn()
        .mockRejectedValueOnce(new Error("Falha de rede"))
        .mockResolvedValueOnce({});

    const createClientMessageId = vi.fn()
        .mockReturnValue("msg-retry-001");

    render(
        <MessageComposer
            onSend={onSend}
            createClientMessageId={createClientMessageId}
        />
    );

    fireEvent.change(
        screen.getByRole("textbox", {
            name: "Mensagem",
        }),
        {
            target: {
                value: "Mensagem de teste",
            },
        }
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Enviar",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível enviar a mensagem."
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar novamente",
        })
    );

    await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(2);
    });

    expect(onSend).toHaveBeenNthCalledWith(
        1,
        {
            clientMessageId: "msg-retry-001",
            content: "Mensagem de teste",
        }
    );

    expect(onSend).toHaveBeenNthCalledWith(
        2,
        {
            clientMessageId: "msg-retry-001",
            content: "Mensagem de teste",
        }
    );

    expect(createClientMessageId).toHaveBeenCalledTimes(1);
});

test("deve gerar novo identificador quando o conteúdo mudar", async () => {
    const onSend = vi.fn()
        .mockRejectedValueOnce(new Error("Falha"))
        .mockResolvedValueOnce({});

    const createClientMessageId = vi.fn()
        .mockReturnValueOnce("msg-001")
        .mockReturnValueOnce("msg-002");

    render(
        <MessageComposer
            onSend={onSend}
            createClientMessageId={createClientMessageId}
        />
    );

    const field = screen.getByRole("textbox", {
        name: "Mensagem",
    });

    fireEvent.change(field, {
        target: { value: "Primeiro texto" },
    });

    fireEvent.click(
        screen.getByRole("button", {
            name: "Enviar",
        })
    );

    await screen.findByRole("alert");

    fireEvent.change(field, {
        target: { value: "Texto alterado" },
    });

    fireEvent.click(
        screen.getByRole("button", {
            name: "Enviar",
        })
    );

    await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(2);
    });

    expect(onSend).toHaveBeenNthCalledWith(
        2,
        {
            clientMessageId: "msg-002",
            content: "Texto alterado",
        }
    );

    expect(createClientMessageId).toHaveBeenCalledTimes(2);
});
