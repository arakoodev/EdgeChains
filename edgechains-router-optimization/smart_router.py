"""EdgeChains Smart Router with FFI-accelerated native Rust kernel.

This module provides high-performance request routing by delegating to a compiled
Rust kernel via ctypes FFI bindings. It includes automatic fallback to pure Python
routing on unsupported platforms.

Example:
    >>> router = EdgeChainsSmartRouter()
    >>> destination = router.route_request("/v1/chat/completions")
    >>> print(destination)  # Output: "primary_llm_cluster"

Platform Support:
    - Linux (x86_64, ARM64): Native FFI acceleration via librouter_core.so
    - macOS: Pure Python fallback routing
    - Windows: Pure Python fallback routing

Memory Management:
    The router automatically manages memory allocated by the native Rust kernel.
    No manual cleanup is required.
"""

import ctypes
import os
import sys
from typing import Optional


class EdgeChainsSmartRouter:
    """Smart request router with optional native FFI acceleration.

    Attributes:
        _lib: Loaded ctypes CDLL instance (None if using Python fallback)
        _use_native: Boolean indicating whether native routing is active
        _route_map: Static route mapping for Python fallback
    """

    def __init__(self, fallback_to_python: bool = True):
        """Initialize the router with native or Python backend.

        Args:
            fallback_to_python: If True (default), use Python fallback on unsupported
                              platforms. If False, raise OSError on non-Linux.

        Raises:
            OSError: If native binary not found on Linux or fallback disabled on
                    unsupported platform.
        """
        self._lib: Optional[ctypes.CDLL] = None
        self._use_native = False

        # Static route mapping for Python fallback
        self._route_map = {
            "v1/chat/completions": "primary_llm_cluster",
            "v1/embeddings": "vector_processing_node",
            "v1/models": "metadata_server",
        }

        # Attempt native loading on Linux
        if sys.platform.startswith("linux"):
            self._try_load_native()
        elif not fallback_to_python:
            raise OSError(
                f"Native FFI router is only available on Linux. "
                f"Current platform: {sys.platform}. "
                f"Set fallback_to_python=True to use pure Python routing."
            )
        else:
            print(
                f"[EdgeChains] Native router unavailable on {sys.platform}. "
                f"Falling back to pure Python routing."
            )

    def _try_load_native(self) -> None:
        """Attempt to load native Rust router library.

        Sets _use_native to True on success, falls back to Python on failure.
        """
        try:
            lib_name = "librouter_core.so"
            lib_path = os.path.join(os.path.dirname(__file__), lib_name)

            if not os.path.exists(lib_path):
                raise OSError(
                    f"Native routing binary not found at {lib_path}. "
                    f"Ensure librouter_core.so is present or rebuild from source."
                )

            # Load native library
            self._lib = ctypes.CDLL(lib_path)

            # Configure FFI function signatures to prevent 64-bit pointer truncation
            self._lib.get_optimal_route.argtypes = [ctypes.c_char_p]
            self._lib.get_optimal_route.restype = ctypes.c_void_p

            self._lib.free_string.argtypes = [ctypes.c_void_p]
            self._lib.free_string.restype = None

            self._use_native = True
            print("[EdgeChains] Native Rust router loaded successfully.")

        except (OSError, AttributeError) as e:
            print(
                f"[EdgeChains] Failed to load native router: {e}. "
                f"Falling back to pure Python routing."
            )
            self._lib = None
            self._use_native = False

    def route_request(self, endpoint_path: str) -> str:
        """Route a request to the appropriate cluster/destination.

        Args:
            endpoint_path: Request endpoint path (e.g., "/v1/chat/completions")

        Returns:
            Destination cluster name (e.g., "primary_llm_cluster")

        Raises:
            ValueError: If endpoint_path is empty or invalid
            RuntimeError: If native FFI call fails unexpectedly
        """
        if not endpoint_path or not isinstance(endpoint_path, str):
            raise ValueError(
                f"endpoint_path must be a non-empty string, got: {endpoint_path!r}"
            )

        if self._use_native:
            return self._route_native(endpoint_path)
        else:
            return self._route_python(endpoint_path)

    def _route_native(self, endpoint_path: str) -> str:
        """Route using native Rust FFI kernel.

        Args:
            endpoint_path: Request endpoint path

        Returns:
            Destination cluster name

        Raises:
            RuntimeError: If FFI call returns ERROR or unexpected value
        """
        ptr = None
        try:
            # Call native Rust function with UTF-8 encoded path
            ptr = self._lib.get_optimal_route(endpoint_path.encode("utf-8"))

            if not ptr:
                raise RuntimeError("Native router returned null pointer")

            # Convert pointer to Python string
            result = ctypes.cast(ptr, ctypes.c_char_p).value

            if result is None:
                raise RuntimeError("Failed to decode native router response")

            route = result.decode("utf-8")

            # Check for error responses from native code
            if route == "ERROR":
                raise RuntimeError(
                    f"Native router error for path: {endpoint_path}"
                )

            return route

        except Exception as e:
            raise RuntimeError(f"Native FFI call failed: {e}") from e

        finally:
            # Always clean up native memory
            if ptr and self._lib:
                try:
                    self._lib.free_string(ptr)
                except Exception as cleanup_error:
                    print(
                        f"[EdgeChains] Warning: Memory cleanup failed: {cleanup_error}"
                    )

    def _route_python(self, endpoint_path: str) -> str:
        """Route using pure Python fallback.

        Args:
            endpoint_path: Request endpoint path

        Returns:
            Destination cluster name ("default" if not found)
        """
        # Normalize path by removing leading/trailing slashes
        normalized = endpoint_path.strip("/")

        # Look up in static route map
        return self._route_map.get(normalized, "default")

    def __del__(self) -> None:
        """Cleanup: Ensure native library is properly unloaded."""
        if self._lib is not None:
            try:
                # Explicitly unload the library
                if hasattr(ctypes, "CDLL"):
                    # ctypes doesn't provide direct unload, but we can release reference
                    self._lib = None
            except Exception as e:
                print(f"[EdgeChains] Warning: Native library cleanup failed: {e}")
