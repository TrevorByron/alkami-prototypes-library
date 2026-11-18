import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import App from "./App";
import { isDemoMode } from "./lib/demoMode";
import { seedDemoProfile } from "./lib/demoStore";
import { isFramed } from "./lib/selfEmbed";
import "./index.css";

if (isDemoMode) seedDemoProfile();

createRoot(document.getElementById("root")!).render(
  isFramed ? (
    <main className="flex min-h-screen items-center justify-center bg-carbon-0 p-6 text-center text-sm text-abyss-5">
      Alkami Prototypes can't be previewed inside itself.
    </main>
  ) : (
  <StrictMode>
    <AuthProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AuthProvider>
  </StrictMode>
  ),
);
