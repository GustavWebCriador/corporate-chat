import { Link } from "react-router-dom";

export function NotFoundPage() {
    return (
        <section className="page-card">
            <h1>Página não encontrada</h1>

            <p>
                O endereço informado não existe.
            </p>

            <Link to="/login">
                Voltar ao início
            </Link>
        </section>
    );
}