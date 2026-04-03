import { ensureInitialized, runBubblewrap, syncManifestFromEnv, twaDir } from "./_shared.mjs";

syncManifestFromEnv();
ensureInitialized();
runBubblewrap(["update"], { cwd: twaDir });
runBubblewrap(["build"], { cwd: twaDir });
