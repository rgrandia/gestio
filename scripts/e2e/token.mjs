// JWT HS256 amb un rol (anon o service_role) per a l'entorn de proves.
import crypto from "node:crypto";

const secret = process.env.JWT_SECRET;
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b({ alg: "HS256", typ: "JWT" });
const p = b({ role: process.argv[2], iss: "supabase", iat: 1700000000, exp: 2000000000 });
console.log(`${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`);
