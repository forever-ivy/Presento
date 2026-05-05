import { config as loadDotenv } from "dotenv";

let loaded = false;

export function loadPresentoEnv() {
  if (loaded) return;
  loadDotenv({ path: ".env", quiet: true });
  loadDotenv({ path: ".env.local", override: true, quiet: true });
  loaded = true;
}
