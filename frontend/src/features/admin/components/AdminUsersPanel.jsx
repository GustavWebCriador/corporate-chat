import { useEffect, useState } from "react";
import { adminUserService } from "../../../services/api/adminUserService";

const emptyUser = { name: "", email: "", password: "" };
const passwordIsValid = (password) => password.length >= 8 && password.length <= 128 &&
    /[A-Z]/.test(password) && /\d/.test(password);

export function AdminUsersPanel({ currentUserId }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [revision, setRevision] = useState(0);
    const [search, setSearch] = useState("");
    const [dialog, setDialog] = useState(null);
    const [fields, setFields] = useState(emptyUser);
    const [actionError, setActionError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        adminUserService.list()
            .then((response) => {
                if (!active) return;
                if (!Array.isArray(response?.users)) {
                    throw new Error("Resposta inválida da listagem de usuários.");
                }
                setUsers(response.users);
                setError("");
            })
            .catch((err) => {
                if (active) setError(err.message || "Não foi possível carregar os usuários.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [revision]);

    function refresh() {
        setLoading(true);
        setError("");
        setRevision((current) => current + 1);
    }

    function openDialog(kind, user = null) {
        setDialog({ kind, user });
        setFields({ ...emptyUser });
        setActionError("");
    }

    function closeDialog() {
        if (submitting) return;
        setDialog(null);
        setFields({ ...emptyUser });
        setActionError("");
    }

    function updateField(field, value) {
        setFields((current) => ({ ...current, [field]: value }));
    }

    async function submitAction(event) {
        event.preventDefault();
        if (!dialog || submitting) return;
        const { kind, user } = dialog;
        if (kind === "create" && (!fields.name.trim() || fields.name.trim().length > 150 ||
            !fields.email.trim() || fields.email.trim().length > 150)) {
            setActionError("Informe nome e e-mail válidos (máximo 150 caracteres).");
            return;
        }
        if ((kind === "create" || kind === "password") && !passwordIsValid(fields.password)) {
            setActionError("A senha deve ter 8 a 128 caracteres, uma letra maiúscula e um número.");
            return;
        }
        if (kind === "status" && user?.user_id === currentUserId) {
            setActionError("Não é permitido alterar o status da própria conta nesta interface.");
            return;
        }

        setActionError("");
        setSubmitting(true);
        try {
            if (kind === "create") {
                await adminUserService.create({
                    name: fields.name.trim(),
                    email: fields.email.trim().toLowerCase(),
                    password: fields.password,
                });
                setNotice("Usuário criado com sucesso.");
            } else if (kind === "status") {
                const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                await adminUserService.changeStatus(user.user_id, nextStatus);
                setNotice("Situação do usuário atualizada com sucesso.");
            } else if (kind === "password") {
                await adminUserService.resetPassword(user.user_id, fields.password);
                setNotice("Senha redefinida com sucesso.");
            }
            setDialog(null);
            setFields({ ...emptyUser });
            refresh();
        } catch (err) {
            setActionError(err.message || "Não foi possível concluir a operação.");
        } finally {
            setSubmitting(false);
        }
    }

    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = users.filter((user) =>
        `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-100">Gerenciamento de usuários</h2>
                    <p className="mt-1 text-sm text-slate-400">Cadastre, consulte e administre contas existentes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={refresh} disabled={loading}
                        className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm disabled:opacity-40">Atualizar usuários</button>
                    <button type="button" onClick={() => openDialog("create")}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950">Novo usuário</button>
                </div>
            </div>

            <label htmlFor="search-users" className="flex max-w-lg flex-col gap-2 text-sm">
                Buscar por nome ou e-mail
                <input id="search-users" type="search" value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Digite um nome ou e-mail"
                    className="rounded-lg border border-slate-400/20 bg-navy-900 px-3 py-2 text-slate-100" />
            </label>
            {notice && <p role="status" className="rounded-lg bg-teal-500/10 p-3 text-sm text-teal-300">{notice}</p>}
            {loading && <p role="status">Carregando usuários...</p>}
            {error && <div role="alert" className="rounded-lg border border-rose-500/30 p-4 text-rose-400">
                {error} <button type="button" onClick={refresh} className="ml-2 underline">Tentar novamente</button>
            </div>}

            {!loading && !error && (
                <>
                    <p className="text-sm text-slate-400">{filtered.length} usuário(s) exibido(s).</p>
                    {filtered.length === 0 ? (
                        <p className="rounded-lg border border-slate-400/10 bg-navy-900 p-5 text-sm text-slate-400">Nenhum usuário encontrado.</p>
                    ) : (
                        <ul className="space-y-3">
                            {filtered.map((user) => (
                                <li key={user.user_id} className="rounded-xl border border-slate-400/10 bg-navy-900 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-100">{user.name}</p>
                                            <p className="break-all text-sm text-slate-300">{user.email}</p>
                                            <p className="mt-1 text-xs text-teal-300">
                                                {user.status} · {user.is_admin ? "Administrador" : "Usuário"}
                                                {user.user_id === currentUserId ? " · Sua conta" : ""}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => openDialog("password", user)}
                                                className="rounded-lg border border-slate-400/20 px-3 py-2 text-sm hover:bg-navy-800">
                                                Redefinir senha de {user.name}
                                            </button>
                                            <button type="button" onClick={() => openDialog("status", user)}
                                                disabled={user.user_id === currentUserId}
                                                title={user.user_id === currentUserId ? "Não altere a própria conta" : undefined}
                                                className="rounded-lg border border-teal-500/30 px-3 py-2 text-sm text-teal-300 disabled:cursor-not-allowed disabled:opacity-40">
                                                {user.status === "ACTIVE" ? "Desativar" : "Ativar"} {user.name}
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {dialog && (
                <div role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <form onSubmit={submitAction}
                        className="w-full max-w-md space-y-4 rounded-xl border border-slate-400/20 bg-navy-900 p-6 shadow-xl">
                        <h3 id="user-dialog-title" className="text-xl font-semibold text-slate-100">
                            {dialog.kind === "create" ? "Criar usuário" : dialog.kind === "password" ? "Redefinir senha" : "Alterar situação"}
                        </h3>
                        {dialog.user && <p className="break-all text-sm">{dialog.user.name} — {dialog.user.email}</p>}
                        {dialog.kind === "create" && (
                            <>
                                <label htmlFor="admin-user-name" className="flex flex-col gap-2 text-sm">
                                    Nome
                                    <input id="admin-user-name" value={fields.name} required maxLength={150} disabled={submitting}
                                        onChange={(event) => updateField("name", event.target.value)}
                                        className="rounded-lg border border-slate-400/20 bg-navy-950 p-3 text-slate-100" />
                                </label>
                                <label htmlFor="admin-user-email" className="flex flex-col gap-2 text-sm">
                                    E-mail
                                    <input id="admin-user-email" type="email" value={fields.email} required maxLength={150} disabled={submitting}
                                        onChange={(event) => updateField("email", event.target.value)}
                                        className="rounded-lg border border-slate-400/20 bg-navy-950 p-3 text-slate-100" />
                                </label>
                            </>
                        )}
                        {(dialog.kind === "create" || dialog.kind === "password") && (
                            <label htmlFor="admin-user-password" className="flex flex-col gap-2 text-sm">
                                {dialog.kind === "create" ? "Senha inicial" : "Nova senha"}
                                <input id="admin-user-password" type="password" value={fields.password} required minLength={8} maxLength={128}
                                    autoComplete="new-password" disabled={submitting}
                                    onChange={(event) => updateField("password", event.target.value)}
                                    className="rounded-lg border border-slate-400/20 bg-navy-950 p-3 text-slate-100" />
                                <span className="text-xs text-slate-400">Mínimo 8 caracteres, uma maiúscula e um número.</span>
                            </label>
                        )}
                        {dialog.kind === "status" && (
                            <p className="text-sm">
                                Confirma {dialog.user.status === "ACTIVE" ? "desativar" : "ativar"} a conta de {dialog.user.name}?
                            </p>
                        )}
                        {actionError && <p role="alert" className="text-sm text-rose-400">{actionError}</p>}
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={closeDialog} disabled={submitting}
                                className="rounded-lg border border-slate-400/20 px-4 py-2 disabled:opacity-40">Cancelar</button>
                            <button type="submit" disabled={submitting}
                                className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-navy-950 disabled:opacity-40">
                                {submitting ? "Salvando..." : "Confirmar"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}