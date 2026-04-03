import { hasInitializedProject, runBubblewrap, syncManifestFromEnv, twaDir } from "./_shared.mjs";

const manifest = syncManifestFromEnv();

if (hasInitializedProject()) {
  console.log("El wrapper ya existe en /android-twa. Ejecutando update para resincronizar...");
  runBubblewrap(["update"], { cwd: twaDir });
} else {
  runBubblewrap([`init`, `--manifest=${manifest.webManifestUrl}`], { cwd: twaDir });
}
