import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0792523954"
  });
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

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
      // 1. Fetch all FCM tokens from Supabase
      const { data: tokens, error: fetchError } = await supabase
        .from('user_tokens')
        .select('fcm_token');

      if (fetchError) throw fetchError;

      if (!tokens || tokens.length === 0) {
        return res.status(200).json({ message: "No users have enabled notifications yet." });
      }

      const fcmTokens = tokens.map(t => t.fcm_token);

      // 2. Send multicast message via FCM
      const message = {
        notification: { title, body },
        tokens: fcmTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log(`${response.successCount} messages were sent successfully`);

      // 3. Cleanup invalid tokens if any
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered') {
              failedTokens.push(fcmTokens[idx]);
            }
          }
        });

        if (failedTokens.length > 0) {
          await supabase
            .from('user_tokens')
            .delete()
            .in('fcm_token', failedTokens);
        }
      }

      res.json({ 
        message: `Successfully sent to ${response.successCount} users.`,
        successCount: response.successCount,
        failureCount: response.failureCount
      });
    } catch (error) {
      console.error("Error sending notification:", error);
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
