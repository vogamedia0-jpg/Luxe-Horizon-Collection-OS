import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseApiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

const isPublicApiRoute = (req: Request) => {
  if (req.method !== "GET") return false;
  if (req.path === "/healthz") return true;
  if (req.path === "/catalogue") return true;
  if (/^\/catalogue\/[^/]+$/.test(req.path)) return true;
  return false;
};

async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (isPublicApiRoute(req)) return next();
  if (!supabaseUrl || !supabaseApiKey) {
    res.status(503).json({ error: "Supabase server configuration is missing." });
    return;
  }
  const authorization = req.header("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseApiKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    next();
  } catch {
    res.status(503).json({ error: "Authentication service unavailable." });
  }
}

app.use("/api", requireAdminSession, router);

export default app;
