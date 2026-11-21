import { useEffect, useState } from "react";

import { adminService } from "../../../services/api/adminService";

import {
    PASSWORD_HINT,
    PASSWORD_MAX_LENGTH,
    REJECTION_REASON_MAX_LENGTH,
    REQUEST_STATUS_LABELS,
    describeAdminError,
    formatDateTime,
    validatePassword,
} from "../utils/admin";

const PAGE_SIZE = 20;

const FILTERS = [
    { value: "PENDING", label: "Pendentes" },
    { value: "APPROVED", label: "Aprovadas" },
    { value: "REJECTED", label: "Rejeitadas" },
    { value: "ALL", label: "Todas" },
];

const STATUS_STYLES = {
    PENDING: "bg-amber-400/15 text-amber-400",
    APPROVED: "bg-teal-500/15 text-teal-300",
    REJECTED: "bg-rose-500/15 text-rose-500",
};

const inputClass =
    "w-full rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-teal-500";

/**
 * Análise das solicitações de cadastro (RF04 — CA04.3 / CA04.4).
 * A aprovação cria o usuário com a senha inicial informada.
 */
export function RegistrationRequestsPanel({ onUserCreated }) {
    const [filter, setFilter] = useState("PENDING");
    const [offset, setOffset] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const [data, setData] = useState(null);
    const [status, setStatus] = useState("loading");

    const [action, setAction] = useState(null); // { id, type }
    const [password, setPassword] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;

        adminService.listRequests({ status: filter, limit: PAGE_SIZE, offset })
            .then((response) => {
                if (!active) return;

                if (!Array.isArray(response?.requests)) {
                    throw new Error("INVALID_REQUESTS_RESPONSE");
                }

                setData(response);
                setStatus("ready");
            })
            .catch(() => {
                if (active) setStatus("error");
            });

        return () => {
            active = false;
        };
    }, [filter, offset, reloadKey]);

    function changeFilter(value) {
        setStatus("loading");
        setFilter(value);
        setOffset(0);
        closeAction();
    }

    function openAction(id, type) {
        setAction({ id, type });
        setPassword("");
        setReason("");
        setFormError("");
        setNotice("");
    }

    function closeAction() {
        setAction(null);
        setPassword("");
        setReason("");
        setFormError("");
    }

    async function submit(event, request) {
        event.preventDefault();

        if (action.type === "approve") {
            const passwordError = validatePassword(password);

            if (passwordError) {
                setFormError(passwordError);
                return;
            }
        } else if (!reason.trim()) {
            setFormError("Informe o motivo da rejeição.");
            return;
        }

        setBusy(true);
        setFormError("");

        try {
            if (action.type === "approve") {
                await adminService.approveRequest(request.request_id, password);
                setNotice(`Acesso de ${request.name} aprovado. Informe a senha inicial ao solicitante.`);
                onUserCreated?.();
            } else {
                await adminService.rejectRequest(request.request_id, reason.trim());
                setNotice(`Solicitação de ${request.name} rejeitada.`);
            }

            closeAction();
            setReloadKey((current) => current + 1);
        } catch (err) {
            setFormError(describeAdminError(err));
        } finally {
            setBusy(false);
        }
    }

    const requests = data?.requests ?? [];
    const total = data?.pagination?.total ?? requests.length;

    return (
        <section aria-labelledby="requests-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="requests-title" className="text-lg font-semibold">
                    Solicitações de acesso
                </h2>

                <div role="group" aria-label="Filtrar solicitações" className="flex flex-wrap gap-1">
                    {FILTERS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => changeFilter(item.value)}
                            aria-pressed={filter === item.value}
                            className={`rounded-lg px-3 py-1.5 text-xs ${
                                filter === item.value
                                    ? "bg-teal-500 font-semibold text-navy-950"
                                    : "border border-slate-400/20 hover:bg-navy-800"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {notice && (
                <p role="status" className="rounded-lg bg-teal-500/10 px-3 py-2 text-sm text-teal-300">
                    {notice}
                </p>
            )}

            {status === "loading" && (
                <p className="text-sm text-slate-400">Carregando solicitações...</p>
            )}

            {status === "error" && (
                <div role="alert" className="space-y-2">
                    <p className="text-sm text-rose-500">Não foi possível carregar as solicitações.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("loading");
                            setReloadKey((current) => current + 1);
                        }}
                        className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-navy-950"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {status === "ready" && requests.length === 0 && (
                <p className="rounded-lg border border-slate-400/10 bg-navy-900 p-5 text-sm text-slate-400">
                    Nenhuma solicitação encontrada.
                </p>
            )}

            {status === "ready" && requests.length > 0 && (
                <ul className="space-y-2">
                    {requests.map((request) => {
                        const isOpen = action?.id === request.request_id;

                        return (
                            <li
                                key={request.request_id}
                                className="rounded-lg border border-slate-400/10 bg-navy-900 p-4"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold">{request.name}</p>
                                        <p className="truncate text-sm text-slate-400">{request.email}</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Solicitado em {formatDateTime(request.requested_at)}
                                            {request.reviewed_at && ` · Analisado em ${formatDateTime(request.reviewed_at)}`}
                                        </p>
                                        {request.rejection_reason && (
                                            <p className="mt-1 text-xs text-slate-400">
                                                Motivo: {request.rejection_reason}
                                            </p>
                                        )}
                                    </div>

                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status] ?? ""}`}>
                                        {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                                    </span>
                                </div>

                                {request.status === "PENDING" && !isOpen && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openAction(request.request_id, "approve")}
                                            aria-label={`Aprovar ${request.name}`}
                                            className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-navy-950"
                                        >
                                            Aprovar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openAction(request.request_id, "reject")}
                                            aria-label={`Rejeitar ${request.name}`}
                                            className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-sm text-rose-500 hover:bg-rose-500/10"
                                        >
                                            Rejeitar
                                        </button>
                                    </div>
                                )}

                                {isOpen && (
                                    <form
                                        onSubmit={(event) => submit(event, request)}
                                        className="mt-3 space-y-2"
                                        noValidate
                                    >
                                        {action.type === "approve" ? (
                                            <>
                                                <label htmlFor={`password-${request.request_id}`} className="block text-sm font-medium">
                                                    Senha inicial
                                                </label>
                                                <input
                                                    id={`password-${request.request_id}`}
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={password}
                                                    maxLength={PASSWORD_MAX_LENGTH}
                                                    onChange={(event) => setPassword(event.target.value)}
                                                    disabled={busy}
                                                    className={inputClass}
                                                />
                                                <p className="text-xs text-slate-400">{PASSWORD_HINT}</p>
                                            </>
                                        ) : (
                                            <>
                                                <label htmlFor={`reason-${request.request_id}`} className="block text-sm font-medium">
                                                    Motivo da rejeição
                                                </label>
                                                <textarea
                                                    id={`reason-${request.request_id}`}
                                                    rows={2}
                                                    value={reason}
                                                    maxLength={REJECTION_REASON_MAX_LENGTH}
                                                    onChange={(event) => setReason(event.target.value)}
                                                    disabled={busy}
                                                    className={`${inputClass} resize-none`}
                                                />
                                                <p className="text-right text-xs text-slate-400">
                                                    {reason.length}/{REJECTION_REASON_MAX_LENGTH}
                                                </p>
                                            </>
                                        )}

                                        {formError && (
                                            <p role="alert" className="text-sm text-rose-500">{formError}</p>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={busy}
                                                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                                    action.type === "approve"
                                                        ? "bg-teal-500 text-navy-950"
                                                        : "bg-rose-500 text-white"
                                                } disabled:opacity-50`}
                                            >
                                                {action.type === "approve" ? "Confirmar aprovação" : "Confirmar rejeição"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={closeAction}
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

            {status === "ready" && total > PAGE_SIZE && (
                <nav aria-label="Paginação de solicitações" className="flex items-center justify-between text-sm">
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("loading");
                            setOffset((current) => Math.max(current - PAGE_SIZE, 0));
                        }}
                        disabled={offset === 0}
                        className="rounded-lg border border-slate-400/20 px-3 py-1.5 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    <span className="text-slate-400">
                        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("loading");
                            setOffset((current) => current + PAGE_SIZE);
                        }}
                        disabled={offset + PAGE_SIZE >= total}
                        className="rounded-lg border border-slate-400/20 px-3 py-1.5 disabled:opacity-40"
                    >
                        Próxima
                    </button>
                </nav>
            )}
        </section>
    );
}
