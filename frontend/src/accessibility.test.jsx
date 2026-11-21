import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { LoginPage } from "./pages/LoginPage";
import { RegistrationRequestPage } from "./pages/RegistrationRequestPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { AuthenticatedLayout } from "./layouts/AuthenticatedLayout";
import { CreateGroupDialog } from "./features/groups/components/CreateGroupDialog";
import { GroupDetailsDialog } from "./features/groups/components/GroupDetailsDialog";
import { ChatPanel } from "./features/chat/components/ChatPanel";
import { useAuth } from "./features/auth/hooks/useAuth";
import { dashboardService } from "./services/api/dashboardService";
import { conversationService } from "./services/api/conversationService";
import { groupService } from "./services/api/groupService";
import { adminService } from "./services/api/adminService";

vi.mock("./features/auth/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("./services/api/dashboardService", () => ({ dashboardService: { getDashboard: vi.fn() } }));
vi.mock("./services/api/conversationService", () => ({
    conversationService: { getHistory: vi.fn(), markRead: vi.fn(), sendMessage: vi.fn(), openPrivate: vi.fn() },
}));
vi.mock("./services/api/groupService", () => ({ groupService: { get: vi.fn(), create: vi.fn() } }));
vi.mock("./services/api/adminService", () => ({ adminService: { listRequests: vi.fn(), listUsers: vi.fn() } }));
vi.mock("./services/api/healthService", () => ({
    getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));

const ME = { user_id: "me", name: "Alexandre", is_admin: true };
const MARIA = { user_id: "u-1", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE" };

/**
 * Executa o axe no elemento renderizado. Contraste de cores não é
 * avaliado aqui (o jsdom não calcula layout); ele é verificado no
 * navegador durante a homologação.
 */
async function expectNoViolations(container) {
    const result = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
    });

    const summary = result.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
    );

    expect(summary).toEqual([]);
}

beforeEach(() => {
    vi.resetAllMocks();

    useAuth.mockReturnValue({
        user: ME,
        token: "jwt",
        loading: false,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
    });

    dashboardService.getDashboard.mockResolvedValue({
        contacts: [MARIA],
        conversations: [
            {
                conversation_id: "c-1",
                type: "PRIVATE",
                name: null,
                contact: MARIA,
                last_message: { content: "Olá" },
                last_message_at: "2026-11-20T10:00:00Z",
            },
            {
                conversation_id: "g-1",
                type: "GROUP",
                name: "Equipe",
                contact: null,
                last_message: null,
                last_message_at: null,
            },
        ],
    });

    conversationService.getHistory.mockResolvedValue({
        items: [
            { _id: "690000000000000000000001", sender_id: "u-1", client_message_id: "a", content: "Bom dia", created_at: "2026-11-20T10:00:00Z" },
            { _id: "690000000000000000000002", sender_id: "me", client_message_id: "b", content: "Olá", created_at: "2026-11-20T10:01:00Z" },
        ],
        hasMore: true,
        nextCursor: "cursor",
    });
    conversationService.markRead.mockResolvedValue({});

    groupService.get.mockResolvedValue({
        group: {
            _id: "g-1",
            name: "Equipe",
            members: [
                { user_id: "me", role: "CREATOR", status: "ACTIVE" },
                { user_id: "u-1", role: "MEMBER", status: "ACTIVE" },
            ],
        },
    });

    adminService.listRequests.mockResolvedValue({
        requests: [{ request_id: "r-1", name: "Joana", email: "joana@empresa.com", status: "PENDING", requested_at: "2026-11-20T10:00:00Z" }],
        pagination: { total: 1 },
    });
    adminService.listUsers.mockResolvedValue({ users: [{ ...MARIA, is_admin: false }] });
});

afterEach(() => {
    cleanup();
});

test("tela de login não possui problemas de acessibilidade", async () => {
    const { container } = render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await expectNoViolations(container);
});

test("tela de solicitação de acesso não possui problemas de acessibilidade", async () => {
    const { container } = render(<MemoryRouter><RegistrationRequestPage /></MemoryRouter>);
    await expectNoViolations(container);
});

test("dashboard com contatos e conversas não possui problemas de acessibilidade", async () => {
    const { container } = render(
        <MemoryRouter>
            <AuthenticatedLayout />
            <DashboardPage />
        </MemoryRouter>
    );

    await screen.findAllByText("Maria Oliveira");
    await expectNoViolations(container);
});

test("chat aberto não possui problemas de acessibilidade", async () => {
    const { container } = render(
        <ChatPanel
            conversation={{ conversation_id: "c-1", type: "PRIVATE", name: null, contact: MARIA }}
            currentUser={ME}
            usersById={new Map([[MARIA.user_id, MARIA]])}
        />
    );

    await screen.findByText("Bom dia");
    await expectNoViolations(container);
});

test("janelas de grupo não possuem problemas de acessibilidade", async () => {
    const create = render(<CreateGroupDialog contacts={[MARIA]} onClose={vi.fn()} onCreated={vi.fn()} />);
    await expectNoViolations(create.container);
    create.unmount();

    const details = render(
        <GroupDetailsDialog
            groupId="g-1"
            currentUser={ME}
            usersById={new Map([[MARIA.user_id, MARIA]])}
            onClose={vi.fn()}
        />
    );

    await screen.findByText("Alexandre (você)");
    await expectNoViolations(details.container);
});

test("administração não possui problemas de acessibilidade", async () => {
    const { container } = render(<MemoryRouter><AdminPage /></MemoryRouter>);

    await screen.findByText("Joana");
    await expectNoViolations(container);
});
