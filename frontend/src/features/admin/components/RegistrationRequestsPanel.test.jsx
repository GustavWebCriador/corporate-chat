import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { RegistrationRequestsPanel } from "./RegistrationRequestsPanel";
import { adminService } from "../../../services/api/adminService";

vi.mock("../../../services/api/adminService", () => ({
    adminService: {
        listRequests: vi.fn(),
        approveRequest: vi.fn(),
        rejectRequest: vi.fn(),
    },
}));

const pending = {
    request_id: "r-1",
    name: "Joana Lima",
    email: "joana@empresa.com",
    status: "PENDING",
    requested_at: "2026-11-20T10:00:00Z",
    reviewed_at: null,
    rejection_reason: null,
};

function page(requests, total = requests.length) {
    return { requests, pagination: { limit: 20, offset: 0, total } };
}

beforeEach(() => {
    vi.resetAllMocks();
    adminService.listRequests.mockResolvedValue(page([pending]));
});

afterEach(() => {
    cleanup();
});

test("lista solicitações pendentes por padrão (CA04.3)", async () => {
    render(<RegistrationRequestsPanel />);

    expect(await screen.findByText("Joana Lima")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(adminService.listRequests).toHaveBeenCalledWith({
        status: "PENDING",
        limit: 20,
        offset: 0,
    });
});

test("aprova com senha inicial válida e avisa o administrador (CA04.4)", async () => {
    const onUserCreated = vi.fn();
    adminService.approveRequest.mockResolvedValue({});

    render(<RegistrationRequestsPanel onUserCreated={onUserCreated} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aprovar Joana Lima" }));

    const input = screen.getByLabelText("Senha inicial");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.change(input, { target: { value: "fraca" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no mínimo 8 caracteres");
    expect(adminService.approveRequest).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "SenhaInicial1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    await waitFor(() => {
        expect(adminService.approveRequest).toHaveBeenCalledWith("r-1", "SenhaInicial1");
    });
    expect(await screen.findByText(/Acesso de Joana Lima aprovado/)).toBeInTheDocument();
    expect(onUserCreated).toHaveBeenCalled();
    expect(adminService.listRequests).toHaveBeenCalledTimes(2);
});

test("rejeita somente com motivo", async () => {
    adminService.rejectRequest.mockResolvedValue({});

    render(<RegistrationRequestsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeitar Joana Lima" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rejeição" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o motivo da rejeição.");

    const reason = screen.getByLabelText("Motivo da rejeição");
    expect(reason).toHaveAttribute("maxLength", "500");

    fireEvent.change(reason, { target: { value: "  Pessoa externa à organização.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rejeição" }));

    await waitFor(() => {
        expect(adminService.rejectRequest).toHaveBeenCalledWith("r-1", "Pessoa externa à organização.");
    });
});

test("filtra por situação e mostra o motivo das rejeitadas", async () => {
    render(<RegistrationRequestsPanel />);
    await screen.findByText("Joana Lima");

    adminService.listRequests.mockResolvedValue(page([{
        ...pending,
        request_id: "r-2",
        name: "Carlos Melo",
        status: "REJECTED",
        reviewed_at: "2026-11-20T11:00:00Z",
        rejection_reason: "Dados incompletos.",
    }]));

    fireEvent.click(screen.getByRole("button", { name: "Rejeitadas" }));

    expect(await screen.findByText("Carlos Melo")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Dados incompletos.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aprovar/ })).not.toBeInTheDocument();
    expect(adminService.listRequests).toHaveBeenLastCalledWith({
        status: "REJECTED",
        limit: 20,
        offset: 0,
    });
});

test("mostra erro quando a solicitação já foi analisada", async () => {
    adminService.approveRequest.mockRejectedValue(
        Object.assign(new Error("x"), { status: 409, code: "REGISTRATION_REQUEST_ALREADY_REVIEWED" })
    );

    render(<RegistrationRequestsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Aprovar Joana Lima" }));
    fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: "SenhaInicial1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta solicitação já foi analisada.");
});

test("pagina quando há mais de 20 solicitações", async () => {
    adminService.listRequests.mockResolvedValue(page([pending], 25));

    render(<RegistrationRequestsPanel />);

    expect(await screen.findByText("1–20 de 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => {
        expect(adminService.listRequests).toHaveBeenLastCalledWith({
            status: "PENDING",
            limit: 20,
            offset: 20,
        });
    });
});
