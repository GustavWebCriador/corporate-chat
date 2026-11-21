import { useEffect } from "react";
import { afterAll, describe, expect, test } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { io } from "socket.io-client";

import { AuthProvider } from "../../src/features/auth/context/AuthProvider";
import { useAuth } from "../../src/features/auth/hooks/useAuth";
import { RealtimeProvider } from "../../src/features/realtime/context/RealtimeProvider";
import { ConnectionStatus } from "../../src/features/realtime/components/ConnectionStatus";
import { ChatPanel } from "../../src/features/chat/components/ChatPanel";
import { createChatSocket } from "../../src/services/realtime/socketClient";

import { BACKEND_URL, ORIGIN, PASSWORD, RUN_ID, SEED, api, apiLogin } from "./helpers";

let frontendSocket = null;
let eduSocket = null;

function trackingCreateSocket(token) {
    frontendSocket = createChatSocket(token);
    return frontendSocket;
}

function ChatAsAlexandre({ conversation, contact }) {
    const auth = useAuth();

    useEffect(() => {
        if (!auth.isAuthenticated) {
            auth.login(SEED.alexandre, PASSWORD);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!auth.isAuthenticated) {
        return <p>Entrando...</p>;
    }

    return (
        <>
            <ConnectionStatus />
            <ChatPanel
                conversation={conversation}
                currentUser={auth.user}
                usersById={new Map([[contact.user_id, contact]])}
            />
        </>
    );
}

const itemOf = (text) => screen.getByText(text).closest("li");

afterAll(() => {
    eduSocket?.close();
    frontendSocket?.disconnect();
});

describe("Comunicação em tempo real (FE-06 — RF12)", () => {
    test("recebe, lê, envia e sincroniza após reconexão", async () => {
        const edu = await apiLogin(SEED.eduardo);
        const alex = await apiLogin(SEED.alexandre);
        const { conversation } = await api("/conversations/private", {
            token: edu.token,
            body: { otherUserId: alex.user.user_id },
        });
        await api("/auth/logout", { token: alex.token, method: "POST" });

        // Segundo usuário conectado diretamente ao Socket.IO.
        eduSocket = io(BACKEND_URL, {
            auth: { token: edu.token },
            extraHeaders: { Origin: ORIGIN },
            transports: ["websocket"],
        });
        const events = [];
        ["message:new", "message:read:update"].forEach((event) =>
            eduSocket.on(event, (payload) => events.push({ event, payload }))
        );
        await new Promise((resolve) => eduSocket.on("realtime:ready", resolve));

        render(
            <AuthProvider>
                <RealtimeProvider createSocket={trackingCreateSocket}>
                    <ChatAsAlexandre
                        conversation={{
                            conversation_id: conversation._id,
                            type: "PRIVATE",
                            name: null,
                            contact: edu.user,
                        }}
                        contact={edu.user}
                    />
                </RealtimeProvider>
            </AuthProvider>
        );

        await screen.findByLabelText("Mensagem", {}, { timeout: 15000 });
        await waitFor(() => expect(frontendSocket?.connected).toBe(true), { timeout: 15000 });

        // 1. Mensagem do outro usuário aparece sem recarregar (CA06.3/CA12.1).
        const incoming = `RT recebida ${RUN_ID}`;
        const ack = await eduSocket.timeout(10000).emitWithAck("message:send", {
            conversationId: conversation._id,
            clientMessageId: `rt-in-${RUN_ID}`,
            content: incoming,
        });
        expect(ack.ok).toBe(true);
        await screen.findByText(incoming, {}, { timeout: 10000 });

        // 2. A leitura feita pela tela chega ao remetente.
        await waitFor(() => {
            expect(events.some(({ event, payload }) =>
                event === "message:read:update" &&
                payload.checkpoint.last_read_message_id === ack.data.message._id
            )).toBe(true);
        }, { timeout: 10000 });

        // 3. Envio pela tela chega ao outro usuário.
        const outgoing = `RT enviada ${RUN_ID}`;
        fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: outgoing } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

        await waitFor(() => {
            expect(events.some(({ event, payload }) =>
                event === "message:new" && payload.message.content === outgoing
            )).toBe(true);
        }, { timeout: 10000 });

        // 4. Leitura do outro usuário aparece como "Lida" (RF07).
        const sent = events.find(({ event, payload }) =>
            event === "message:new" && payload.message.content === outgoing
        ).payload.message;

        const read = await eduSocket.timeout(10000).emitWithAck("message:read", {
            conversationId: conversation._id,
            messageId: sent._id,
        });
        expect(read.ok).toBe(true);

        await waitFor(() => {
            expect(itemOf(outgoing).querySelector("[data-status]").dataset.status).toBe("read");
        }, { timeout: 10000 });

        // 5. Queda: "Reconectando..." e sincronização ao voltar (CA12.3/CA12.4).
        act(() => {
            frontendSocket.io.engine.close();
        });
        await screen.findByText("Reconectando...", {}, { timeout: 10000 });

        const missed = `RT durante a queda ${RUN_ID}`;
        await api(`/conversations/${conversation._id}/messages`, {
            token: edu.token,
            body: { clientMessageId: `rt-missed-${RUN_ID}`, content: missed },
        });

        await waitFor(() => {
            expect(screen.queryByText("Reconectando...")).not.toBeInTheDocument();
        }, { timeout: 30000 });

        expect(await screen.findByText(missed, {}, { timeout: 10000 })).toBeInTheDocument();
    });
});
