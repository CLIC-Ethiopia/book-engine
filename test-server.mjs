import express from "express";

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/test", (req, res) => {
  res.json({ received: req.body });
});

app.listen(PORT, () => {
  console.log(`Test server on port ${PORT}`);
});