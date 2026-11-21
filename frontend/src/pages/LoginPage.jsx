
import { useState } from "react";
import { ApiStatus } from "../components/ApiStatus";
import { useAuth } from "../features/auth/hooks/useAuth";
import {
    Link,
    Navigate,
    useNavigate,
    useLocation,
} from "react-router-dom";


export function LoginPage() {
    // Campos do formulário.
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Mensagem de erro apresentada ao usuário.
    const [error, setError] = useState("");

    const navigate = useNavigate();
    const location = useLocation();

    // Recupera o destino solicitado antes do login.
    const from = location.state?.from?.pathname || "/dashboard";


    // Contexto de autenticação.
    const {
        login,
        loading,
        isAuthenticated,
        sessionMessage,
    } = useAuth();

    /**
     * Envia as credenciais para autenticação.
     */
    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        try {
            await login(email.trim(), password);

            // Limpa o campo de senha após autenticação.
            setPassword("");

            // Redireciona para a rota protegida.
            navigate(from, { replace: true });

        } catch (err) {
            if (err.status === 401) {
                setError("E-mail ou senha inválidos.");
            } else if (err.status === 403) {
                setError("Acesso não autorizado.");
            } else if (err.status === 429) {
                setError(
                    "Muitas tentativas. Tente novamente mais tarde."
                );
            } else {
                setError(
                    err.message ||
                    "Não foi possível realizar o login."
                );
            }
        }
    }

    // Usuário já autenticado não precisa ver o formulário.
    if (isAuthenticated) {
        return <Navigate to={from} replace />;
    }

    return (
        <section className="page-card">
            <h1>Corporate Chat</h1>

            <p>
                Ambiente de comunicação corporativa.
            </p>

            {sessionMessage && !error && (
                <p role="status" className="session-message">
                    {sessionMessage}
                </p>
            )}

            <form
                onSubmit={handleSubmit}
                style={{
                    display: "grid",
                    gap: "0.75rem",
                    marginTop: "1.5rem",
                }}
            >
                <label htmlFor="email">
                    E-mail
                </label>

                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                        setEmail(event.target.value)
                    }
                    placeholder="seuemail@empresa.com.br"
                    autoComplete="username"
                    disabled={loading}
                    required
                />

                <label htmlFor="password">
                    Senha
                </label>

                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                        setPassword(event.target.value)
                    }
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                />

                {error && (
                    <p role="alert">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Autenticando..."
                        : "Entrar"}
                </button>
            </form>

            <p>
                Ainda não possui acesso?
            </p>

            <Link to="/solicitar-acesso">
                Solicitar acesso
            </Link>

            <ApiStatus />
        </section>
    );
}
