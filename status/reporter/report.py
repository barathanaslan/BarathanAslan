#!/usr/bin/env python3
"""Post a summary of `tailmon json` to the status Worker.

Runs on the Mac mini every two minutes (launchd, see install.sh). Only the
fields listed in summarise() leave this machine: no IP addresses, process
lists, disks or network counters, and only the three hosts in HOSTS.

The bearer token lives in ~/.config/barathan98-status/token (mode 600).
"""

import json
import math
import os
import subprocess
import sys
import urllib.request

HOSTS = ("barathans-mini", "barathans-5090", "barathans-macbook")
ENDPOINT = "https://status.barathanaslan.com/v1/report"
TOKEN_FILE = os.path.expanduser("~/.config/barathan98-status/token")
TAILMON = os.path.expanduser("~/bin/tailmon")
LOG_FILE = os.path.expanduser("~/Library/Logs/barathan98-status.log")
LOG_LIMIT = 1024 * 1024


def number(value):
    return value if isinstance(value, (int, float)) else None


def summarise(doc):
    hosts = []
    for entry in doc.get("hosts", []):
        if entry.get("host") not in HOSTS:
            continue
        stats = entry.get("stats") or {}
        cpu = stats.get("cpu") or {}
        mem = stats.get("mem") or {}
        gpus = stats.get("gpu") or []
        gpu = gpus[0] if gpus else {}
        total_mb = number(mem.get("total_mb"))
        used_mb = number(mem.get("used_mb"))
        vram_mb = number(gpu.get("vram_total_mb"))
        uptime = number(stats.get("uptime_sec"))
        hosts.append({
            "id": entry["host"],
            "status": entry.get("status"),
            "os": entry.get("os"),
            "cpu_pct": number(cpu.get("percent")),
            "cpu_cores": number(cpu.get("cores")),
            "mem_pct": round(100 * used_mb / total_mb) if total_mb and used_mb is not None else None,
            "mem_total_gb": math.ceil(total_mb / 1024) if total_mb else None,
            "gpu_name": gpu.get("name"),
            "gpu_pct": number(gpu.get("util_pct")),
            "vram_total_gb": round(vram_mb / 1024) if vram_mb else None,
            "uptime_h": int(uptime // 3600) if uptime is not None else None,
        })
    return {"hosts": hosts}


def main():
    with open(TOKEN_FILE) as f:
        token = f.read().strip()
    raw = subprocess.run([TAILMON, "json"], capture_output=True, text=True, timeout=45, check=True).stdout
    body = json.dumps(summarise(json.loads(raw))).encode()
    request = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "barathan98-status-reporter",
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        response.read()


if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        out = subprocess.run([TAILMON, "json"], capture_output=True, text=True, timeout=45, check=True).stdout
        print(json.dumps(summarise(json.loads(out)), indent=2))
        sys.exit(0)
    try:
        main()
    except Exception as exc:  # launchd keeps the log; one line per failure
        try:
            if os.path.getsize(LOG_FILE) > LOG_LIMIT:
                open(LOG_FILE, "w").close()
        except OSError:
            pass
        print(f"report failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
