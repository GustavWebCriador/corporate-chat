
import { useCallback, useMemo, useState } from "react";

import { authService } from "../../../services/api/authService";
import { setAuthToken } from "../../../services/api/httpClient";

import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
    // Dados do usuário autenticado.
    const [user, setUser] = useState(null);

    // JWT mantido em memória.
    const [token, setToken] = useState(null);

    // Estado das operações de autenticação.
    const [loading, setLoading] = useState(false);

    /**
     * Realiza o login do usuário.
     */
    const login = useCallback(async (email, password) => {
        setLoading(true);

        try {
            const response = await authService.login(
                email,
                password
            );

            if (!response?.token || !response?.user) {
                throw new Error(
                    "Resposta de autenticação inválida."
                );
            }

            // Configura o JWT nas requisições HTTP.
            setAuthToken(response.token);

            // Atualiza a sessão React.
            setToken(response.token);
            setUser(response.user);

            return response.user;

        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Encerra a sessão do usuário.
     */
    const logout = useCallback(async () => {
        setLoading(true);

        try {
            await authService.logout();

        } finally {
            // Remove as credenciais locais.
            setAuthToken(null);
            setToken(null);
            setUser(null);
            setLoading(false);
        }
    }, []);

    /**
     * Dados disponibilizados pelo contexto.
     */
    const value = useMemo(() => ({
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        login,
        logout,
    }), [user, token, loading, login, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
