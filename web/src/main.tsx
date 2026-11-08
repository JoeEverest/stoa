import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// The desktop app gets native window chrome (hidden title bar, traffic lights over the sidebar).
if (window.stoaDesktop) document.documentElement.classList.add("desktop", `platform-${window.stoaDesktop.platform}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
