
import { useId, useState } from "react";

import { GROUP_MAX_SELECTED_MEMBERS } from "../utils/groups";

export function MemberPicker({
    contacts = [],
    selectedIds = [],
    onChange,
    maxSelectable = GROUP_MAX_SELECTED_MEMBERS,
    disabled = false,
}) {
    const [search, setSearch] = useState("");
    const searchId = useId();

    const query = search.trim().toLocaleLowerCase("pt-BR");

    const activeContacts = contacts.filter(
        (contact) =>
            contact.status === "ACTIVE" &&
            typeof contact.user_id === "string"
    );

    const filteredContacts = activeContacts.filter((contact) =>
        `${contact.name ?? ""} ${contact.email ?? ""}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)
    );

    function handleToggle(userId) {
        if (disabled || typeof onChange !== "function") return;

        if (selectedIds.includes(userId)) {
            onChange(selectedIds.filter((id) => id !== userId));
            return;
        }

        if (selectedIds.length < maxSelectable) {
            onChange([...selectedIds, userId]);
        }
    }

    const limitReached = selectedIds.length >= maxSelectable;

    return (
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
            <legend className="text-sm font-semibold text-slate-300">
                Participantes
            </legend>

            <label htmlFor={searchId} className="sr-only">
                Buscar participantes
            </label>

            <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full rounded-lg border border-slate-400/20 bg-navy-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-teal-500"
            />

            {filteredContacts.length === 0 ? (
                <p role="status" className="py-4 text-sm text-slate-400">
                    {activeContacts.length === 0
                        ? "Nenhum contato disponível."
                        : "Nenhum contato encontrado."}
                </p>
            ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {filteredContacts.map((contact) => {
                        const checked = selectedIds.includes(contact.user_id);

                        return (
                            <li key={contact.user_id}>
                                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-navy-800">
                                    <input
                                        type="checkbox"
                                        aria-label={`Selecionar ${contact.name}`}
                                        checked={checked}
                                        disabled={!checked && limitReached}
                                        onChange={() =>
                                            handleToggle(contact.user_id)
                                        }
                                        className="h-4 w-4 accent-teal-500"
                                    />

                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-slate-300">
                                            {contact.name}
                                        </span>
                                        <span className="block truncate text-xs text-slate-400">
                                            {contact.email}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}

            <p aria-live="polite" className="text-xs text-slate-400">
                {selectedIds.length} de {maxSelectable} participantes selecionados
            </p>
        </fieldset>
    );
}
