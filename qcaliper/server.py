#!/usr/bin/env python3
import json
import os
import time
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HA_URL = os.environ.get("HA_URL", "http://supervisor/core").rstrip("/")
HA_TOKEN = os.environ.get("HA_TOKEN") or os.environ.get("SUPERVISOR_TOKEN", "")
PORT = int(os.environ.get("PORT", "8080"))
RESULTS_DIR = Path(os.environ.get("RESULTS_DIR", "/data/resultados"))

RELAYS = [
    "switch.riego_rele1",
    "switch.riego_rele2",
    "switch.riego_rele3",
    "switch.riego_rele4",
    "switch.riego_rele5",
    "switch.riego_rele6",
    "switch.riego_rele7",
    "switch.riego_rele8",
    "switch.riego2_rele1",
    "switch.riego2_rele2",
    "switch.riego2_rele3",
    "switch.riego2_rele4",
    "switch.riego2_rele5",
    "switch.riego2_rele6",
    "switch.riego2_rele7",
    "switch.riego2_rele8",
]

relay_timers = {}

ENTITIES = {
    "pulsos_caudalimetro": "sensor.controlh2oficina_pulsos_caudalimetro",
    "pulsos_pulsometro": "sensor.controlh2oficina_pulsos_pulsometro",
    "litros_caudalimetro": "sensor.controlh2oficina_sensor_litros_acumulados_caudalimetro",
    "litros_pulsometro": "sensor.controlh2oficina_sensor_litros_acumulados_pulsometro",
    "factor_caudalimetro": "sensor.controlh2oficina_pulsos_calculados_por_litro_caudalimetro",
    "factor_pulsometro": "sensor.controlh2oficina_pulsos_calculados_por_litro_pulsometro",
    "temporal_caudalimetro": "sensor.controlh2oficina_acumulado_temporal_caudalimetro",
    "temporal_pulsometro": "sensor.controlh2oficina_acumulado_temporal_pulsometro",
}




def call_ha_service(domain, service, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{HA_URL}/api/services/{domain}/{service}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {HA_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        text = response.read().decode("utf-8")
        return json.loads(text) if text else []


def switch_turn_off(entity_id):
    try:
        call_ha_service("switch", "turn_off", {"entity_id": entity_id})
    finally:
        relay_timers.pop(entity_id, None)


def switch_turn_on_for(entity_id, seconds):
    if entity_id not in RELAYS:
        raise ValueError(f"Rele no permitido: {entity_id}")
    if not (1 <= seconds <= 1800):
        raise ValueError("Duracion fuera de rango 1-1800")

    old_timer = relay_timers.pop(entity_id, None)
    if old_timer:
        old_timer.cancel()

    call_ha_service("switch", "turn_on", {"entity_id": entity_id})
    timer = threading.Timer(seconds, switch_turn_off, args=(entity_id,))
    timer.daemon = True
    relay_timers[entity_id] = timer
    timer.start()


def stop_all_relays():
    for timer in list(relay_timers.values()):
        timer.cancel()
    relay_timers.clear()
    call_ha_service("switch", "turn_off", {"entity_id": RELAYS})


def read_entity(entity_id):
    url = f"{HA_URL}/api/states/{urllib.parse.quote(entity_id, safe='')}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {HA_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        if self.path.startswith("/api/ha/"):
            self.proxy_home_assistant("GET")
            return
        if self.path.startswith("/api/raw-pulses"):
            self.send_raw_pulses()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/timed-relay":
            self.handle_timed_relay()
            return
        if self.path == "/api/stop-relays":
            self.handle_stop_relays()
            return
        if self.path == "/api/save-trial":
            self.handle_save_trial()
            return
        if self.path == "/api/save-history":
            self.handle_save_history()
            return
        if self.path == "/api/trials":
            self.handle_list_trials()
            return
        if self.path.startswith("/api/ha/"):
            self.proxy_home_assistant("POST")
            return
        self.send_error(404, "Not found")

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        return json.loads(body.decode("utf-8") or "{}")

    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_timed_relay(self):
        try:
            payload = self.read_json_body()
            relay = payload.get("rele")
            seconds = int(payload.get("segundos", 0))
            switch_turn_on_for(relay, seconds)
            self.send_json(200, {"ok": True, "rele": relay, "segundos": seconds})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})

    def handle_stop_relays(self):
        try:
            stop_all_relays()
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})



    def handle_save_history(self):
        try:
            history = self.read_json_body()
            history_id = str(history.get("id") or int(time.time() * 1000))
            safe_id = "".join(ch for ch in history_id if ch.isalnum() or ch in "-_")[:80] or str(int(time.time() * 1000))
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)

            history["server_saved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            history["server_file"] = f"history-{safe_id}.json"

            history_path = RESULTS_DIR / f"history-{safe_id}.json"
            history_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")

            with (RESULTS_DIR / "history.jsonl").open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(history, ensure_ascii=False, separators=(",", ":")) + "
")

            self.send_json(200, {"ok": True, "id": history_id, "path": str(history_path)})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})

    def handle_list_trials(self):
        try:
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)
            trials = []
            jsonl = RESULTS_DIR / "trials.jsonl"
            if jsonl.exists():
                for line in jsonl.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        trials.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            self.send_json(200, {"ok": True, "trials": trials})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})

    def handle_save_trial(self):
        try:
            trial = self.read_json_body()
            trial_id = str(trial.get("id") or int(time.time() * 1000))
            safe_id = "".join(ch for ch in trial_id if ch.isalnum() or ch in "-_")[:80] or str(int(time.time() * 1000))
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)

            trial["server_saved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            trial["server_file"] = f"{safe_id}.json"

            trial_path = RESULTS_DIR / f"{safe_id}.json"
            trial_path.write_text(json.dumps(trial, ensure_ascii=False, indent=2), encoding="utf-8")

            with (RESULTS_DIR / "trials.jsonl").open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(trial, ensure_ascii=False, separators=(",", ":")) + "\n")

            self.send_json(200, {"ok": True, "id": trial_id, "path": str(trial_path)})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})

    def proxy_home_assistant(self, method):
        target_path = self.path[len("/api/ha"):]
        body = None
        if method == "POST":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b"{}"

        request = urllib.request.Request(
            f"{HA_URL}{target_path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {HA_TOKEN}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                data = response.read()
                status = response.status
                content_type = response.headers.get("Content-Type", "application/json")
                print(f"[qcaliper] proxy {method} {target_path} -> {status}")
        except urllib.error.HTTPError as exc:
            data = exc.read() or json.dumps({"error": str(exc)}).encode("utf-8")
            status = exc.code
            content_type = exc.headers.get("Content-Type", "application/json")
            print(f"[qcaliper] proxy {method} {target_path} -> {status} HTTPError")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            data = json.dumps({"error": str(exc)}).encode("utf-8")
            status = 502
            content_type = "application/json"
            print(f"[qcaliper] proxy {method} {target_path} -> 502 {exc}")

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_raw_pulses(self):
        values = {}
        errors = []
        started = time.time()

        for key, entity_id in ENTITIES.items():
            try:
                state = read_entity(entity_id)
                values[key] = {
                    "entity_id": entity_id,
                    "state": state.get("state"),
                    "value": parse_number(state.get("state")),
                    "last_changed": state.get("last_changed"),
                    "last_updated": state.get("last_updated"),
                    "friendly_name": state.get("attributes", {}).get("friendly_name"),
                }
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
                errors.append({"entity_id": entity_id, "error": str(exc)})

        body = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "duration_ms": round((time.time() - started) * 1000, 1),
            "ha_url": HA_URL,
            "values": values,
            "errors": errors,
        }
        data = json.dumps(body).encode("utf-8")
        self.send_response(200 if not errors else 502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Calibre Riego monitor: http://0.0.0.0:{PORT}/monitor.html")
    print(f"Home Assistant: {HA_URL}")
    server.serve_forever()
