import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";

import { PublicLayout } from "../layouts/PublicLayout";
import { LoginPage } from "../pages/LoginPage";
import { RegistrationRequestPage } from "../pages/RegistrationRequestPage";
import { NotFoundPage } from "../pages/NotFoundPage";

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
        </Routes>
    );
}