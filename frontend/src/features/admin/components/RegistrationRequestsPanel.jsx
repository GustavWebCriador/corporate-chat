import { useEffect, useState } from "react";
import { adminRegistrationService } from "../../../services/api/adminRegistrationService";

const PAGE_SIZE = 20;
const FILTERS = [
    ["PENDING", "Pendentes"],
    ["APPROVED", "Aprovadas"],
    ["REJECTED", "Rejeitadas"],
    ["ALL", "Todas"],
];

function formatDate(date) {
    if (!date) return "—";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("pt-BR");
}

function isValidPassword(password) {
    return password.length >= 8 && password.length <= 128 &&
        /[A-Z]/.test(password) && /\d/.test(password);
}

export function RegistrationRequestsPanel() {
    const [filter, setFilter] = useState("PENDING");
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState({ requests: [], pagination: { total: 0 } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [review, setReview] = useState(null);
    const [password, setPassword] = useState("");
    const [reason, setReason] = useState("");
    const [actionError, setActionError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        adminRegistrationService.list({ status: filter, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
            .then((response) => {
                if (!active) return;
                if (!Array.isArray(response?.requests) ||
                    !Number.isInteger(response?.pagination?.total)) {
                    throw new Error("Resposta inválida da listagem de solicitações.");
                }
                setResult(response);
                setError("");
            })
            .catch((err) => {
                if (active) setError(err.message || "Não foi possível carregar as solicitações.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [filter, page, revision]);

    function refresh() {
        setLoading(true);
        setError("");
        setRevision((current) => current + 1);
    }

    function changeFilter(value) {
        setFilter(value);
        setPage(0);
        setLoading(true);
        setError("");
        setNotice("");
    }

    function changePage(nextPage) {
        setPage(nextPage);
        setLoading(true);
        setError("");
    }

    function openReview(request, kind) {
        setReview({ request, kind });
        setPassword("");
        setReason("");
        setActionError("");
    }

    function closeReview() {
        if (submitting) return;
        setReview(null);
        setPassword("");
        setReason("");
        setActionError("");
    }

    async function submitReview(event) {
        event.preventDefault();
        if (!review || submitting) return;
        if (review.kind === "approve" && !isValidPassword(password)) {
            setActionError("A senha inicial deve ter 8 a 128 caracteres, uma letra maiúscula e um número.");
            return;
        }
        if (review.kind === "reject" && (!reason.trim() || reason.trim().length > 500)) {
            setActionError("Informe uma justificativa de até 500 caracteres.");
            return;
        }
        setSubmitting(true);
        setActionError("");
        try {
            if (review.kind === "approve") {
                await adminRegistrationService.approve(review.request.request_id, password);
            } else {
                await adminRegistrationService.reject(review.request.request_id, reason.trim());
            }
            const verb = review.kind === "approve" ? "aprovada" : "rejeitada";
            setNotice(`Solicitação de ${review.request.name} ${verb} com sucesso.`);
            setReview(null);
            setPassword("");
            setReason("");
            if (page > 0 && result.requests.length === 1) {
                changePage(page - 1);
            } else {
                refresh();
            }
        } catch (err) {
            setActionError(err.message || "Não foi possível analisar a solicitação.");
        } finally {
            setSubmitting(false);
        }
    }

    const total = result.pagination.total;
    const canGoNext = (page + 1) * PAGE_SIZE < total;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-slate-100">Solicitações de cadastro</h2>
                    <p className="mt-1 text-sm text-slate-400">Analise pedidos de acesso enviados publicamente.</p>
                </div>
                <div className="flex items-end gap-3">
                    <label className="flex flex-col gap-1 text-sm" htmlFor="request-status">
                        Situação
                        <select id="request-status" value={filter} disabled={submitting}
                            onChange={(event) => changeFilter(event.target.value)}
                            className="rounded-lg border border-slate-400/20 bg-navy-900 px-3 py-2 text-slate-100">
                            {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={refresh} disabled={loading}
                        className="rounded-lg border border-teal-500/40 px-4 py-2 text-sm text-teal-300 disabled:opacity-50">
                        Atualizar solicitações
                    </button>
                </div>
            </div>

            {notice && <p role="status" className="rounded-lg bg-teal-500/10 p-3 text-sm text-teal-300">{notice}</p>}
            {loading && <p role="status">Carregando solicitações...</p>}
            {error && <div role="alert" className="rounded-lg border border-rose-500/30 p-4 text-rose-400">
                {error} <button type="button" onClick={refresh} className="ml-2 underline">Tentar novamente</button>
            </div>}

            {!loading && !error && (
                <>
                    <p className="text-sm text-slate-400">{total} solicitação(ões) encontrada(s).</p>
                    {result.requests.length === 0 ? (
                        <p className="rounded-lg border border-slate-400/10 bg-navy-900 p-5 text-sm text-slate-400">
                            Nenhuma solicitação encontrada.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {result.requests.map((request) => (
                                <li key={request.request_id} className="rounded-xl border border-slate-400/10 bg-navy-900 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-100">{request.name}</p>
                                            <p className="break-all text-sm text-slate-300">{request.email}</p>
                                            <p className="mt-1 text-xs text-slate-400">Solicitada em {formatDate(request.requested_at)}</p>
                                            <p className="mt-1 text-xs text-teal-300">Situação: {request.status}</p>
                                            {request.rejection_reason && <p className="mt-2 text-sm text-rose-300">Motivo: {request.rejection_reason}</p>}
                                        </div>
                                        {request.status === "PENDING" && (
                                            <div className="flex flex-wrap gap-2">
                                                <button type="button" onClick={() => openReview(request, "approve")}
                                                    className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-navy-950">
                                                    Aprovar {request.name}
                                                </button>
                                                <button type="button" onClick={() => openReview(request, "reject")}
                                                    className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300">
                                                    Rejeitar {request.name}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center justify-between gap-4 text-sm">
                        <button type="button" disabled={page === 0} onClick={() => changePage(page - 1)}
                            className="rounded-lg border border-slate-400/20 px-3 py-2 disabled:opacity-40">Anterior</button>
                        <span>Página {page + 1}</span>
                        <button type="button" disabled={!canGoNext} onClick={() => changePage(page + 1)}
                            className="rounded-lg border border-slate-400/20 px-3 py-2 disabled:opacity-40">Próxima</button>
                    </div>
                </>
            )}

            {review && (
                <div role="dialog" aria-modal="true" aria-labelledby="review-dialog-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <form onSubmit={submitReview} className="w-full max-w-md space-y-4 rounded-xl border border-slate-400/20 bg-navy-900 p-6 shadow-xl">
                        <h3 id="review-dialog-title" className="text-xl font-semibold text-slate-100">
                            {review.kind === "approve" ? "Aprovar solicitação" : "Rejeitar solicitação"}
                        </h3>
                        <p className="break-all text-sm">{review.request.name} — {review.request.email}</p>
                        {review.kind === "approve" ? (
                            <label className="flex flex-col gap-2 text-sm" htmlFor="review-password">
                                Senha inicial do novo usuário
                                <input id="review-password" type="password" autoComplete="new-password"
                                    required minLength={8} maxLength={128} value={password} disabled={submitting}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="rounded-lg border border-slate-400/20 bg-navy-950 p-3 text-slate-100" />
                                <span className="text-xs text-slate-400">Mínimo 8 caracteres, uma maiúscula e um número.</span>
                            </label>
                        ) : (
                            <label className="flex flex-col gap-2 text-sm" htmlFor="review-reason">
                                Justificativa obrigatória
                                <textarea id="review-reason" required maxLength={500} rows={4} value={reason} disabled={submitting}
                                    onChange={(event) => setReason(event.target.value)}
                                    className="rounded-lg border border-slate-400/20 bg-navy-950 p-3 text-slate-100" />
                            </label>
                        )}
                        {actionError && <p role="alert" className="text-sm text-rose-400">{actionError}</p>}
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={closeReview} disabled={submitting}
                                className="rounded-lg border border-slate-400/20 px-4 py-2 disabled:opacity-50">Cancelar</button>
                            <button type="submit" disabled={submitting}
                                className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-navy-950 disabled:opacity-50">
                                {submitting ? "Salvando..." : "Confirmar análise"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}