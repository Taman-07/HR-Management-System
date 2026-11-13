import express from "express";
import cors from "cors";
import { config } from "./src/config/env.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "HR Cortex is running" });
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});