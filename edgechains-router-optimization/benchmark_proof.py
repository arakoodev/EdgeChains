
import time, concurrent.futures
from smart_router import EdgeChainsSmartRouter
import os
import sys

def _run_route_request(endpoint_path: str) -> str:
    """Helper function to instantiate router per process and route request."""
    router = EdgeChainsSmartRouter()
    return router.route_request(endpoint_path)

def test():
    start = time.perf_counter()
    with concurrent.futures.ProcessPoolExecutor(max_workers=50) as e:
        list(e.map(_run_route_request, ["v1/chat/completions"] * 50000))
    return time.perf_counter() - start

try:
    ffi_time = test()
    with open("benchmark_log.txt", "w") as f:
        f.write(f"PROCESSED 50,000 REQUESTS VIA NATIVE RUST FFI BRIDGE\n")
        f.write(f"EXECUTION TIME: {ffi_time:.4f} SECONDS\n")
        print("Benchmark complete.")
except Exception as e:
    print(f"Error in benchmark_proof.py: {e}", file=sys.stderr)
    sys.exit(1)
