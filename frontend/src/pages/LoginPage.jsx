import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";

/** FE-09: identidade visual do MVP com autenticação real preservada. */
export function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");

    const { login, user, loading, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/dashboard";

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        try {
            await login(email.trim(), password);
            setPassword("");
            navigate(from, { replace: true });
        } catch (err) {
            if (err.status === 401) {
                setError("E-mail ou senha inválidos.");
            } else if (err.status === 403) {
                setError("Acesso não autorizado.");
            } else if (err.status === 429) {
                setError("Muitas tentativas. Tente novamente mais tarde.");
            } else {
                setError(err.message || "Não foi possível realizar o login.");
            }
        }
    }

    return (
        <div className="mvp-login-shell">
            <section className="mvp-login-brand" aria-label="Apresentação do Corporate Chat">
                <div className="mvp-brand-lockup">
                    <span className="mvp-logo-mark">Cc</span>
                    <span>Corporate Chat</span>
                </div>

                <div className="mvp-login-pitch">
                    <p className="mvp-eyebrow">COMUNICAÇÃO CORPORATIVA</p>
                    <h1>Sua equipe,<br />sempre conectada.</h1>
                    <p className="mvp-muted">
                        Grupos organizados, mensagens privadas e histórico completo —
                        tudo em um só lugar para que nada se perca.
                    </p>
                    <div className="mvp-feature-pills">
                        <span>⚡ Tempo real</span>
                        <span>💬 Mensagens privadas</span>
                        <span>👥 Grupos</span>
                        <span>🔒 Acesso autenticado</span>
                    </div>
                </div>

                {/* FE-09: card institucional do MVP, acima do brilho de fundo. */}
                <div className="mvp-login-brand-footer">
                    <p className="mvp-login-footer-message">
                        Um espaço mais simples para conversar, organizar assuntos
                        e manter sua equipe alinhada.
                    </p>
                    <div className="mvp-login-footer-signature">
                        <span className="mvp-login-footer-logo" aria-hidden="true">Cc</span>
                        <div className="mvp-login-footer-copy">
                            <strong>Corporate Chat</strong>
                            <span>Plataforma de comunicação interna</span>
                        </div>
                    </div>
                </div>
            </section>

            <main className="mvp-login-main">
                <div className="mvp-login-mobile-logo mvp-brand-lockup">
                    <span className="mvp-logo-mark">Cc</span>
                    <span>Corporate Chat</span>
                </div>

                <div className="mvp-login-form-wrap">
                    <h2>Bem-vindo de volta</h2>
                    <p className="mvp-muted">Acesse sua conta para continuar</p>
                    {isAuthenticated ? (
                        <div role="status" className="mvp-login-success">
                            <h3>Autenticação realizada!</h3>
                            <p>Bem-vindo, {user?.name || "usuário"}.</p>
                            <Link className="mvp-primary-link" to="/dashboard">
                                Ir ao dashboard
                            </Link>
                        </div>
                    ) : (
                        <form className="mvp-login-form" onSubmit={handleSubmit}>
                            <label htmlFor="email">E-mail corporativo</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="username"
                                required
                                disabled={loading}
                                placeholder="voce@empresa.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />

                            <div className="mvp-password-label">
                                <label htmlFor="password">Senha</label>
                            </div>
                            <div className="mvp-password-control">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    disabled={loading}
                                    placeholder="Digite sua senha"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword((value) => !value)}
                                >
                                    {showPassword ? "Ocultar" : "Mostrar"}
                                </button>
                            </div>

                            {error && (
                                <p role="alert" className="mvp-form-error">{error}</p>
                            )}
                            <button className="mvp-login-submit" type="submit" disabled={loading}>
                                {loading ? "Autenticando..." : "Entrar"}
                            </button>
                        </form>
                    )}
                    <p className="mvp-login-request">
                        Não tem uma conta? <Link to="/solicitar-acesso">Solicite acesso</Link>
                    </p>
                </div>
                <footer className="mvp-login-legal">Corporate Chat · Comunicação corporativa</footer>
            </main>
        </div>
    );
}
