
import { useState } from "react";
import { Link } from "react-router-dom";

import { registrationService } from "../services/api/registrationService";

export function RegistrationRequestPage() {
    // Dados informados pelo solicitante.
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    // Controle da requisição.
    const [loading, setLoading] = useState(false);

    // Mensagens apresentadas na interface.
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    /**
     * Envia a solicitação de cadastro
     * para a API do Corporate Chat.
     */
    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setSuccess(false);

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        // Validação inicial no frontend.
        if (!normalizedName || !normalizedEmail) {
            setError("Preencha todos os campos.");
            return;
        }

        if (normalizedEmail.length > 150) {
            setError(
                "O e-mail deve possuir no máximo 150 caracteres."
            );
            return;
        }

        setLoading(true);

        try {
            await registrationService.requestAccess(
                normalizedName,
                normalizedEmail
            );

            // Solicitação aceita pelo backend.
            setSuccess(true);

            // Limpa os campos após sucesso.
            setName("");
            setEmail("");

        } catch (err) {
            if (err.status === 429) {
                setError(
                    "Muitas solicitações. Tente novamente mais tarde."
                );
            } else if (
                err.status === 400 ||
                err.status === 409 ||
                err.status === 422
            ) {
                setError(
                    err.message ||
                    "Não foi possível validar a solicitação."
                );
            } else {
                setError(
                    "Não foi possível enviar a solicitação. " +
                    "Verifique sua conexão e tente novamente."
                );
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="page-card">
            <h1>Solicitar acesso</h1>

            <p>
                Preencha seus dados para solicitar
                acesso ao Corporate Chat.
            </p>

            <p>
                Sua solicitação será encaminhada
                para análise administrativa.
            </p>

            {success ? (
                <div role="status">
                    <h2>Solicitação enviada!</h2>

                    <p>
                        Seu pedido foi recebido com sucesso.
                    </p>

                    <p>
                        Aguarde a análise e aprovação
                        do administrador para obter acesso.
                    </p>

                    <Link to="/login">
                        Voltar ao login
                    </Link>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "grid",
                        gap: "0.75rem",
                        marginTop: "1.5rem",
                    }}
                >
                    <label htmlFor="name">
                        Nome completo
                    </label>

                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(event) =>
                            setName(event.target.value)
                        }
                        placeholder="Digite seu nome completo"
                        autoComplete="name"
                        disabled={loading}
                        required
                    />

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
                        autoComplete="email"
                        maxLength={150}
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
                            ? "Enviando solicitação..."
                            : "Solicitar acesso"}
                    </button>

                    <Link to="/login">
                        Voltar ao login
                    </Link>
                </form>
            )}
        </section>
    );
}
