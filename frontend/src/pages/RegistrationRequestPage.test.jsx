
import {
    afterEach,
    beforeEach,
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

import { MemoryRouter } from "react-router-dom";

import { RegistrationRequestPage } from "./RegistrationRequestPage";

import { registrationService } from "../services/api/registrationService";

/**
 * Simula a API de solicitações de cadastro.
 *
 * Nenhuma solicitação será gravada no banco.
 */
vi.mock("../services/api/registrationService", () => ({
    registrationService: {
        requestAccess: vi.fn(),
    },
}));

/**
 * Renderiza o formulário com React Router.
 */
function renderPage() {
    return render(
        <MemoryRouter>
            <RegistrationRequestPage />
        </MemoryRouter>
    );
}

/**
 * Preenche os campos do formulário.
 */
function fillForm(name, email) {
    fireEvent.change(
        screen.getByLabelText("Nome completo"),
        {
            target: { value: name },
        }
    );

    fireEvent.change(
        screen.getByLabelText("E-mail"),
        {
            target: { value: email },
        }
    );
}

beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    cleanup();
});

/**
 * TESTE 1
 *
 * O formulário deve apresentar
 * os campos necessários.
 */
test("deve apresentar o formulário de cadastro", () => {
    renderPage();

    expect(
        screen.getByRole("heading", {
            name: "Solicitar acesso",
        })
    ).toBeInTheDocument();

    expect(
        screen.getByLabelText("Nome completo")
    ).toBeInTheDocument();

    expect(
        screen.getByLabelText("E-mail")
    ).toHaveAttribute("maxlength", "150");
});

/**
 * TESTE 2
 *
 * Solicitação válida deve ser enviada
 * para a API com dados normalizados.
 */
test("deve enviar solicitação de cadastro válida", async () => {
    registrationService.requestAccess.mockResolvedValue({
        id: "solicitacao-01",
        status: "PENDING",
    });

    renderPage();

    fillForm(
        "  Usuário Teste  ",
        "  TESTE@EMPRESA.COM.BR  "
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Solicitar acesso",
        })
    );

    await waitFor(() => {
        expect(
            registrationService.requestAccess
        ).toHaveBeenCalledWith(
            "Usuário Teste",
            "teste@empresa.com.br"
        );
    });

    expect(
        await screen.findByRole("heading", {
            name: "Solicitação enviada!",
        })
    ).toBeInTheDocument();
});

/**
 * TESTE 3
 *
 * Erros de validação devem ser
 * apresentados ao usuário.
 */
test("deve apresentar erro de validação da API", async () => {
    const error = new Error(
        "Dados da solicitação inválidos."
    );

    error.status = 400;

    registrationService.requestAccess.mockRejectedValue(
        error
    );

    renderPage();

    fillForm(
        "Usuário Teste",
        "teste@empresa.com.br"
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Solicitar acesso",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Dados da solicitação inválidos."
    );
});

/**
 * TESTE 4
 *
 * O frontend deve respeitar o rate limit
 * aplicado pelo backend.
 */
test("deve tratar excesso de solicitações", async () => {
    const error = new Error(
        "Muitas solicitações."
    );

    error.status = 429;

    registrationService.requestAccess.mockRejectedValue(
        error
    );

    renderPage();

    fillForm(
        "Usuário Teste",
        "teste@empresa.com.br"
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Solicitar acesso",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Muitas solicitações. Tente novamente mais tarde."
    );
});
