import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const baseUrl = import.meta.env.BASE_URL;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${baseUrl}sw.js`, {
      scope: baseUrl,
    });
  });
}
