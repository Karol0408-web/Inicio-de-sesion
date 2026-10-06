import "dotenv/config";
import express from "express";
import dns from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.get("/api/validate-domain", async (req, res) => {
  const domain = String(req.query.domain || "").trim().toLowerCase();

  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    return res.status(400).json({
      exists: false,
      domain,
      reason: "invalid-domain-format"
    });
  }

  try {
    // A domain with MX records is configured to receive email.
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) {
      return res.json({ exists: true, domain, type: "MX", records: mx.length });
    }
  } catch {}

  try {
    // Fallback: the domain may exist even if it has no MX record.
    const addresses = await dns.lookup(domain);
    return res.json({ exists: true, domain, type: "A/AAAA", address: addresses.address });
  } catch {
    return res.json({ exists: false, domain, reason: "dns-not-found" });
  }
});

app.use(express.static(path.join(__dirname, "..")));

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "..", "index.html"));
  }
  next();
});

app.listen(port, () => {
  console.log(`SecureAuth server running at http://localhost:${port}`);
});