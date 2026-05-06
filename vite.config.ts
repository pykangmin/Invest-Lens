import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));

// .env.local 의 키=값을 process.env 에 주입. db.ts 가 process.env.DATABASE_URL 을 읽기 때문에
// vite dev 가 미들웨어에서 api 핸들러를 import 하기 전에 한 번 로드해야 함.
function loadEnvLocal(): void {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// dev 모드에서 /api/<name> 요청을 api/<name>.ts 의 default export 로 라우팅.
// 프로덕션(Vercel) 에서는 동일 파일이 serverless function 으로 직접 배포되므로 이 플러그인은 dev 전용.
function apiRoutesPlugin(): Plugin {
  return {
    name: "invest-lens-api-routes",
    configureServer(server) {
      loadEnvLocal();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();

        const url = new URL(req.url, "http://localhost");
        const route = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
        if (!route || route.startsWith("_")) return next();

        const handlerFile = resolve(ROOT, "api", `${route}.ts`);
        if (!existsSync(handlerFile)) return next();

        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          query[k] = v;
        });

        const adaptedReq = { method: req.method, query };
        const adaptedRes = {
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          json(body: unknown) {
            if (!res.getHeader("Content-Type")) {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
            }
            res.end(JSON.stringify(body));
          },
          setHeader(name: string, value: string) {
            res.setHeader(name, value);
          },
        };

        try {
          // vite ssrLoadModule 호출 전 req.url 의 query 를 임시로 제거.
          // 그렇지 않으면 vite transform pipeline 이 query 를 path 에 합쳐
          // esbuild loader 가 ?symbol=DX-Y.NYB 의 .NYB 를 file extension 으로 오인.
          const moduleId = `/api/${route}.ts`;
          const savedUrl = req.url;
          req.url = moduleId;
          let mod;
          try {
            mod = await server.ssrLoadModule(moduleId);
          } finally {
            req.url = savedUrl;
          }
          const handler = mod.default as
            | ((req: typeof adaptedReq, res: typeof adaptedRes) => void | Promise<void>)
            | undefined;

          if (typeof handler !== "function") {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `api/${route}.ts has no default export.` }));
            return;
          }

          await handler(adaptedReq, adaptedRes);
        } catch (error) {
          server.config.logger.error(
            `[api] /api/${route} failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
          );
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiRoutesPlugin()],
});
