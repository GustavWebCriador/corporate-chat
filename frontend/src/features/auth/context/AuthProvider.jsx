
import { useCallback, useEffect, useMemo, useState } from "react";

import { authService } from "../../../services/api/authService";
import {
    setAuthToken,
    setUnauthorizedHandler,
} from "../../../services/api/httpClient";

import { AuthContext } from "./authContext";

const SESSION_EXPIRED_MESSAGE =
    "Sua sessão foi encerrada por segurança. Entre novamente.";

export function AuthProvider({ children }) {
    // Dados do usuário autenticado.
    const [user, setUser] = useState(null);

    // JWT mantido em memória.
    const [token, setToken] = useState(null);

    // Estado das operações de autenticação.
    const [loading, setLoading] = useState(false);

    // Aviso exibido no login após encerramento forçado da sessão (RF02).
    const [sessionMessage, setSessionMessage] = useState("");

    /**
     * Remove as credenciais locais.
     */
    const clearSession = useCallback(() => {
        setAuthToken(null);
        setToken(null);
        setUser(null);
    }, []);

    /**
     * Sessão expirada, revogada ou inválida (CA02.2 / CA02.3):
     * remove o acesso autenticado e informa o usuário.
     */
    const expireSession = useCallback(() => {
        clearSession();
        setSessionMessage(SESSION_EXPIRED_MESSAGE);
    }, [clearSession]);

    useEffect(() => {
        setUnauthorizedHandler(expireSession);

        return () => {
            setUnauthorizedHandler(null);
        };
    }, [expireSession]);

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
            setSessionMessage("");

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
            clearSession();
            setLoading(false);
        }
    }, [clearSession]);

    /**
     * Dados disponibilizados pelo contexto.
     */
    const value = useMemo(() => ({
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        sessionMessage,
        login,
        logout,
        expireSession,
    }), [user, token, loading, sessionMessage, login, logout, expireSession]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
