/**
 * Corporate Chat — FE-07
 * Integração HTTP + Socket.IO contra o backend LOCAL e os bancos reais de DEV.
 * NUNCA executar contra produção: cria solicitações, conversas, grupos e mensagens.
 * Reutiliza socket.io-client já declarado no frontend/package.json.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import {
    assertLocalBackendUrl,
    createApi,
    waitSocketEvent,
    socketAck,
    assertMessage,
} from "./fe07-live-core.mjs";

const SERVER = assertLocalBackendUrl(
    process.env.FE07_BACKEND_URL || "http://127.0.0.1:3000"
);

if (process.env.FE07_ALLOW_LOCAL_WRITES !== "SIM") {
    throw new Error("FE-07 bloqueada: confirme FE07_ALLOW_LOCAL_WRITES=SIM para testar na base DEV local.");
}
const PASSWORD = process.env.FE07_DEV_PASSWORD;
if (!PASSWORD) {
    throw new Error("FE07_DEV_PASSWORD ausente. Utilize o executor PowerShell, que solicita a senha sem salvá-la.");
}

const EMAILS = {
    admin: process.env.FE07_ADMIN_EMAIL || "gustavo@corporatechat.local",
    a: process.env.FE07_USER_A_EMAIL || "eduardo@corporatechat.local",
    b: process.env.FE07_USER_B_EMAIL || "alexandre@corporatechat.local",
    c: process.env.FE07_USER_C_EMAIL || "mauricio@corporatechat.local",
};
if (new Set(Object.values(EMAILS).map((s) => s.toLowerCase())).size !== 4) {
    throw new Error("Informe quatro contas distintas (admin, usuário A, B e C).");
}

const request = createApi(SERVER);
const idRun = randomUUID().slice(0, 8);
const sockets = new Set();
const sessions = [];
let approvedUserId = null;
let adminToken = null;
let assertionsPassed = 0;

async function runStep(title, fn) {
    process.stdout.write(`  ${String(assertionsPassed + 1).padStart(2, "0")}. ${title} ... `);
    try {
        await fn();
        assertionsPassed += 1;
        process.stdout.write("OK\n");
    } catch (error) {
        process.stdout.write("FALHOU\n");
        throw error;
    }
}

function newSocket(token) {
    const socket = io(SERVER, {
        autoConnect: false,
        reconnection: false,
        forceNew: true,
        timeout: 10000,
        auth: { token },
        transports: ["websocket", "polling"],
    });
    sockets.add(socket);
    return socket;
}

async function connectSocket(socket) {
    const ready = waitSocketEvent(socket, "realtime:ready", () => true, 12000);
    socket.connect();
    await ready;
    assert.equal(socket.connected, true);
}

async function login(email, password = PASSWORD) {
    const response = await request("POST", "/auth/login", {
        body: { email, password }, expected: [200],
    });
    assert.ok(response.data?.token, `Login não retornou token para ${email}.`);
    assert.ok(response.data?.user?.user_id, `Login não retornou user_id para ${email}.`);
    const session = { token: response.data.token, user: response.data.user };
    sessions.push(session);
    return session;
}

async function checkSession(session) {
    const result = await request("GET", "/auth/me", { token: session.token });
    assert.equal(result.data?.user?.user_id, session.user.user_id);
}

async function safeLogout(session) {
    try {
        await request("POST", "/auth/logout", { token: session.token, expected: [204, 401] });
    } catch { /* erro durante limpeza não altera resultado do teste principal */ }
}

async function cleanup() {
    for (const socket of sockets) {
        socket.removeAllListeners();
        socket.disconnect();
    }
    if (approvedUserId && adminToken) {
        try {
            // Conta criada exclusivamente neste teste: desativar após uso.
            await request("PATCH", `/admin/users/${approvedUserId}/status`, {
                token: adminToken, body: { status: "INACTIVE" }, expected: [200],
            });
        } catch {
            console.error("  AVISO: não foi possível desativar a conta temporária aprovada.");
        }
    }
    for (const session of sessions.reverse()) await safeLogout(session);
}

async function main() {
    console.log("\nCorporate Chat — FE-07 | Integração REAL em ambiente DEV local");
    console.log(`Backend: ${SERVER}`);
    console.log("ATENÇÃO: cria dados de teste persistentes no PostgreSQL/MongoDB local.\n");

    let a, b, c, admin, privateId, message1, message2, socketA, socketB, groupId;
    try {
        await runStep("Health e proteção da API", async () => {
            await request("GET", "/health", { expected: [200] });
            await request("GET", "/dashboard", { expected: [401] });
        });

        await runStep("Login, sessão JWT e dois usuários distintos", async () => {
            [admin, a, b, c] = await Promise.all([
                login(EMAILS.admin), login(EMAILS.a), login(EMAILS.b), login(EMAILS.c),
            ]);
            adminToken = admin.token;
            assert.equal(admin.user.is_admin, true, "Conta admin não possui is_admin=true.");
            assert.notEqual(a.user.user_id, b.user.user_id);
            await checkSession(a);
            await checkSession(b);
        });

        await runStep("Controle de acesso e listagem de contatos", async () => {
            await request("GET", "/admin/registration-requests", { token: a.token, expected: [403] });
            const response = await request("GET", "/dashboard", { token: a.token });
            assert.ok(Array.isArray(response.data?.contacts));
            assert.ok(Array.isArray(response.data?.conversations));
            assert.ok(response.data.contacts.some((u) => u.user_id === b.user.user_id));
            assert.ok(!response.data.contacts.some((u) => u.user_id === a.user.user_id));
        });

        await runStep("Cadastro público, aprovação, rejeição e login aprovado", async () => {
            const approvedEmail = `fe07-${idRun}-aprovado@corporatechat.local`;
            const rejectedEmail = `fe07-${idRun}-rejeitado@corporatechat.local`;
            const temporaryPassword = `Fe07Senha${idRun}A`;
            const approved = await request("POST", "/registration-requests", {
                body: { name: `FE07 Aprovado ${idRun}`, email: approvedEmail }, expected: [201],
            });
            const rejected = await request("POST", "/registration-requests", {
                body: { name: `FE07 Rejeitado ${idRun}`, email: rejectedEmail }, expected: [201],
            });
            assert.equal(approved.data?.request?.status, "PENDING");
            assert.equal(rejected.data?.request?.status, "PENDING");
            await request("GET", "/admin/registration-requests?status=PENDING&limit=100&offset=0", {
                token: adminToken, expected: [200],
            });
            const approvedResult = await request(
                "POST", `/admin/registration-requests/${approved.data.request.request_id}/approve`, {
                    token: adminToken, body: { password: temporaryPassword }, expected: [200],
                }
            );
            // Registra ID imediatamente para tentar limpeza mesmo se a validação posterior falhar.
            approvedUserId = approvedResult.data?.user?.user_id ?? null;
            assert.equal(approvedResult.data?.request?.status, "APPROVED");
            assert.equal(approvedResult.data?.user?.status, "ACTIVE");
            assert.equal(approvedResult.data?.user?.is_admin, false);
            assert.ok(approvedUserId);
            const tempSession = await login(approvedEmail, temporaryPassword);
            await checkSession(tempSession);
            const rejectedResult = await request(
                "POST", `/admin/registration-requests/${rejected.data.request.request_id}/reject`, {
                    token: adminToken, body: { reason: "Teste automatizado FE-07" }, expected: [200],
                }
            );
            assert.equal(rejectedResult.data?.request?.status, "REJECTED");
        });

        await runStep("Criar/reutilizar conversa privada e consultar dashboard", async () => {
            const create = () => request("POST", "/conversations/private", {
                token: a.token, body: { otherUserId: b.user.user_id }, expected: [200, 201],
            });
            const first = await create();
            const reused = await create();
            privateId = first.data?.conversation?._id;
            assert.ok(/^[0-9a-f]{24}$/i.test(privateId ?? ""));
            assert.equal(reused.data?.conversation?._id, privateId);
            const result = await request("GET", "/dashboard", { token: a.token });
            assert.ok(result.data.conversations.some((conv) => conv.conversation_id === privateId));
        });

        await runStep("Socket.IO: rejeitar JWT ausente e conectar duas sessões", async () => {
            const unauthorized = newSocket(null);
            const rejection = waitSocketEvent(unauthorized, "connect_error", () => true, 10000);
            unauthorized.connect();
            await rejection;
            assert.equal(unauthorized.connected, false);
            unauthorized.disconnect();
            socketA = newSocket(a.token);
            socketB = newSocket(b.token);
            await Promise.all([connectSocket(socketA), connectSocket(socketB)]);
        });

        await runStep("Enviar/receber message:new e testar idempotência", async () => {
            const content = `FE07 mensagem privada ${idRun}`;
            const clientMessageId = randomUUID();
            const received = waitSocketEvent(socketB, "message:new",
                (payload) => payload?.message?.client_message_id === clientMessageId);
            const sent = await socketAck(socketA, "message:send", {
                conversationId: privateId, clientMessageId, content,
            });
            message1 = assertMessage(sent?.message, privateId, a.user.user_id, content);
            const event = await received;
            assert.equal(event.message._id, message1._id);
            const retry = await socketAck(socketA, "message:send", {
                conversationId: privateId, clientMessageId, content,
            });
            assert.equal(retry.message._id, message1._id);
            assert.equal(retry.reused, true);
        });

        await runStep("Confirmar entrega/leitura e recuperar histórico HTTP", async () => {
            const delivered = await socketAck(socketB, "message:delivered", {
                conversationId: privateId, messageId: message1._id,
            });
            assert.equal(delivered?.checkpoint?.conversation_id, privateId);
            const read = await socketAck(socketB, "message:read", {
                conversationId: privateId, messageId: message1._id,
            });
            assert.equal(read?.checkpoint?.last_read_message_id, message1._id);
            const checkpoints = await request("GET", `/conversations/${privateId}/checkpoints`, { token: a.token });
            assert.ok(Array.isArray(checkpoints.data?.checkpoints));
            assert.ok(checkpoints.data.checkpoints.some((entry) =>
                entry.user_id === b.user.user_id && entry.last_read_message_id === message1._id));
            const history = await request("GET", `/conversations/${privateId}/messages?limit=50`, { token: b.token });
            assert.ok(Array.isArray(history.data?.items));
            assert.ok(history.data.items.some((msg) => msg._id === message1._id));
        });

        await runStep("Perda de conexão: recuperar mensagem via realtime:sync", async () => {
            socketB.disconnect();
            assert.equal(socketB.connected, false);
            const content = `FE07 mensagem offline ${idRun}`;
            const sent = await socketAck(socketA, "message:send", {
                conversationId: privateId, clientMessageId: randomUUID(), content,
            });
            message2 = assertMessage(sent.message, privateId, a.user.user_id, content);
            await connectSocket(socketB);
            const sync = await socketAck(socketB, "realtime:sync", {
                conversationId: privateId, afterMessageId: message1._id, limit: 50,
            });
            assert.equal(sync?.mode, "incremental");
            assert.ok(Array.isArray(sync.items));
            assert.equal(sync.items.filter((msg) => msg._id === message2._id).length, 1);
        });

        await runStep("Grupos: criar, gerenciar membros e enviar mensagem", async () => {
            const created = await request("POST", "/groups", {
                token: a.token,
                body: { name: `Grupo FE07 ${idRun}`, memberIds: [b.user.user_id] },
                expected: [201],
            });
            groupId = created.data?.group?._id;
            assert.ok(/^[0-9a-f]{24}$/i.test(groupId ?? ""));
            await request("GET", `/groups/${groupId}`, { token: b.token });
            const renamed = await request("PATCH", `/groups/${groupId}`, {
                token: a.token, body: { name: `Grupo FE07 Renomeado ${idRun}` },
            });
            assert.ok(renamed.data?.group?.name.includes("Renomeado"));
            await request("PATCH", `/groups/${groupId}`, {
                token: b.token, body: { name: "Não autorizado" }, expected: [403],
            });
            const added = await request("POST", `/groups/${groupId}/members`, {
                token: a.token, body: { memberIds: [c.user.user_id] },
            });
            assert.ok(added.data?.group);
            await request("GET", `/groups/${groupId}`, { token: c.token });
            const content = `FE07 mensagem de grupo ${idRun}`;
            const clientMessageId = randomUUID();
            const received = waitSocketEvent(socketB, "message:new",
                (payload) => payload?.message?.client_message_id === clientMessageId);
            const groupSent = await socketAck(socketA, "message:send", {
                conversationId: groupId, clientMessageId, content,
            });
            assertMessage(groupSent.message, groupId, a.user.user_id, content);
            assert.equal((await received).message._id, groupSent.message._id);
            await request("DELETE", `/groups/${groupId}/members/${c.user.user_id}`, {
                token: a.token, expected: [204],
            });
            await request("GET", `/groups/${groupId}`, { token: c.token, expected: [403, 404] });
        });

        await runStep("Logout revoga JWT e impede consulta posterior", async () => {
            const response = await request("POST", "/auth/logout", { token: a.token, expected: [204] });
            assert.equal(response.status, 204);
            await request("GET", "/auth/me", { token: a.token, expected: [401] });
        });

        console.log(`\nFE-07: ${assertionsPassed} cenários reais APROVADOS.`);
        console.log("Observação: a homologação visual no navegador ainda precisa ser executada.");
    } finally {
        await cleanup();
    }
}

main().catch((error) => {
    console.error(`\nFE-07 FALHOU: ${error.message}`);
    process.exitCode = 1;
});