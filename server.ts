import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Database setup
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "chat.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add session_id if missing
const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
const hasSessionId = tableInfo.some((col: any) => col.name === 'session_id');

if (!hasSessionId) {
  console.log("Adding session_id column to messages table...");
  db.exec("ALTER TABLE messages ADD COLUMN session_id TEXT");
}

app.use(express.json());
app.use(cookieParser());

// Session middleware
app.use((req, res, next) => {
  let sessionId = req.cookies.session_id;
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie("session_id", sessionId, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 
    });
  }
  req.sessionId = sessionId;
  next();
});

// API Routes
app.get("/api/messages", (req, res) => {
  const sessionId = req.sessionId;
  const messages = db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC").all(sessionId);
  res.json(messages);
});

app.post("/api/chat", async (req, res) => {
  const { content } = req.body;
  const sessionId = req.sessionId;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  // Save user message
  const userMsgId = uuidv4();
  db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)").run(
    userMsgId,
    sessionId,
    "user",
    content
  );

  try {
    // Proxy to n8n if configured, otherwise mock response
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "https://n8n.sysitadmin.com/webhook/9e5a8ed5-e4e3-4a79-828f-a05430652fab/chat";
    
    let assistantContent = "I'm sorry, I couldn't connect to the n8n workflow. Please check the N8N_WEBHOOK_URL environment variable.";
    
    if (n8nWebhookUrl) {
      try {
        console.log(`Sending request to n8n: ${n8nWebhookUrl}`);
        const response = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chatInput: content,
            message: content, // Some workflows use 'message'
            content: content,
            sessionId: sessionId,
            action: "sendMessage", // Common in n8n chat templates
            timestamp: new Date().toISOString()
          })
        });
        
        console.log(`n8n response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("n8n response data:", JSON.stringify(data));
          
          // Handle various n8n response formats
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            assistantContent = firstItem.output || firstItem.response || firstItem.text || JSON.stringify(firstItem);
          } else {
            assistantContent = data.output || data.response || data.text || (typeof data === 'string' ? data : JSON.stringify(data));
          }
        } else {
          const errorText = await response.text();
          console.error("n8n error response:", errorText);
          assistantContent = `n8n returned an error (${response.status}). Please check your n8n workflow logs.`;
        }
      } catch (fetchError) {
        console.error("Fetch error to n8n:", fetchError);
        assistantContent = "Failed to reach n8n webhook. Please ensure the n8n instance is online and the webhook is active.";
      }
    } else {
      assistantContent = "This is a demo response. To connect to n8n, please set the N8N_WEBHOOK_URL environment variable.";
    }

    // Save assistant message
    const assistantMsgId = uuidv4();
    db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)").run(
      assistantMsgId,
      sessionId,
      "assistant",
      assistantContent
    );

    const now = new Date().toISOString();
    res.json({ 
      userMessage: { id: userMsgId, role: "user", content, timestamp: now },
      assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, timestamp: now }
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

app.delete("/api/messages", (req, res) => {
  const sessionId = req.sessionId;
  db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
  res.json({ success: true });
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

// Extend Request type for sessionId
declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}
