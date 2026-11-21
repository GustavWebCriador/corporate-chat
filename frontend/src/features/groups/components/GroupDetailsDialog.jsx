
import { useEffect, useId, useRef, useState } from "react";

import { groupService } from "../../../services/api/groupService";

import {
    GROUP_MAX_MEMBERS,
    GROUP_NAME_MAX_LENGTH,
    describeGroupError,
} from "../utils/groups";

import { MemberPicker } from "./MemberPicker";

export function GroupDetailsDialog({
    groupId,
    currentUser,
    contacts = [],
    onClose,
    onChanged,
    onLeft,
}) {
    const [group, setGroup] = useState(null);
    const [status, setStatus] = useState("loading");
    const [reloadKey, setReloadKey] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmRemoveId, setConfirmRemoveId] = useState(null);

    const titleId = useId();
    const nameId = useId();
    const closeButtonRef = useRef(null);
    const busyRef = useRef(false);

    useEffect(() => {
        const previousFocus = document.activeElement;

        closeButtonRef.current?.focus();

        return () => previousFocus?.focus?.();
    }, []);

    useEffect(() => {
        let active = true;

        groupService.get(groupId)
            .then((response) => {
                if (!active) return;

                const receivedGroup = response?.group;

                if (
                    typeof receivedGroup?._id !== "string" ||
                    !Array.isArray(receivedGroup.members)
                ) {
                    throw new Error("INVALID_GROUP_RESPONSE");
                }

                setGroup(receivedGroup);
                setName(receivedGroup.name ?? "");
                setSelectedIds([]);
                setStatus("ready");
            })
            .catch((requestError) => {
                if (!active) return;

                setStatus("error");
                setError(
                    describeGroupError(
                        requestError,
                        "Não foi possível carregar os dados do grupo."
                    )
                );
            });

        return () => {
            active = false;
        };
    }, [groupId, reloadKey]);

    const members = (group?.members ?? []).filter(
        (member) =>
            !member.status || member.status === "ACTIVE"
    );

    const memberIds = new Set(
        members.map((member) => member.user_id)
    );

    const currentMembership = members.find(
        (member) => member.user_id === currentUser?.user_id
    );

    const isCreator = currentMembership?.role === "CREATOR";
    const isMember = Boolean(currentMembership);
    const remainingSlots = Math.max(
        GROUP_MAX_MEMBERS - members.length,
        0
    );

    const availableContacts = contacts.filter(
        (contact) =>
            contact.status === "ACTIVE" &&
            !memberIds.has(contact.user_id)
    );

    const normalizedName = name.trim();

    const canRename =
        !busy &&
        isCreator &&
        normalizedName.length > 0 &&
        normalizedName.length <= GROUP_NAME_MAX_LENGTH &&
        normalizedName !== group?.name;

    const canAdd =
        !busy &&
        isCreator &&
        selectedIds.length > 0 &&
        selectedIds.length <= remainingSlots;

    function memberName(userId) {
        if (userId === currentUser?.user_id) {
            return `${currentUser.name ?? "Você"} (você)`;
        }

        return contacts.find(
            (contact) => contact.user_id === userId
        )?.name ?? "Usuário indisponível";
    }

    async function perform(action, successMessage) {
        if (busyRef.current) return false;

        busyRef.current = true;
        setBusy(true);
        setError("");
        setNotice("");

        try {
            const result = await action();

            setNotice(successMessage);
            onChanged?.(result?.group ?? null);
            setReloadKey((current) => current + 1);

            return true;
        } catch (requestError) {
            setError(describeGroupError(requestError));
            return false;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    async function handleRename(event) {
        event.preventDefault();

        if (!canRename) return;

        await perform(
            () => groupService.rename(groupId, normalizedName),
            "Nome do grupo atualizado."
        );
    }

    async function handleAddMembers(event) {
        event.preventDefault();

        if (!canAdd) return;

        const added = await perform(
            () => groupService.addMembers(groupId, selectedIds),
            "Participantes adicionados."
        );

        if (added) setSelectedIds([]);
    }

    async function handleRemoveMember(userId) {
        if (!isCreator || userId === currentUser?.user_id) {
            return;
        }

        const removed = await perform(
            () => groupService.removeMember(groupId, userId),
            "Participante removido."
        );

        if (removed) setConfirmRemoveId(null);
    }

    async function handleLeave() {
        if (!isMember || isCreator || busyRef.current) {
            return;
        }

        busyRef.current = true;
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await groupService.leave(groupId);
            onLeft?.();
            onClose?.();
        } catch (requestError) {
            setError(describeGroupError(requestError));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    function handleRetry() {
        setStatus("loading");
        setError("");
        setNotice("");
        setReloadKey((value) => value + 1);
    }

    function handleKeyDown(event) {
        if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onClose?.();
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-400/20 bg-navy-900 p-6 text-slate-300 shadow-2xl"
            >
                <header className="mb-5 flex items-center justify-between gap-3">
                    <h2 id={titleId} className="text-xl font-bold">
                        Gerenciar grupo
                    </h2>

                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Fechar detalhes do grupo"
                        className="rounded-lg px-3 py-1 text-lg hover:bg-navy-800 disabled:opacity-50"
                    >
                        ×
                    </button>
                </header>

                {status === "loading" && (
                    <p role="status">Carregando grupo...</p>
                )}

                {error && (
                    <p
                        role="alert"
                        className="mb-4 rounded-lg border border-rose-500/20 p-3 text-sm text-rose-400"
                    >
                        {error}
                    </p>
                )}

                {notice && (
                    <p
                        role="status"
                        className="mb-4 text-sm text-teal-300"
                    >
                        {notice}
                    </p>
                )}

                {status === "error" && (
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950"
                    >
                        Tentar novamente
                    </button>
                )}

                {status === "ready" && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold">
                                {group.name}
                            </h3>

                            <p className="text-sm text-slate-400">
                                {members.length} participante(s)
                            </p>
                        </div>

                        <section aria-label="Participantes atuais">
                            <h3 className="mb-3 font-semibold">
                                Participantes
                            </h3>

                            <ul className="space-y-2">
                                {members.map((member) => (
                                    <li
                                        key={member.user_id}
                                        className="flex items-center justify-between gap-3 rounded-lg bg-navy-800 p-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm">
                                                {memberName(member.user_id)}
                                            </p>

                                            <p className="text-xs text-slate-400">
                                                {member.role === "CREATOR"
                                                    ? "Criador"
                                                    : "Membro"}
                                            </p>
                                        </div>

                                        {isCreator &&
                                            member.user_id !== currentUser?.user_id && (
                                                confirmRemoveId === member.user_id ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleRemoveMember(
                                                                    member.user_id
                                                                )
                                                            }
                                                            disabled={busy}
                                                            aria-label={`Confirmar remoção de ${memberName(member.user_id)}`}
                                                            className="text-xs text-rose-400 disabled:opacity-50"
                                                        >
                                                            Confirmar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setConfirmRemoveId(null)
                                                            }
                                                            disabled={busy}
                                                            className="text-xs text-slate-300"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmRemoveId(
                                                                member.user_id
                                                            )
                                                        }
                                                        disabled={busy}
                                                        aria-label={`Remover ${memberName(member.user_id)}`}
                                                        className="text-xs text-rose-400 disabled:opacity-50"
                                                    >
                                                        Remover
                                                    </button>
                                                )
                                            )}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {isCreator && (
                            <>
                                <form
                                    onSubmit={handleRename}
                                    className="space-y-3 border-t border-slate-400/10 pt-5"
                                >
                                    <label
                                        htmlFor={nameId}
                                        className="block text-sm font-semibold"
                                    >
                                        Novo nome do grupo
                                    </label>

                                    <input
                                        id={nameId}
                                        type="text"
                                        value={name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                        maxLength={GROUP_NAME_MAX_LENGTH}
                                        disabled={busy}
                                        className="w-full rounded-lg border border-slate-400/20 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500"
                                    />

                                    <button
                                        type="submit"
                                        disabled={!canRename}
                                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 disabled:opacity-50"
                                    >
                                        Salvar nome
                                    </button>
                                </form>

                                <form
                                    onSubmit={handleAddMembers}
                                    className="space-y-4 border-t border-slate-400/10 pt-5"
                                >
                                    <h3 className="font-semibold">
                                        Adicionar participantes
                                    </h3>

                                    <MemberPicker
                                        contacts={availableContacts}
                                        selectedIds={selectedIds}
                                        onChange={setSelectedIds}
                                        maxSelectable={remainingSlots}
                                        disabled={busy}
                                    />

                                    <button
                                        type="submit"
                                        disabled={!canAdd}
                                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 disabled:opacity-50"
                                    >
                                        Adicionar ao grupo
                                    </button>
                                </form>
                            </>
                        )}

                        {isMember && !isCreator && (
                            <div className="border-t border-slate-400/10 pt-5">
                                <button
                                    type="button"
                                    onClick={handleLeave}
                                    disabled={busy}
                                    className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-400 disabled:opacity-50"
                                >
                                    Sair do grupo
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
