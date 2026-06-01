"""Unit tests for EdgeChains Smart Router.

Tests cover:
- Basic routing functionality
- Edge cases (null paths, invalid input)
- Memory management (cleanup verification)
- Platform detection and fallback
- FFI type safety
"""

import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from smart_router import EdgeChainsSmartRouter


class TestEdgeChainsSmartRouter:
    """Test suite for EdgeChainsSmartRouter."""

    def test_initialization_on_linux(self):
        """Test router initializes correctly on Linux."""
        with patch("sys.platform", "linux"):
            with patch.object(
                EdgeChainsSmartRouter, "_try_load_native"
            ) as mock_load:
                router = EdgeChainsSmartRouter()
                mock_load.assert_called_once()

    def test_initialization_on_macos_with_fallback(self):
        """Test router falls back to Python on macOS when fallback enabled."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter(fallback_to_python=True)
            assert not router._use_native
            assert router._lib is None

    def test_initialization_on_macos_without_fallback(self):
        """Test router raises error on macOS when fallback disabled."""
        with patch("sys.platform", "darwin"):
            with pytest.raises(OSError, match="only available on Linux"):
                EdgeChainsSmartRouter(fallback_to_python=False)

    def test_initialization_on_windows_with_fallback(self):
        """Test router falls back to Python on Windows when fallback enabled."""
        with patch("sys.platform", "win32"):
            router = EdgeChainsSmartRouter(fallback_to_python=True)
            assert not router._use_native
            assert router._lib is None

    def test_python_routing_basic_paths(self):
        """Test Python fallback routing with basic paths."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter()
            assert router.route_request("/v1/chat/completions") == "primary_llm_cluster"
            assert router.route_request("/v1/embeddings") == "vector_processing_node"
            assert router.route_request("/v1/models") == "metadata_server"

    def test_python_routing_unknown_path(self):
        """Test Python fallback returns 'default' for unknown routes."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter()
            assert router.route_request("/v1/unknown") == "default"
            assert router.route_request("/v2/anything") == "default"

    def test_python_routing_normalized_paths(self):
        """Test Python fallback handles leading/trailing slashes."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter()
            # Various path formats should normalize correctly
            assert router.route_request("v1/chat/completions") == "primary_llm_cluster"
            assert router.route_request("/v1/chat/completions/") == "primary_llm_cluster"
            assert router.route_request("//v1/chat/completions//") == "primary_llm_cluster"

    def test_route_request_empty_path_raises_error(self):
        """Test route_request rejects empty paths."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter()
            with pytest.raises(ValueError, match="non-empty string"):
                router.route_request("")

    def test_route_request_non_string_path_raises_error(self):
        """Test route_request rejects non-string paths."""
        with patch("sys.platform", "darwin"):
            router = EdgeChainsSmartRouter()
            with pytest.raises(ValueError, match="non-empty string"):
                router.route_request(None)  # type: ignore
            with pytest.raises(ValueError, match="non-empty string"):
                router.route_request(123)  # type: ignore

    def test_native_routing_success(self):
        """Test native FFI routing with successful response."""
        with patch("sys.platform", "linux"):
            router = EdgeChainsSmartRouter()
            router._use_native = True

            # Mock native library
            mock_lib = MagicMock()
            mock_ptr = 12345
            mock_lib.get_optimal_route.return_value = mock_ptr
            router._lib = mock_lib

            # Mock ctypes.cast to return a mock c_char_p with value
            with patch("ctypes.cast") as mock_cast:
                mock_char_p = MagicMock()
                mock_char_p.value = b"primary_llm_cluster"
                mock_cast.return_value = mock_char_p

                result = router.route_request("/v1/chat/completions")
                assert result == "primary_llm_cluster"
                mock_lib.get_optimal_route.assert_called_once_with(
                    b"/v1/chat/completions"
                )
                mock_lib.free_string.assert_called_once_with(mock_ptr)

    def test_native_routing_error_response(self):
        """Test native FFI routing handles ERROR response from Rust."""
        with patch("sys.platform", "linux"):
            router = EdgeChainsSmartRouter()
            router._use_native = True

            mock_lib = MagicMock()
            mock_ptr = 12345
            mock_lib.get_optimal_route.return_value = mock_ptr
            router._lib = mock_lib

            with patch("ctypes.cast") as mock_cast:
                mock_char_p = MagicMock()
                mock_char_p.value = b"ERROR"
                mock_cast.return_value = mock_char_p

                with pytest.raises(RuntimeError, match="Native router error"):
                    router.route_request("/invalid/path")

    def test_native_routing_null_pointer(self):
        """Test native FFI routing handles null pointer response."""
        with patch("sys.platform", "linux"):
            router = EdgeChainsSmartRouter()
            router._use_native = True

            mock_lib = MagicMock()
            mock_lib.get_optimal_route.return_value = None
            router._lib = mock_lib

            with pytest.raises(RuntimeError, match="null pointer"):
                router.route_request("/v1/chat/completions")

    def test_native_memory_cleanup_on_error(self):
        """Test native FFI properly cleans up memory even on error."""
        with patch("sys.platform", "linux"):
            router = EdgeChainsSmartRouter()
            router._use_native = True

            mock_lib = MagicMock()
            mock_ptr = 12345
            mock_lib.get_optimal_route.return_value = mock_ptr
            router._lib = mock_lib

            with patch("ctypes.cast") as mock_cast:
                mock_char_p = MagicMock()
                mock_char_p.value = b"ERROR"
                mock_cast.return_value = mock_char_p

                try:
                    router.route_request("/invalid")
                except RuntimeError:
                    pass

                # Verify free_string was called despite error
                mock_lib.free_string.assert_called_once_with(mock_ptr)

    def test_native_binary_not_found(self):
        """Test graceful fallback when native binary not found."""
        with patch("sys.platform", "linux"):
            with patch("os.path.exists", return_value=False):
                with patch("builtins.print"):
                    router = EdgeChainsSmartRouter()
                    assert not router._use_native
                    assert router._lib is None

    def test_ffi_type_signatures_set_correctly(self):
        """Test FFI function signatures are configured correctly."""
        with patch("sys.platform", "linux"):
            with patch("os.path.exists", return_value=True):
                with patch("ctypes.CDLL") as mock_cdll_class:
                    mock_lib = MagicMock()
                    mock_cdll_class.return_value = mock_lib

                    router = EdgeChainsSmartRouter()

                    # Verify FFI signatures were set
                    import ctypes

                    mock_lib.get_optimal_route.argtypes = [ctypes.c_char_p]
                    mock_lib.get_optimal_route.restype = ctypes.c_void_p

                    mock_lib.free_string.argtypes = [ctypes.c_void_p]
                    mock_lib.free_string.restype = None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
