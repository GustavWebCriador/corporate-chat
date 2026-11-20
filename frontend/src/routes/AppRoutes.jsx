
import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";

import { PublicLayout } from "../layouts/PublicLayout";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";

import { LoginPage } from "../pages/LoginPage";
import { RegistrationRequestPage } from "../pages/RegistrationRequestPage";
import { DashboardPage } from "../pages/DashboardPage";
import { NotFoundPage } from "../pages/NotFoundPage";

import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<PublicLayout />}>
                <Route
                    path="/"
                    element={<Navigate to="/login" replace />}
                />

                <Route
                    path="/login"
                    element={<LoginPage />}
                />

                <Route
                    path="/solicitar-acesso"
                    element={<RegistrationRequestPage />}
                />

                <Route
                    path="*"
                    element={<NotFoundPage />}
                />
            </Route>

            <Route element={<ProtectedRoute />}>
                <Route element={<AuthenticatedLayout />}>
                    <Route
                        path="/dashboard"
                        element={<DashboardPage />}
                    />
                </Route>
            </Route>
        </Routes>
    );
}
