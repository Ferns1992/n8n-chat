import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists for Docker persistence
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, "chat.db"));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Add a default user if not exists (password: admin123)
  INSERT OR IGNORE INTO users (email, password) VALUES ('admin@example.com', 'admin123');
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Simple Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const session = req.cookies.session;
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;

    if (user) {
      res.cookie("session", user.id, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      res.json({ id: user.id, email: user.email });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("session");
    res.json({ success: true });
  });

  app.get("/api/me", (req, res) => {
    const sessionId = req.cookies.session;
    if (!sessionId) return res.status(401).json({ error: "Not logged in" });
    
    const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(sessionId) as any;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Session invalid" });
    }
  });

  // API Routes
  app.get("/api/history/:sessionId", authenticate, (req, res) => {
    const { sessionId } = req.params;
    const messages = db.prepare("SELECT role, content, timestamp FROM messages WHERE sessionId = ? ORDER BY timestamp ASC").all(sessionId);
    res.json(messages);
  });

  app.post("/api/chat", authenticate, async (req, res) => {
    const { sessionId, message } = req.body;
    const n8nWebhookUrl = "https://n8n.sysitadmin.com/webhook/9e5a8ed5-e4e3-4a79-828f-a05430652fab/chat";

    try {
      // Save user message
      db.prepare("INSERT INTO messages (sessionId, role, content) VALUES (?, ?, ?)").run(sessionId, "user", message);

      // Call n8n
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, 
          message,
          chatInput: message, // Some n8n nodes expect this
          text: message       // Others expect this
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n responded with ${response.status}`);
      }

      const data = await response.json();
      console.log("n8n response data:", JSON.stringify(data, null, 2));

      // n8n often returns an array of results: [ { "output": "..." } ]
      let aiMessage = "";
      
      const extractContent = (obj: any): string => {
        if (!obj) return "";
        if (typeof obj === 'string') return obj;
        return obj.output || obj.response || obj.text || obj.message || (typeof obj === 'object' ? JSON.stringify(obj) : String(obj));
      };

      if (Array.isArray(data)) {
        // If it's an array, take the first item's content or join them
        aiMessage = data.length > 0 ? extractContent(data[0]) : "No response from n8n.";
      } else {
        aiMessage = extractContent(data);
      }

      if (!aiMessage) {
        aiMessage = "Received empty response from n8n.";
      }

      // Save AI message
      db.prepare("INSERT INTO messages (sessionId, role, content) VALUES (?, ?, ?)").run(sessionId, "assistant", aiMessage);

      res.json({ role: "assistant", content: aiMessage });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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
