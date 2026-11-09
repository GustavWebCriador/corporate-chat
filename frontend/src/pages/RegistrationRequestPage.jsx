import { Link } from "react-router-dom";

export function RegistrationRequestPage() {
    return (
        <section className="page-card">
            <h1>Solicitar acesso</h1>

            <p>
                O formulário de solicitação de cadastro
                será implementado na FE-02.
            </p>

            <Link to="/login">
                Voltar ao login
            </Link>
        </section>
    );
}