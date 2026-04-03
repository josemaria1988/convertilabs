import { ensureInitialized, runBubblewrap, syncManifestFromEnv, twaDir } from "./_shared.mjs";

syncManifestFromEnv();
ensureInitialized();
runBubblewrap(["install"], { cwd: twaDir });
