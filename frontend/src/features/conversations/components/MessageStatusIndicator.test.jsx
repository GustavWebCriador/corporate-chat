
import {
    cleanup,
    render,
    screen,
} from "@testing-library/react";

import {
    afterEach,
    expect,
    test,
} from "vitest";

import "@testing-library/jest-dom/vitest";

import { MessageStatusIndicator } from "./MessageStatusIndicator";

afterEach(() => {
    cleanup();
});

test("deve apresentar mensagem enviada", () => {
    render(
        <MessageStatusIndicator status="sent" />
    );

    expect(
        screen.getByText("Enviada")
    ).toBeInTheDocument();
});

test("deve apresentar mensagem entregue", () => {
    render(
        <MessageStatusIndicator status="delivered" />
    );

    expect(
        screen.getByText("Entregue")
    ).toBeInTheDocument();
});

test("deve apresentar mensagem lida", () => {
    render(
        <MessageStatusIndicator status="read" />
    );

    expect(
        screen.getByText("Lida")
    ).toBeInTheDocument();
});

test("não deve apresentar indicador para estado inválido", () => {
    const { container } = render(
        <MessageStatusIndicator status={null} />
    );

    expect(container).toBeEmptyDOMElement();
});
