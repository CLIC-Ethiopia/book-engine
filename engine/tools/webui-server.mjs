#!/usr/bin/env node
// webui-server.mjs — Express server for webui dashboard

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const WEBUI_DIR = path.join(PROJECT_ROOT, "webui");
const DATA_DIR = path.join(WEBUI_DIR, "data");

const INBOX_FILE = path.join(PROJECT_ROOT, "chat-inbox.json");
const OUTBOX_FILE = path.join(PROJECT_ROOT, "chat-outbox.json");
const HISTORY_FILE = path.join(DATA_DIR, "chat-history.json");

const app = express();
const PORT = process.env.WEBUI_PORT || 3000;

// Ensure directories/files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(INBOX_FILE)) fs.writeFileSync(INBOX_FILE, JSON.stringify({}), { encoding: 'utf8' });
if (!fs.existsSync(OUTBOX_FILE)) fs.writeFileSync(OUTBOX_FILE, JSON.stringify({}), { encoding: 'utf8' });
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), { encoding: 'utf8' });

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error("[server] Error:", err);
  res.status(500).json({ error: err.message });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/write-inbox", (req, res) => {
  try {
    const inbox = req.body;
    if (!inbox.requestId || !inbox.payload || !inbox.payload.message) {
      return res.status(400).json({ error: "Invalid inbox format" });
    }

    // Write a concise prompt file for the agent
    // Use --file flag so opencode reads from the file directly
    let promptContent = inbox.payload.message;
    if (inbox.payload.context) {
      const ctx = inbox.payload.context;
      const contextLines = [
        `--- CONTEXT ---`,
        `Book: ${ctx.book || "unknown"}`,
        `Page: ${ctx.page || "unknown"} (${ctx.pageIndex + 1}/${ctx.totalPages})`,
        `--- END CONTEXT ---`,
        ``,
        `User message: ${inbox.payload.message}`
      ];
      promptContent = contextLines.join("\n");
    }

    const enrichedInbox = { ...inbox, payload: { ...inbox.payload, prompt: promptContent } };
    fs.writeFileSync(INBOX_FILE, JSON.stringify(enrichedInbox, null, 2), { encoding: 'utf8' });
    appendToHistory("user", inbox.payload.message, inbox.payload.context);
    console.log(`[server] Written inbox for request ${inbox.requestId}`);
    res.json({ success: true });
  } catch (e) {
    console.error("[server] Error writing inbox:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/read-outbox", (req, res) => {
  try {
    const outbox = readJsonFile(OUTBOX_FILE);
    res.json(outbox);
  } catch (e) {
    console.error("[server] Error reading outbox:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/chat-history", (req, res) => {
  try {
    const history = readJsonFile(HISTORY_FILE);
    res.json(history);
  } catch (e) {
    console.error("[server] Error reading history:", e);
    res.json([]);
  }
});

app.delete("/api/chat-history", (req, res) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), { encoding: 'utf8' });
    res.json({ success: true });
  } catch (e) {
    console.error("[server] Error clearing history:", e);
    res.status(500).json({ error: e.message });
  }
});

// Serve static files from project root so /webui/* and /engine/* work correctly
app.use(express.static(PROJECT_ROOT));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(WEBUI_DIR, "index.html"));
});

// Helper to read JSON file and strip BOM if present
function readJsonFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (content.startsWith("\uFEFF")) {
    content = content.slice(1);
  }
  if (!content.trim() || content.trim() === "{}") {
    return {};
  }
  return JSON.parse(content);
}

function appendToHistory(role, content, context = {}) {
  try {
    const history = readJsonFile(HISTORY_FILE);
    history.push({
      role, content,
      context: { book: context.book, page: context.page, pageIndex: context.pageIndex, totalPages: context.totalPages },
      timestamp: new Date().toISOString()
    });
    if (history.length > 100) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), { encoding: 'utf8' });
  } catch (e) {
    console.error("[server] Error appending to history:", e);
  }
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[webui-server] Running at http://localhost:${PORT}`);
  console.log(`[webui-server] Serving: ${WEBUI_DIR}`);
});

server.on("error", (err) => {
  console.error("[webui-server] Server error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[webui-server] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[webui-server] Unhandled rejection:", reason);
});

export { app };