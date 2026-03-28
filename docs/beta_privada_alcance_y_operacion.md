# Beta privada, alcance y operacion

Convertilabs esta preparado para una beta privada controlada en Uruguay. No es un self-serve abierto ni un ERP fiscal generalista.

## Alcance automatico vs asistido

- `Modo automatico`: organizaciones `UY + SA|SRL|SAS + IRAE_GENERAL + IVA GENERAL` con flujo local estandar.
- `Modo asistido`: perfiles fuera de ese perimetro, importaciones y otros casos que siguen siendo operables con revision humana.
- `Bloqueado`: falta de datos minimos, FX confiable ausente en moneda extranjera, settlement cross-currency o incompatibilidades fuertes de alcance.

Regla operativa:

- el sistema puede extraer, revisar y llegar a preview/provisional en modo asistido;
- no debe auto-finalizar casos fuera de alcance automatico;
- importaciones quedan marcadas como asistidas y pueden exigir revision manual adicional;
- la funcionalidad de DGI hoy es `Conciliacion DGI base`: comparacion manual/base por buckets, no filing directo ni conciliacion exhaustiva.

## Chequeos operativos

Liveness barato:

```bash
curl http://localhost:3000/api/health
```

Readiness real:

```bash
curl http://localhost:3000/api/ready
curl http://localhost:3000/api/health?mode=ready
```

Gate de piloto:

```bash
npm run pilot:summary -- docs/samples/rontil-pilot-demo-ready.json
npm run pilot:summary -- docs/samples/rontil-pilot-demo-blocked.json
```

Notas:

- los archivos `docs/samples/rontil-pilot-demo-*.json` son demo/sample y no sirven como evidencia productiva;
- el gate devuelve exit code `0` si pasa y no-cero si la apertura del piloto debe seguir bloqueada.
