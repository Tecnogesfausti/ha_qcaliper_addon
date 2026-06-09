# API de calibracion H2O para app externa

Resumen operativo usado por la app local.

## Configuracion

```bash
HA_URL=http://192.168.1.130:8123
HA_TOKEN=token_largo_de_home_assistant
```

Todas las llamadas llevan `Authorization: Bearer HA_TOKEN` y `Content-Type: application/json`.

## Entidades principales para calibracion

La app calcula deltas de pulsos con sensores de sesion, no con acumulados grandes:

```text
sensor.controlh2oficina_pulsos_sesion_caudalimetro
sensor.controlh2oficina_pulsos_sesion_pulsometro
```

Tambien guarda acumulados brutos como trazabilidad:

```text
sensor.controlh2oficina_pulsos_caudalimetro
sensor.controlh2oficina_pulsos_pulsometro
```

Litros calculados por ESPHome:

```text
sensor.controlh2oficina_sensor_litros_acumulados_caudalimetro
sensor.controlh2oficina_sensor_litros_acumulados_pulsometro
```

Factores actuales:

```text
sensor.controlh2oficina_pulsos_calculados_por_litro_caudalimetro
sensor.controlh2oficina_pulsos_calculados_por_litro_pulsometro
```

## Servicios

Activar rele temporizado:

```http
POST /api/services/script/riego_rele_temporizado
```

Parada de emergencia:

```http
POST /api/services/script/riego_apagar_reles_api
```

Guardar lectura real:

```http
POST /api/services/input_number/set_value
```

## Calculos

```text
delta_pulsos = final.pulsos_sesion - inicio.pulsos_sesion
delta_litros_ha = final.litros_ha - inicio.litros_ha
delta_litros_real = lectura_real_final - lectura_real_inicial
pulsos_por_litro_real = delta_pulsos / delta_litros_real
litros_por_pulso_real = delta_litros_real / delta_pulsos
caudal_l_min_real = delta_litros_real / (segundos / 60)
factor_correccion = delta_litros_real / delta_litros_ha
error_ha_pct = ((delta_litros_ha - delta_litros_real) / delta_litros_real) * 100
```
