import React from "react";
import ReactDOM from "react-dom/client";
import { Survey } from "./features/survey/survey";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Survey />
  </React.StrictMode>,
);
