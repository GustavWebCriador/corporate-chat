import { describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RegistrationRequestsPanel } from "../../src/features/admin/components/RegistrationRequestsPanel";
import { UsersPanel } from "../../src/features/admin/components/UsersPanel";
import { adminService } from "../../src/services/api/adminService";
import { registrationService } from "../../src/services/api/registrationService";
import { setAuthToken } from "../../src/services/api/httpClient";

import { RUN_ID, SEED, loginAs, tempPassword, tryLogin } from "./helpers";

const itemOf = (text) => screen.getByText(text).closest("li");

describe("Administração (FE-08 — RF03/RF04)", () => {
    test("analisa solicitações e gerencia usuários pela interface", async () => {
        await loginAs(SEED.alexandre);
        await expect(adminService.listUsers()).rejects.toMatchObject({ status: 403, code: "ADMIN_REQUIRED" });

        // Solicitações públicas.
        setAuthToken(null);
        const reqA = { name: `Aprovar ${RUN_ID}`, email: `aprovar.${RUN_ID}@integracao.local` };
        const reqR = { name: `Rejeitar ${RUN_ID}`, email: `rejeitar.${RUN_ID}@integracao.local` };
        await registrationService.requestAccess(reqA.name, reqA.email);
        await registrationService.requestAccess(reqR.name, reqR.email);
        expect(await tryLogin(reqA.email, tempPassword("A"))).toBe(401);

        const admin = await loginAs(SEED.gustavo);

        render(<RegistrationRequestsPanel />);
        await screen.findByText(reqA.name, {}, { timeout: 10000 });
        fireEvent.click(screen.getByRole("button", { name: `Aprovar ${reqA.name}` }));
        fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: tempPassword("A") } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
        await screen.findByText(new RegExp(`Acesso de ${reqA.name} aprovado`), {}, { timeout: 10000 });
        expect(await tryLogin(reqA.email, tempPassword("A"))).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: `Rejeitar ${reqR.name}` }));
        fireEvent.change(screen.getByLabelText("Motivo da rejeição"), { target: { value: "Teste de rejeição da integração." } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar rejeição" }));
        await screen.findByText(new RegExp(`Solicitação de ${reqR.name} rejeitada`), {}, { timeout: 10000 });
        fireEvent.click(screen.getByRole("button", { name: "Rejeitadas" }));
        await waitFor(() => expect(itemOf(reqR.name)).toHaveTextContent("Motivo: Teste de rejeição da integração."), { timeout: 10000 });
        expect(await tryLogin(reqR.email, tempPassword("A"))).toBe(401);
        cleanup();

        // Usuários.
        const novo = { name: `Novo ${RUN_ID}`, email: `novo.${RUN_ID}@integracao.local` };
        render(<UsersPanel currentUserId={admin.user.user_id} />);
        await screen.findByText("Eduardo", {}, { timeout: 10000 });
        expect(screen.getByRole("button", { name: `Desativar ${admin.user.name}` })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "+ Novo usuário" }));
        fireEvent.change(screen.getByLabelText("Nome"), { target: { value: novo.name } });
        fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: novo.email } });
        fireEvent.change(screen.getByLabelText("Senha inicial"), { target: { value: tempPassword("N") } });
        fireEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
        await screen.findByText(novo.name, { selector: "p" }, { timeout: 10000 });
        expect(await tryLogin(novo.email, tempPassword("N"))).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: `Desativar ${novo.name}` }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar desativação" }));
        await waitFor(() => expect(itemOf(novo.name)).toHaveTextContent("Inativo"), { timeout: 10000 });
        expect(await tryLogin(novo.email, tempPassword("N"))).not.toBe(true);

        fireEvent.click(screen.getByRole("button", { name: `Ativar ${novo.name}` }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar ativação" }));
        await waitFor(() => expect(itemOf(novo.name)).toHaveTextContent("Ativo"), { timeout: 10000 });

        fireEvent.click(screen.getByRole("button", { name: `Redefinir senha de ${novo.name}` }));
        fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: tempPassword("R") } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
        await screen.findByText(new RegExp(`Senha de ${novo.name} redefinida`), {}, { timeout: 10000 });
        expect(await tryLogin(novo.email, tempPassword("N"))).toBe(401);
        expect(await tryLogin(novo.email, tempPassword("R"))).toBe(true);

    });
});
