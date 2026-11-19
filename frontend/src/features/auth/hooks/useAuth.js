
import { useContext } from "react";

import { AuthContext } from "../context/authContext";

/**
 * Hook para acessar o contexto
 * de autenticação do Corporate Chat.
 */
export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth deve ser utilizado dentro do AuthProvider."
        );
    }

    return context;
}
