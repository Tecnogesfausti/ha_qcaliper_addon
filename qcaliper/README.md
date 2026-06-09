# Calibre Riego

## Add-on de Home Assistant

Cada cambio relevante debe ir acompañado de un bump de version en `qcaliper/config.yaml`.

Este repositorio ya se puede empaquetar como add-on para Home Assistant.

- Ingress habilitado en el puerto 6666.
- Persistencia de pruebas en `/data/resultados`.
- Acceso a Home Assistant con `SUPERVISOR_TOKEN` y `http://supervisor/core` por defecto.

Instalacion en HA:

1. Añade este repositorio como repositorio de add-ons.
2. Instala `QCaliper`.
3. Arranca el add-on y abre su panel desde Home Assistant.

App movil/web para calibrar sensores de caudal conectados a Home Assistant.

La app se conecta por REST API a Home Assistant usando un token de larga duracion,
lanza un rele temporizado, lee las muestras de pulsos/litros al inicio y al final,
y calcula el nuevo factor de calibracion.

## Uso rapido

Abre `index.html` en un navegador moderno o sirve esta carpeta con cualquier servidor
estatico.

Configura:

- URL de Home Assistant, por ejemplo `http://192.168.1.130:8123`
- Token de larga duracion
- Sensor a calibrar: caudalimetro, pulsometro o ambos
- Rele y duracion
- Lectura real inicial y final del contador externo

En esta version local el token esta preconfigurado en `index.html` como campo oculto para no pedirlo desde el movil. No publiques esta carpeta fuera de una red controlada. La URL puede editarse y guardarse en `localStorage`.

## Seguridad

- El rele se activa siempre mediante `script.riego_rele_temporizado`.
- Home Assistant limita la duracion entre 1 y 1800 segundos.
- La app incluye boton de parada de emergencia, que llama a
  `script.riego_apagar_reles_api`.
- Si un sensor devuelve `unknown`, `unavailable`, vacio o no numerico, la prueba se
  aborta.

## Siguiente paso APK

Cuando la version web este validada, se puede envolver con Capacitor:

```bash
npm create vite@latest calibreriego -- --template vanilla
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init CalibreRiego com.local.calibreriego
npx cap add android
npx cap sync android
```

La logica actual esta escrita en JavaScript estandar para que pueda moverse a Vite
sin cambios grandes.

## Notas ESPHome

Primeras referencias vistas en `controlh2oficina`:

- Caudalimetro/contador: `litros_por_pulso = 0.085515013`, equivalente a `11.693852` pulsos/L aproximadamente.
- Pulsometro FS300A: factor inicial publicado `350` pulsos/L, afinado por ecuacion polinomica segun el caudal instantaneo.

La app lee tambien los sensores `pulsos_calculados_por_litro_*` y muestra el factor actual frente al nuevo `pulsos_por_litro` calculado con la lectura real.

## Logger de pruebas

La app guarda cada prueba como un registro completo con:

- perfil de caudal: goteros, estandar, difusores o manual
- rele, duracion, margen final e intervalo de muestreo
- lectura real inicial y final
- muestras periodicas durante la prueba en `samples[]`
- resultado calculado para caudalimetro y pulsometro

Perfiles iniciales:

- Goteros bajo caudal: 900 s, margen 8 s, muestra cada 10 s.
- Riego estandar: 180 s, margen 5 s, muestra cada 5 s.
- Fregadero 5-7 L: 90 s, margen 5 s, muestra cada 2 s.
- Cisterna 5-7 L: 75 s, margen 8 s, muestra cada 2 s.
- Lavadora caudal medio: 180 s, margen 10 s, muestra cada 5 s.
- Difusores alto caudal: 60 s, margen 3 s, muestra cada 2 s.

Para goteros interesa una prueba larga porque pocos litros y pocos pulsos amplifican el error de lectura. Para difusores conviene muestreo mas frecuente porque el caudal cambia mas rapido y se acumula volumen suficiente en menos tiempo.

Exporta JSON para analisis completo y CSV para revisar series temporales en hoja de calculo.

## Pulsos de sesion

La calibracion usa `sensor.controlh2oficina_pulsos_sesion_*` para calcular deltas. Los pulsos acumulados grandes se guardan solo como referencia en las muestras. Esto evita restar valores enormes y deja el JSON mas claro para ajustar ecuaciones despues.

La app marca una prueba como sospechosa si no alcanza referencias iniciales de calidad: 5 L reales, 120 s, 20 pulsos en caudalimetro o 500 pulsos en pulsometro, o si el error absoluto supera el 25%.

## Final sin pulsos

Los perfiles de fregadero, cisterna y lavadora usan la duracion como maximo de seguridad. Si la app detecta pulsos y despues pasan varios segundos sin nuevos pulsos, toma la muestra final automaticamente y queda esperando la lectura real final del contador. Para riego por relé, este comportamiento puede desactivarse con `Final sin pulsos = No`.
