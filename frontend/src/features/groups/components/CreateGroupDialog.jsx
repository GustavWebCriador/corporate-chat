
import { useEffect, useId, useRef, useState } from "react";

import { groupService } from "../../../services/api/groupService";
import {
    GROUP_NAME_MAX_LENGTH,
    GROUP_MAX_SELECTED_MEMBERS,
    describeGroupError,
} from "../utils/groups";
import { MemberPicker } from "./MemberPicker";

export function CreateGroupDialog({ contacts = [], onClose, onCreated }) {
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const titleId = useId();
    const nameId = useId();
    const nameInputRef = useRef(null);
    const submittingRef = useRef(false);

    useEffect(() => {
        const previousFocus = document.activeElement;
        nameInputRef.current?.focus();
        return () => previousFocus?.focus?.();
    }, []);

    const normalizedName = name.trim();

    const canSubmit =
        !isSaving &&
        normalizedName.length > 0 &&
        normalizedName.length <= GROUP_NAME_MAX_LENGTH &&
        selectedIds.length >= 1 &&
        selectedIds.length <= GROUP_MAX_SELECTED_MEMBERS;

    function handleNameChange(event) {
        setName(event.target.value);
        setError("");
    }

    function handleMembersChange(memberIds) {
        setSelectedIds(memberIds);
        setError("");
    }

    function handleKeyDown(event) {
        if (event.key === "Escape" && !isSaving) {
            event.preventDefault();
            onClose?.();
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit || submittingRef.current) return;

        submittingRef.current = true;
        setIsSaving(true);
        setError("");

        try {
            const response = await groupService.create(normalizedName, selectedIds);
            const group = response?.group;

            if (
                !group ||
                typeof group._id !== "string" ||
                group.type !== "GROUP"
            ) {
                throw new Error("INVALID_GROUP_RESPONSE");
            }

            onCreated?.(group);
        } catch (requestError) {
            setError(
                describeGroupError(
                    requestError,
                    "Não foi possível criar o grupo. Tente novamente."
                )
            );
        } finally {
            submittingRef.current = false;
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-400/20 bg-navy-900 p-6 text-slate-300 shadow-2xl"
            >
                <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 id={titleId} className="text-xl font-bold">
                        Criar grupo
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Fechar criação de grupo"
                        className="rounded-lg px-3 py-1 text-lg text-slate-400 hover:bg-navy-800 disabled:opacity-50"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <div className="space-y-2">
                        <label htmlFor={nameId} className="block text-sm font-semibold">
                            Nome do grupo
                        </label>
                        <input
                            ref={nameInputRef}
                            id={nameId}
                            type="text"
                            value={name}
                            onChange={handleNameChange}
                            maxLength={GROUP_NAME_MAX_LENGTH}
                            disabled={isSaving}
                            placeholder="Ex.: Equipe de desenvolvimento"
                            className="w-full rounded-lg border border-slate-400/20 bg-navy-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-teal-500"
                        />
                        <p className="text-right text-xs text-slate-400">
                            {name.length}/{GROUP_NAME_MAX_LENGTH}
                        </p>
                    </div>

                    <MemberPicker
                        contacts={contacts}
                        selectedIds={selectedIds}
                        onChange={handleMembersChange}
                        maxSelectable={GROUP_MAX_SELECTED_MEMBERS}
                        disabled={isSaving}
                    />

                    <p className="text-xs text-slate-400">
                        Você será incluído automaticamente como criador.
                    </p>

                    {error && (
                        <p role="alert" className="text-sm text-rose-500">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-3 border-t border-slate-400/10 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm hover:bg-navy-800 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-navy-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Criando..." : "Criar grupo"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
