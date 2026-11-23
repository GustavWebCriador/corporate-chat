import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { RegistrationRequestsPanel } from "./RegistrationRequestsPanel";
import { adminRegistrationService } from "../../../services/api/adminRegistrationService";

vi.mock("../../../services/api/adminRegistrationService", () => ({
    adminRegistrationService: { list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}));

const request = {
    request_id: "req-01", name: "Maria Oliveira", email: "maria@empresa.com",
    status: "PENDING", requested_at: "2026-11-21T11:00:00Z",
};

beforeEach(() => {
    vi.resetAllMocks();
    adminRegistrationService.list.mockResolvedValue({ requests: [request], pagination: { total: 1, limit: 20, offset: 0 } });
    adminRegistrationService.approve.mockResolvedValue({ request: { ...request, status: "APPROVED" } });
    adminRegistrationService.reject.mockResolvedValue({ request: { ...request, status: "REJECTED" } });
});
afterEach(cleanup);

test("FE-08: mostra solicitações pendentes e as ações", async () => {
    render(<RegistrationRequestsPanel />);
    expect(await screen.findByText("Maria Oliveira")).toBeInTheDocument();
    expect(adminRegistrationService.list).toHaveBeenCalledWith({ status: "PENDING", limit: 20, offset: 0 });
    expect(screen.getByRole("button", { name: "Aprovar Maria Oliveira" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeitar Maria Oliveira" })).toBeInTheDocument();
});

test("FE-08: aprova solicitação com senha inicial válida", async () => {
    render(<RegistrationRequestsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Aprovar Maria Oliveira" }));
    expect(screen.getByRole("dialog", { name: "Aprovar solicitação" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha inicial do novo usuário/), { target: { value: "SenhaInicial123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar análise" }));
    await waitFor(() => expect(adminRegistrationService.approve).toHaveBeenCalledWith("req-01", "SenhaInicial123"));
    expect(await screen.findByText(/Solicitação de Maria Oliveira aprovada com sucesso/)).toBeInTheDocument();
});

test("FE-08: rejeita solicitação com justificativa obrigatória", async () => {
    render(<RegistrationRequestsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Rejeitar Maria Oliveira" }));
    fireEvent.change(screen.getByLabelText("Justificativa obrigatória"), { target: { value: "Dados incorretos" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar análise" }));
    await waitFor(() => expect(adminRegistrationService.reject).toHaveBeenCalledWith("req-01", "Dados incorretos"));
});

test("FE-08: altera filtro de solicitações e permite tentar novamente", async () => {
    adminRegistrationService.list.mockRejectedValueOnce(new Error("Falha HTTP"))
        .mockResolvedValue({ requests: [], pagination: { total: 0 } });
    render(<RegistrationRequestsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha HTTP");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma solicitação encontrada.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "ALL" } });
    await waitFor(() => expect(adminRegistrationService.list).toHaveBeenCalledWith({ status: "ALL", limit: 20, offset: 0 }));
});

test("FE-08: navega na paginação enviada pelo backend", async () => {
    adminRegistrationService.list.mockResolvedValue({ requests: [request], pagination: { total: 30 } });
    render(<RegistrationRequestsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(adminRegistrationService.list).toHaveBeenCalledWith({ status: "PENDING", limit: 20, offset: 20 }));
});

test("FE-08: não permite aprovar com senha fora da política", async () => {
    render(<RegistrationRequestsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Aprovar Maria Oliveira" }));
    fireEvent.change(screen.getByLabelText(/Senha inicial do novo usuário/), { target: { value: "senhasemnumero" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar análise" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/senha inicial deve ter/i);
    expect(adminRegistrationService.approve).not.toHaveBeenCalled();
});