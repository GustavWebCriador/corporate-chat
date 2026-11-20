
import { useState } from "react";

function getInitials(name) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

export function ContactList({ contacts = [] }) {
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
                            <li
                                key={contact.user_id}
                                className="flex items-center gap-3 rounded-lg px-3 py-2"
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-xs font-semibold text-teal-300"
                                >
                                    {getInitials(contact.name)}
                                </span>

                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-300">
                                        {contact.name}
                                    </p>

                                    <p className="truncate text-xs text-slate-400">
                                        {contact.email}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
