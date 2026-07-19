import { ENV } from "./env";

type RequestLike = {
  params?: Record<string, string>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  send: (body: string) => void;
  set: (name: string, value: string) => void;
  redirect: (status: number, path: string) => void;
};

type AppLike = {
  get: (path: string, handler: (req: RequestLike, res: ResponseLike) => Promise<void>) => void;
};

export function registerStorageProxy(app: AppLike) {
  const handler = async (req: RequestLike, res: ResponseLike) => {
    const key = req.params?.[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  };

  app.get("/manus-storage/*", handler);
  app.get("/api/manus-storage/*", handler);
}
