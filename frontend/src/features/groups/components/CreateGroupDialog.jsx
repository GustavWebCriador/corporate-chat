import { useState } from "react";

import { Modal } from "../../../components/ui/Modal";
import { groupService } from "../../../services/api/groupService";

import {
    GROUP_MAX_MEMBERS,
    GROUP_NAME_MAX_LENGTH,
    describeGroupError,
} from "../utils/groups";
import { MemberPicker } from "./MemberPicker";

/**
 * Criação de grupo (RF09 — CA09.1 a CA09.4).
 *
 * O criador entra automaticamente; por isso podem ser selecionados
 * de 1 a 49 participantes (total de 2 a 50).
 */
export function CreateGroupDialog({ contacts, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const maxSelectable = GROUP_MAX_MEMBERS - 1;
    const trimmedName = name.trim();
    const canSubmit =
        !saving &&
        trimmedName.length > 0 &&
        trimmedName.length <= GROUP_NAME_MAX_LENGTH &&
        selectedIds.length >= 1 &&
        selectedIds.length <= maxSelectable;

    async function handleSubmit(event) {
        event.preventDefault();

        if (!trimmedName) {
            setError("Informe o nome do grupo.");
            return;
        }

        if (selectedIds.length === 0) {
            setError("Selecione ao menos um participante.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const response = await groupService.create(trimmedName, selectedIds);
            const group = response?.group;

            if (!group?._id) {
                throw new Error("INVALID_GROUP_RESPONSE");
            }

            onCreated?.(group);
        } catch (err) {
            setError(describeGroupError(err, "Não foi possível criar o grupo."));
            setSaving(false);
        }
    }

    return (
        <Modal title="Novo grupo" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                    <label htmlFor="group-name" className="mb-1 block text-sm font-medium">
                        Nome do grupo
                    </label>

                    <input
                        id="group-name"
                        type="text"
                        value={name}
                        maxLength={GROUP_NAME_MAX_LENGTH}
                        onChange={(event) => setName(event.target.value)}
                        disabled={saving}
                        aria-describedby="group-name-counter"
                        className="w-full rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />

                    <p id="group-name-counter" className="mt-1 text-right text-xs text-slate-400">
                        {name.length}/{GROUP_NAME_MAX_LENGTH}
                    </p>
                </div>

                <MemberPicker
                    contacts={contacts}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                    maxSelectable={maxSelectable}
                    disabled={saving}
                />

                <p className="text-xs text-slate-400" aria-live="polite">
                    {selectedIds.length + 1} de {GROUP_MAX_MEMBERS} participantes (incluindo você)
                </p>

                {error && (
                    <p role="alert" className="text-sm text-rose-500">
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm hover:bg-navy-800"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 disabled:opacity-40"
                    >
                        {saving ? "Criando..." : "Criar grupo"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
