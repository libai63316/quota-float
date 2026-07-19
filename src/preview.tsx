import React from "react";
import ReactDOM from "react-dom/client";
import { DesignPlayground } from "./components/DesignPlayground";
import "./styles.css";
import "./preview.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><DesignPlayground /></React.StrictMode>,
);
