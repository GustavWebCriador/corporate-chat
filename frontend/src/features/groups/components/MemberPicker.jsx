import { useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";

/**
 * Seleção de participantes por busca e caixas de marcação (CA09.1).
 */
export function MemberPicker({
    contacts = [],
    selectedIds,
    onChange,
    maxSelectable,
    disabled = false,
}) {
    const [search, setSearch] = useState("");
    const query = search.trim().toLocaleLowerCase("pt-BR");

    const filtered = contacts.filter((contact) =>
        `${contact.name} ${contact.email}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)
    );

    const limitReached = selectedIds.length >= maxSelectable;

    function toggle(userId) {
        if (selectedIds.includes(userId)) {
            onChange(selectedIds.filter((id) => id !== userId));
        } else if (!limitReached) {
            onChange([...selectedIds, userId]);
        }
    }

    return (
        <fieldset disabled={disabled} className="min-w-0">
            <legend className="mb-2 text-sm font-medium">
                Participantes
            </legend>

            <label htmlFor="member-search" className="sr-only">
                Buscar participantes
            </label>

            <input
                id="member-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />

            {filtered.length === 0 ? (
                <p role="status" className="py-4 text-center text-sm text-slate-400">
                    Nenhum contato encontrado.
                </p>
            ) : (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {filtered.map((contact) => {
                        const checked = selectedIds.includes(contact.user_id);
                        const inputId = `member-${contact.user_id}`;

                        return (
                            <li key={contact.user_id}>
                                <label
                                    htmlFor={inputId}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-navy-800"
                                >
                                    <input
                                        id={inputId}
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!checked && limitReached}
                                        onChange={() => toggle(contact.user_id)}
                                        className="h-4 w-4 accent-teal-500"
                                    />

                                    <Avatar name={contact.name} size="sm" />

                                    <span className="min-w-0">
                                        <span className="block truncate text-sm">
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
        </fieldset>
    );
}
