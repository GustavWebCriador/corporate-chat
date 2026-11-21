import { useEffect, useState } from "react";

import { adminService } from "../../../services/api/adminService";

import {
    EMAIL_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PASSWORD_HINT,
    PASSWORD_MAX_LENGTH,
    describeAdminError,
    formatDateTime,
    validatePassword,
} from "../utils/admin";

const inputClass =
    "w-full rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500";

/**
 * Administração mínima de usuários (RF03 — CA03.1 a CA03.5).
 */
export function UsersPanel({ currentUserId, reloadSignal = 0 }) {
    const [users, setUsers] = useState([]);
    const [status, setStatus] = useState("loading");
    const [reloadKey, setReloadKey] = useState(0);
    const [search, setSearch] = useState("");

    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "" });

    const [action, setAction] = useState(null); // { id, type: "status" | "password" }
    const [newPassword, setNewPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;

        adminService.listUsers()
            .then((response) => {
                if (!active) return;

                if (!Array.isArray(response?.users)) {
                    throw new Error("INVALID_USERS_RESPONSE");
                }

                setUsers(response.users);
                setStatus("ready");
            })
            .catch(() => {
                if (active) setStatus("error");
            });

        return () => {
            active = false;
        };
    }, [reloadKey, reloadSignal]);

    async function run(task, successMessage) {
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await task();
            setNotice(successMessage);
            setAction(null);
            setNewPassword("");
            setReloadKey((current) => current + 1);
            return true;
        } catch (err) {
            setError(describeAdminError(err));
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function handleCreate(event) {
        event.preventDefault();

        const name = form.name.trim();
        const email = form.email.trim().toLowerCase();

        if (!name || !email) {
            setError("Informe nome e e-mail.");
            return;
        }

        const passwordError = validatePassword(form.password);

        if (passwordError) {
            setError(passwordError);
            return;
        }

        const ok = await run(
            () => adminService.createUser({ name, email, password: form.password }),
            `Usuário ${name} cadastrado.`
        );

        if (ok) {
            setForm({ name: "", email: "", password: "" });
            setCreating(false);
        }
    }

    async function handleResetPassword(event, user) {
        event.preventDefault();

        const passwordError = validatePassword(newPassword);

        if (passwordError) {
            setError(passwordError);
            return;
        }

        await run(
            () => adminService.resetPassword(user.user_id, newPassword),
            `Senha de ${user.name} redefinida. Informe a nova senha ao usuário.`
        );
    }

    function handleToggleStatus(user) {
        const next = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

        return run(
            () => adminService.setUserStatus(user.user_id, next),
            next === "ACTIVE"
                ? `${user.name} foi reativado.`
                : `${user.name} foi desativado e não poderá mais entrar.`
        );
    }

    const query = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = users.filter((user) =>
        `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(query)
    );

    return (
        <section aria-labelledby="users-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="users-title" className="text-lg font-semibold">
                    Usuários
                </h2>

                <button
                    type="button"
                    onClick={() => {
                        setCreating((current) => !current);
                        setError("");
                        setNotice("");
                    }}
                    className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-navy-950"
                >
                    {creating ? "Cancelar cadastro" : "+ Novo usuário"}
                </button>
            </div>

            {creating && (
                <form
                    onSubmit={handleCreate}
                    noValidate
                    aria-label="Cadastrar usuário"
                    className="grid gap-3 rounded-lg border border-slate-400/10 bg-navy-900 p-4 sm:grid-cols-2"
                >
                    <div>
                        <label htmlFor="new-user-name" className="mb-1 block text-sm font-medium">Nome</label>
                        <input
                            id="new-user-name"
                            value={form.name}
                            maxLength={NAME_MAX_LENGTH}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            disabled={busy}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="new-user-email" className="mb-1 block text-sm font-medium">E-mail</label>
                        <input
                            id="new-user-email"
                            type="email"
                            value={form.email}
                            maxLength={EMAIL_MAX_LENGTH}
                            onChange={(event) => setForm({ ...form, email: event.target.value })}
                            disabled={busy}
                            className={inputClass}
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label htmlFor="new-user-password" className="mb-1 block text-sm font-medium">Senha inicial</label>
                        <input
                            id="new-user-password"
                            type="password"
                            autoComplete="new-password"
                            value={form.password}
                            maxLength={PASSWORD_MAX_LENGTH}
                            onChange={(event) => setForm({ ...form, password: event.target.value })}
                            disabled={busy}
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-slate-400">{PASSWORD_HINT}</p>
                    </div>

                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={busy}
                            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 disabled:opacity-50"
                        >
                            Cadastrar usuário
                        </button>
                    </div>
                </form>
            )}

            {error && (
                <p role="alert" className="text-sm text-rose-500">{error}</p>
            )}

            {notice && (
                <p role="status" className="rounded-lg bg-teal-500/10 px-3 py-2 text-sm text-teal-300">{notice}</p>
            )}

            <div>
                <label htmlFor="user-search" className="sr-only">Buscar usuários</label>
                <input
                    id="user-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className={inputClass}
                />
            </div>

            {status === "loading" && (
                <p className="text-sm text-slate-400">Carregando usuários...</p>
            )}

            {status === "error" && (
                <p role="alert" className="text-sm text-rose-500">Não foi possível carregar os usuários.</p>
            )}

            {status === "ready" && (
                <ul className="space-y-2">
                    {filtered.map((user) => {
                        const isSelf = user.user_id === currentUserId;
                        const active = user.status === "ACTIVE";
                        const open = action?.id === user.user_id ? action.type : null;

                        return (
                            <li key={user.user_id} className="rounded-lg border border-slate-400/10 bg-navy-900 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold">
                                            {user.name}
                                            {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(você)</span>}
                                        </p>
                                        <p className="truncate text-sm text-slate-400">{user.email}</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Último acesso: {formatDateTime(user.last_login_at)}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                        {user.is_admin && (
                                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-300">
                                                Administrador
                                            </span>
                                        )}
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            active ? "bg-teal-500/15 text-teal-300" : "bg-rose-500/15 text-rose-500"
                                        }`}>
                                            {active ? "Ativo" : "Inativo"}
                                        </span>
                                    </div>
                                </div>

                                {!open && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAction({ id: user.user_id, type: "status" })}
                                            disabled={busy || isSelf}
                                            title={isSelf ? "Você não pode desativar a própria conta." : undefined}
                                            aria-label={`${active ? "Desativar" : "Ativar"} ${user.name}`}
                                            className="rounded-lg border border-slate-400/20 px-3 py-1.5 text-sm hover:bg-navy-800 disabled:opacity-40"
                                        >
                                            {active ? "Desativar" : "Ativar"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAction({ id: user.user_id, type: "password" });
                                                setNewPassword("");
                                                setError("");
                                            }}
                                            disabled={busy}
                                            aria-label={`Redefinir senha de ${user.name}`}
                                            className="rounded-lg border border-slate-400/20 px-3 py-1.5 text-sm hover:bg-navy-800"
                                        >
                                            Redefinir senha
                                        </button>
                                    </div>
                                )}

                                {open === "status" && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="text-sm">
                                            {active
                                                ? `Desativar ${user.name}? A pessoa não poderá mais entrar.`
                                                : `Reativar ${user.name}?`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleStatus(user)}
                                            disabled={busy}
                                            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                                active ? "bg-rose-500 text-white" : "bg-teal-500 text-navy-950"
                                            }`}
                                        >
                                            {active ? "Confirmar desativação" : "Confirmar ativação"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAction(null)}
                                            className="rounded-lg px-3 py-1.5 text-sm hover:bg-navy-800"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}

                                {open === "password" && (
                                    <form
                                        onSubmit={(event) => handleResetPassword(event, user)}
                                        noValidate
                                        className="mt-3 space-y-2"
                                    >
                                        <label htmlFor={`reset-${user.user_id}`} className="block text-sm font-medium">
                                            Nova senha
                                        </label>
                                        <input
                                            id={`reset-${user.user_id}`}
                                            type="password"
                                            autoComplete="new-password"
                                            value={newPassword}
                                            maxLength={PASSWORD_MAX_LENGTH}
                                            onChange={(event) => setNewPassword(event.target.value)}
                                            disabled={busy}
                                            className={inputClass}
                                        />
                                        <p className="text-xs text-slate-400">{PASSWORD_HINT}</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={busy}
                                                className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-navy-950 disabled:opacity-50"
                                            >
                                                Salvar nova senha
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAction(null)}
                                                className="rounded-lg px-3 py-1.5 text-sm hover:bg-navy-800"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
