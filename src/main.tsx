import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Na een nieuwe Vercel-deploy zijn oude JS-chunks ongeldig.
// In plaats van een witte pagina of crash, herlaad de app automatisch.
window.addEventListener('vite:preloadError', () => window.location.reload());
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to load module script')
  ) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
