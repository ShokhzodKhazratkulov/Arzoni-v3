import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as OneSignal from 'onesignal-node';
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Initialize OneSignal Client
const oneSignalClient = new OneSignal.Client(
  process.env.VITE_ONESIGNAL_APP_ID || "",
  process.env.ONESIGNAL_REST_API_KEY || ""
);

// Initialize Supabase Admin
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  app.post("/api/send-notification", express.json(), async (req, res) => {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: "Title and body are required." });
    }

    try {
      const notification = {
        contents: {
          en: body,
        },
        headings: {
          en: title,
        },
        included_segments: ['All'], // Send to all subscribed users
      };

      const response = await oneSignalClient.createNotification(notification);
      
      console.log('OneSignal notification sent:', response.body);

      res.json({ 
        message: `Notification broadcast sent successfully.`,
        id: response.body.id,
        recipients: response.body.recipients
      });
    } catch (error) {
      console.error("Error sending OneSignal notification:", error);
      res.status(500).json({ message: "Failed to send notification.", error: String(error) });
    }
  });

  // Determine if we are in production
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    // In production, serve from the 'dist' directory
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // In development, use Vite middleware
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          host: '0.0.0.0',
          port: 3000,
          hmr: process.env.DISABLE_HMR !== 'true'
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (error) {
      console.warn("Vite not found, falling back to static serving. Ensure NODE_ENV=production is set in production.");
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
