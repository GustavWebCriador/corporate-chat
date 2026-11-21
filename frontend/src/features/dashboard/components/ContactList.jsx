
import { useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";

/**
 * Lista de contatos do dashboard.
 *
 * Selecionar um contato abre (ou reutiliza) a conversa
 * privada correspondente (CA05.2 / CA06.1).
 */
export function ContactList({
    contacts = [],
    onSelect,
    disabled = false,
}) {
    const [search, setSearch] = useState("");

    const query = search.trim().toLocaleLowerCase("pt-BR");

    // A API do dashboard não possui filtro de contatos.
    // A pesquisa atua somente sobre a lista já recebida.
    const filteredContacts = contacts.filter((contact) =>
        `${contact.name} ${contact.email}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)
    );

    const emptyMessage = contacts.length === 0
        ? "Nenhum contato disponível."
        : "Nenhum contato encontrado.";

    return (
        <section
            aria-labelledby="contacts-title"
            className="flex min-h-0 flex-col bg-navy-900 text-slate-300"
        >
            <header className="border-b border-slate-400/10 p-4">
                <h2
                    id="contacts-title"
                    className="text-sm font-semibold text-slate-300"
                >
                    Contatos
                    <span
                        aria-hidden="true"
                        className="ml-2 text-slate-400"
                    >
                        {contacts.length}
                    </span>
                </h2>

                <label
                    htmlFor="contact-search"
                    className="sr-only"
                >
                    Buscar contatos
                </label>

                <input
                    id="contact-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                        setSearch(event.target.value)
                    }
                    placeholder="Buscar contatos..."
                    className="mt-3 w-full rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-teal-500"
                />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filteredContacts.length === 0 ? (
                    <p
                        role="status"
                        className="px-3 py-6 text-center text-sm text-slate-400"
                    >
                        {emptyMessage}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {filteredContacts.map((contact) => (
                            <li key={contact.user_id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect?.(contact)}
                                    disabled={disabled || !onSelect}
                                    aria-label={`Conversar com ${contact.name}`}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 disabled:cursor-default disabled:hover:bg-transparent"
                                >
                                    <Avatar name={contact.name} />

                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-slate-300">
                                            {contact.name}
                                        </span>

                                        <span className="block truncate text-xs text-slate-400">
                                            {contact.email}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
