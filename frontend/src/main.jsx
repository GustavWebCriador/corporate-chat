
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App";
import { AuthProvider } from "./features/auth/context/AuthProvider";
import { RealtimeProvider } from "./features/realtime/context/RealtimeProvider";

import "./styles/tailwind.css";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
<StrictMode>
    <BrowserRouter>
        <AuthProvider>
            <RealtimeProvider>
                <App />
            </RealtimeProvider>
        </AuthProvider>
    </BrowserRouter>
</StrictMode>
);
