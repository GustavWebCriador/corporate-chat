import { Link } from "react-router-dom";
import { ApiStatus } from "../components/ApiStatus";

export function LoginPage() {
    return (
        <section className="page-card">
            <h1>Corporate Chat</h1>

            <p>
                Ambiente de comunicação corporativa.
            </p>

            <p>
                Autenticação em desenvolvimento.
            </p>

            <Link to="/solicitar-acesso">
                Solicitar acesso
            </Link>

            <ApiStatus />
        </section>
    );
}