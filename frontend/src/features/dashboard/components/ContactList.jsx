import { useState } from "react";
import { MvpAvatar } from "../../../components/ui/MvpAvatar";

export function ContactList({
    contacts = [],
    onSelectContact,
    isOpening = false,
}) {
    const [search, setSearch] = useState("");

    const query = search.trim().toLocaleLowerCase("pt-BR");

    // A pesquisa utiliza os contatos já recebidos da API.
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
            className="mvp-contacts-panel"
        >
            <header className="mvp-contacts-header">
                <h2
                    id="contacts-title"
                    className="mvp-side-section-title"
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
                    className="mvp-contact-search"
                />
            </header>

            <div className="mvp-contact-scroll">
                {filteredContacts.length === 0 ? (
                    <p
                        role="status"
                        className="px-3 py-6 text-center text-sm text-slate-400"
                    >
                        {emptyMessage}
                    </p>
                ) : (
                    <ul className="m-0 list-none space-y-1 p-0">
                        {filteredContacts.map((contact) => (
                            <li key={contact.user_id}>
                                <button
                                    type="button"
                                    aria-label={`Abrir conversa com ${contact.name}`}
                                    onClick={() =>
                                        onSelectContact?.(contact)
                                    }
                                    disabled={!onSelectContact || isOpening}
                                    className="mvp-contact-row"
                                >
                                    <MvpAvatar name={contact.name} size={26} />

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-300">
                                            {contact.name}
                                        </p>

                                        <p className="truncate text-xs text-slate-400">
                                            {contact.email}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}