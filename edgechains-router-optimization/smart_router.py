import ctypes
import os
import sys

class EdgeChainsSmartRouter:
    def __init__(self):
        ext = ".so" if sys.platform != "win32" else ".dll"
        lib_path = os.path.join(os.path.dirname(__file__), f"librouter_core{ext}")
        self._lib = ctypes.CDLL(lib_path)
        self._lib.get_optimal_route.restype = ctypes.c_void_p
        self._lib.free_string.argtypes = [ctypes.c_void_p]

    def route_request(self, endpoint_path: str) -> str:
        ptr = self._lib.get_optimal_route(endpoint_path.encode('utf-8'))
        try:
            return ctypes.cast(ptr, ctypes.c_char_p).value.decode('utf-8')
        finally:
            self._lib.free_string(ptr)