# Android TWA Wrapper

Este directorio versiona la configuracion del wrapper Android para `Convertilabs Campo` y deja el proyecto Bubblewrap reproducible sin sacar la implementacion del repo principal.

## Variables esperadas

- `TWA_ANDROID_PACKAGE_NAME`: package name Android. Ejemplo `com.convertilabs.campo`.
- `TWA_PRODUCTION_URL`: origin productivo que sirve el PWA. Ejemplo `https://convertilabs.com`.
- `TWA_START_URL`: ruta inicial dentro del PWA. Default `/mobile`.
- `TWA_APP_NAME`: nombre completo de la app.
- `TWA_LAUNCHER_NAME`: nombre visible en Android launcher.
- `TWA_SHORT_NAME`: nombre corto.
- `TWA_APP_VERSION`: versionName Android.
- `TWA_APP_VERSION_CODE`: versionCode Android.
- `TWA_KEYSTORE_PATH`: ruta del keystore local.
- `TWA_KEY_ALIAS`: alias de la key.
- `TWA_KEYSTORE_PASSWORD`: password del keystore. No se versiona.
- `TWA_KEY_PASSWORD`: password de la key. No se versiona.
- `TWA_SHA256_FINGERPRINTS`: fingerprints SHA-256 separados por coma o salto de linea.

## Comandos

- `npm run twa:doctor`: revisa dependencias locales de Bubblewrap, JDK y Android SDK.
- `npm run twa:validate`: valida `android-twa/twa-manifest.json`, iconos y configuracion base.
- `npm run twa:init`: inicializa o resincroniza el wrapper Bubblewrap dentro de `/android-twa`.
- `npm run twa:update`: reaplica cambios de `twa-manifest.json` al proyecto Android generado.
- `npm run twa:build`: ejecuta `update` y luego build Android.
- `npm run twa:install`: instala el APK generado en un dispositivo conectado via `adb`.

## Build local

1. Configura Node.js 20+, JDK 17+ y Android SDK command-line tools.
2. Exporta variables `TWA_*` segun el entorno.
3. Corre `npm run twa:doctor`.
4. Corre `npm run twa:validate`.
5. Corre `npm run twa:init`.
6. Corre `npm run twa:build`.

## Internal testing

1. Verifica que `/.well-known/assetlinks.json` entregue el package y fingerprints correctos.
2. Genera artefactos con `npm run twa:build`.
3. Sube el `.aab` a Google Play Console en el track `Internal testing`.
4. Agrega testers internos.
5. Instala la build y valida que abra `/mobile` en modo fullscreen sin barra del navegador.

## Artefactos esperados

- Bubblewrap suele exponer `app-release-signed.apk`.
- Gradle tambien deja artefactos bajo `android-twa/app/build/outputs/`.
- Para Play Console, el artefacto preferido suele ser `app-release-bundle.aab` si el entorno genero bundle.

## Actualizar el wrapper

1. Ajusta `android-twa/twa-manifest.json` o las variables `TWA_*`.
2. Si cambias el web manifest o iconos del PWA, corre `npm run twa:update`.
3. Si cambias package, firma o origin, actualiza tambien `TWA_SHA256_FINGERPRINTS` y prueba `/.well-known/assetlinks.json`.
4. Vuelve a correr `npm run twa:build`.

## Notas

- No versionar keystores ni secretos.
- Si `assetlinks.json` no matchea firma y package, Android abrira la experiencia como Custom Tab con barra del navegador.
