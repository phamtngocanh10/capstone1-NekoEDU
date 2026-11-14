import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/login.css";
import "./styles/dashboard.css";
import "./styles/ui.css";
import "./styles/pages.css";

const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
