import express, { type Express, type ErrorRequestHandler } from "express";
import cookieParser from 'cookie-parser';
import { StoreError } from './lib/supabase';
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set('trust proxy', 1);

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
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
if (!process.env.SESSION_SECRET) throw new Error('Missing SESSION_SECRET');
app.use(cookieParser(process.env.SESSION_SECRET));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim()
      || req.headers.host?.trim();
    if (req.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== host)) {
      res.status(403).json({ error: 'ORIGIN_REJECTED' }); return;
    }
  }
  next();
});

app.use("/api", router);
const storeErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof StoreError) {
    res.status(error.status).json({ error: error.code });
    return;
  }
  // Do not log raw upstream errors: they may contain customer input or auth data.
  req.log.error({ errorType: error?.name ?? 'Error' }, 'Store request failed');
  res.status(error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : 503)
    .json({ error: error?.type === 'entity.parse.failed' ? 'INVALID_INPUT' : 'STORE_UNAVAILABLE' });
};
app.use(storeErrorHandler);

export default app;
