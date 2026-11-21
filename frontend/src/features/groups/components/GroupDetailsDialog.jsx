import { useCallback, useEffect, useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";
import { Modal } from "../../../components/ui/Modal";
import { groupService } from "../../../services/api/groupService";

import {
    GROUP_MAX_MEMBERS,
    GROUP_NAME_MAX_LENGTH,
    describeGroupError,
    roleLabel,
} from "../utils/groups";
import { MemberPicker } from "./MemberPicker";

/**
 * Participantes e gerenciamento do grupo (RF09).
 *
 * - criador: renomear (CA09.8), adicionar (CA09.6) e remover (CA09.7);
 * - demais participantes: sair voluntariamente (CA09.9).
 */
export function GroupDetailsDialog({
    groupId,
    currentUser,
    usersById,
    onClose,
    onRenamed,
    onMembersChanged,
    onLeft,
}) {
    const [group, setGroup] = useState(null);
    const [status, setStatus] = useState("loading");
    const [reloadKey, setReloadKey] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const [name, setName] = useState("");
    const [toAdd, setToAdd] = useState([]);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [confirmLeave, setConfirmLeave] = useState(false);

    useEffect(() => {
        let active = true;

        groupService.get(groupId)
            .then((response) => {
                if (!active) return;

                if (!Array.isArray(response?.group?.members)) {
                    throw new Error("INVALID_GROUP_RESPONSE");
                }

                setGroup(response.group);
                setName(response.group.name ?? "");
                setStatus("ready");
            })
            .catch((err) => {
                if (!active) return;

                setStatus("error");
                setError(describeGroupError(err, "Não foi possível carregar o grupo."));
            });

        return () => {
            active = false;
        };
    }, [groupId, reloadKey]);

    const nameOf = useCallback((userId) => {
        if (userId === currentUser?.user_id) {
            return `${currentUser?.name ?? "Você"} (você)`;
        }

        return usersById.get(userId)?.name ?? "Usuário indisponível";
    }, [currentUser, usersById]);

    const members = (group?.members ?? []).filter(
        (member) => !member.status || member.status === "ACTIVE"
    );
    const memberIds = new Set(members.map((member) => member.user_id));
    const isCreator = members.some(
        (member) =>
            member.user_id === currentUser?.user_id &&
            member.role === "CREATOR"
    );
    const candidates = [...usersById.values()].filter(
        (contact) => !memberIds.has(contact.user_id)
    );
    const remainingSlots = Math.max(GROUP_MAX_MEMBERS - members.length, 0);

    async function run(action, successMessage) {
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await action();
            setNotice(successMessage);
            return true;
        } catch (err) {
            setError(describeGroupError(err));
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function handleRename(event) {
        event.preventDefault();
        const trimmed = name.trim();

        if (!trimmed) {
            setError("Informe o nome do grupo.");
            return;
        }

        const ok = await run(async () => {
            await groupService.rename(groupId, trimmed);
            setGroup((current) => ({ ...current, name: trimmed }));
        }, "Nome do grupo atualizado.");

        if (ok) onRenamed?.(trimmed);
    }

    async function handleAdd() {
        const ok = await run(async () => {
            await groupService.addMembers(groupId, toAdd);
            setToAdd([]);
            setReloadKey((current) => current + 1);
        }, "Participantes adicionados.");

        if (ok) onMembersChanged?.();
    }

    async function handleRemove(userId) {
        const ok = await run(async () => {
            await groupService.removeMember(groupId, userId);
            setConfirmRemove(null);
            setGroup((current) => ({
                ...current,
                members: current.members.filter((member) => member.user_id !== userId),
            }));
        }, "Participante removido.");

        if (ok) onMembersChanged?.();
    }

    async function handleLeave() {
        const ok = await run(() => groupService.leave(groupId), "");

        if (ok) onLeft?.();
    }

    return (
        <Modal title="Participantes do grupo" onClose={onClose}>
            {status === "loading" && (
                <p role="status" className="text-sm text-slate-400">
                    Carregando participantes...
                </p>
            )}

            {status === "error" && (
                <p role="alert" className="text-sm text-rose-500">{error}</p>
            )}

            {status === "ready" && (
                <div className="space-y-5">
                    {isCreator && (
                        <form onSubmit={handleRename} className="space-y-1">
                            <label htmlFor="rename-group" className="block text-sm font-medium">
                                Nome do grupo
                            </label>

                            <div className="flex gap-2">
                                <input
                                    id="rename-group"
                                    type="text"
                                    value={name}
                                    maxLength={GROUP_NAME_MAX_LENGTH}
                                    onChange={(event) => setName(event.target.value)}
                                    disabled={busy}
                                    className="min-w-0 flex-1 rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500"
                                />

                                <button
                                    type="submit"
                                    disabled={busy || !name.trim() || name.trim() === group.name}
                                    className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-navy-950 disabled:opacity-40"
                                >
                                    Salvar
                                </button>
                            </div>

                            <p className="text-right text-xs text-slate-400">
                                {name.length}/{GROUP_NAME_MAX_LENGTH}
                            </p>
                        </form>
                    )}

                    <section aria-labelledby="members-title">
                        <h3 id="members-title" className="mb-2 text-sm font-medium">
                            {members.length} de {GROUP_MAX_MEMBERS} participantes
                        </h3>

                        <ul className="space-y-1">
                            {members.map((member) => {
                                const label = nameOf(member.user_id);
                                const canRemove =
                                    isCreator && member.role !== "CREATOR";

                                return (
                                    <li
                                        key={member.user_id}
                                        className="flex items-center gap-3 rounded-lg px-2 py-2"
                                    >
                                        <Avatar name={label} size="sm" />

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{label}</span>
                                            <span className="block text-xs text-slate-400">
                                                {roleLabel(member.role)}
                                            </span>
                                        </span>

                                        {canRemove && confirmRemove !== member.user_id && (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmRemove(member.user_id)}
                                                disabled={busy}
                                                aria-label={`Remover ${label}`}
                                                className="rounded-lg px-2 py-1 text-xs text-rose-500 hover:bg-navy-800"
                                            >
                                                Remover
                                            </button>
                                        )}

                                        {canRemove && confirmRemove === member.user_id && (
                                            <span className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(member.user_id)}
                                                    disabled={busy}
                                                    className="rounded-lg bg-rose-500 px-2 py-1 text-xs font-semibold text-white"
                                                >
                                                    Confirmar remoção
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmRemove(null)}
                                                    className="rounded-lg px-2 py-1 text-xs hover:bg-navy-800"
                                                >
                                                    Cancelar
                                                </button>
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {isCreator && (
                        <section aria-labelledby="add-title" className="space-y-2">
                            <h3 id="add-title" className="text-sm font-medium">
                                Adicionar participantes
                            </h3>

                            {remainingSlots === 0 ? (
                                <p className="text-sm text-slate-400">
                                    O grupo atingiu o limite de {GROUP_MAX_MEMBERS} participantes.
                                </p>
                            ) : candidates.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                    Todos os contatos já participam do grupo.
                                </p>
                            ) : (
                                <>
                                    <MemberPicker
                                        contacts={candidates}
                                        selectedIds={toAdd}
                                        onChange={setToAdd}
                                        maxSelectable={remainingSlots}
                                        disabled={busy}
                                    />

                                    <button
                                        type="button"
                                        onClick={handleAdd}
                                        disabled={busy || toAdd.length === 0}
                                        className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-navy-950 disabled:opacity-40"
                                    >
                                        Adicionar selecionados
                                    </button>
                                </>
                            )}
                        </section>
                    )}

                    {!isCreator && (
                        <section className="border-t border-slate-400/10 pt-4">
                            {confirmLeave ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm">Sair deste grupo?</span>
                                    <button
                                        type="button"
                                        onClick={handleLeave}
                                        disabled={busy}
                                        className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
                                    >
                                        Confirmar saída
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmLeave(false)}
                                        className="rounded-lg px-3 py-2 text-sm hover:bg-navy-800"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmLeave(true)}
                                    disabled={busy}
                                    className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10"
                                >
                                    Sair do grupo
                                </button>
                            )}
                        </section>
                    )}

                    {isCreator && (
                        <p className="text-xs text-slate-400">
                            Como criador, você é o responsável pelo grupo e não pode sair dele nesta versão.
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="text-sm text-rose-500">{error}</p>
                    )}

                    {notice && (
                        <p role="status" className="text-sm text-teal-300">{notice}</p>
                    )}
                </div>
            )}
        </Modal>
    );
}
