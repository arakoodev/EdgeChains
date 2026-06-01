"""Comprehensive unit tests for EdgeChains Smart Router.

Tests cover:
- Platform detection (Linux, macOS, Windows)
- Native FFI routing (success, errors, null pointers)
- Python fallback routing
- Memory management and cleanup
- Edge cases and error handling
"""

import os
import sys
import unittest
from unittest import mock
from typing import Any

# Mock the native library before importing the router
try:
    from edgechains_router_optimization.smart_router import EdgeChainsSmartRouter
except ImportError:
    # Adjust import path based on test execution context
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from smart_router import EdgeChainsSmartRouter


class TestEdgeChainsSmartRouterPlatform(unittest.TestCase):
    """Test platform detection and initialization."""

    @mock.patch('sys.platform', 'linux')
    def test_linux_platform_initialization(self):
        """Test router initializes on Linux."""
        with mock.patch.object(
            EdgeChainsSmartRouter, '_try_load_native'
        ) as mock_load:
            router = EdgeChainsSmartRouter(fallback_to_python=True)
            mock_load.assert_called_once()

    @mock.patch('sys.platform', 'darwin')  # macOS
    def test_macos_platform_fallback(self, *args):
        """Test router falls back to Python on macOS."""
        router = EdgeChainsSmartRouter(fallback_to_python=True)
        self.assertFalse(router._use_native)

    @mock.patch('sys.platform', 'darwin')
    def test_macos_platform_no_fallback_raises(self, *args):
        """Test router raises OSError on macOS when fallback disabled."""
        with self.assertRaises(OSError) as context:
            EdgeChainsSmartRouter(fallback_to_python=False)
        self.assertIn('Linux', str(context.exception))

    @mock.patch('sys.platform', 'win32')  # Windows
    def test_windows_platform_fallback(self, *args):
        """Test router falls back to Python on Windows."""
        router = EdgeChainsSmartRouter(fallback_to_python=True)
        self.assertFalse(router._use_native)


class TestEdgeChainsSmartRouterPythonFallback(unittest.TestCase):
    """Test pure Python fallback routing."""

    def setUp(self):
        """Initialize router in Python-only mode."""
        with mock.patch('sys.platform', 'darwin'):
            self.router = EdgeChainsSmartRouter(fallback_to_python=True)

    def test_route_request_basic(self):
        """Test basic routing with known path."""
        result = self.router.route_request("/v1/chat/completions")
        self.assertEqual(result, "primary_llm_cluster")

    def test_route_request_unknown_path(self):
        """Test routing with unknown path returns default."""
        result = self.router.route_request("/unknown/path")
        self.assertEqual(result, "default")

    def test_route_request_with_leading_slash(self):
        """Test path normalization handles leading slash."""
        result = self.router.route_request("/v1/embeddings")
        self.assertEqual(result, "vector_processing_node")

    def test_route_request_without_leading_slash(self):
        """Test path normalization handles missing leading slash."""
        result = self.router.route_request("v1/embeddings")
        self.assertEqual(result, "vector_processing_node")

    def test_route_request_with_trailing_slash(self):
        """Test path normalization handles trailing slash."""
        result = self.router.route_request("/v1/models/")
        self.assertEqual(result, "metadata_server")

    def test_route_request_empty_path_raises(self):
        """Test empty path raises ValueError."""
        with self.assertRaises(ValueError):
            self.router.route_request("")

    def test_route_request_none_path_raises(self):
        """Test None path raises ValueError."""
        with self.assertRaises(ValueError):
            self.router.route_request(None)

    def test_route_request_non_string_path_raises(self):
        """Test non-string path raises ValueError."""
        with self.assertRaises(ValueError):
            self.router.route_request(123)


class TestEdgeChainsSmartRouterNativeMock(unittest.TestCase):
    """Test native FFI routing with mocked library."""

    def setUp(self):
        """Initialize router with mocked native library."""
        with mock.patch('sys.platform', 'linux'):
            with mock.patch('os.path.exists', return_value=True):
                with mock.patch('ctypes.CDLL'):
                    self.router = EdgeChainsSmartRouter(fallback_to_python=True)
                    self.router._use_native = True
                    self.router._lib = mock.MagicMock()

    def test_route_native_success(self):
        """Test successful native routing."""
        # Mock native library response
        mock_ptr = mock.MagicMock()
        self.router._lib.get_optimal_route.return_value = mock_ptr
        self.router._lib.free_string.return_value = None

        # Mock the ctypes.cast
        with mock.patch('ctypes.cast') as mock_cast:
            mock_result = mock.MagicMock()
            mock_result.value = b'primary_llm_cluster'
            mock_cast.return_value = mock_result

            result = self.router.route_request("/v1/chat/completions")
            self.assertEqual(result, "primary_llm_cluster")

    def test_route_native_null_pointer_raises(self):
        """Test native routing with null pointer raises RuntimeError."""
        # Mock native library returning null
        self.router._lib.get_optimal_route.return_value = None

        with self.assertRaises(RuntimeError) as context:
            self.router.route_request("/v1/chat/completions")
        self.assertIn('null pointer', str(context.exception))

    def test_route_native_error_response_raises(self):
        """Test native routing with ERROR response raises RuntimeError."""
        # Mock native library response with ERROR
        mock_ptr = mock.MagicMock()
        self.router._lib.get_optimal_route.return_value = mock_ptr

        with mock.patch('ctypes.cast') as mock_cast:
            mock_result = mock.MagicMock()
            mock_result.value = b'ERROR'
            mock_cast.return_value = mock_result

            with self.assertRaises(RuntimeError) as context:
                self.router.route_request("/v1/chat/completions")
            self.assertIn('error', str(context.exception).lower())

    def test_route_native_memory_cleanup(self):
        """Test native routing cleans up memory on success."""
        mock_ptr = mock.MagicMock()
        self.router._lib.get_optimal_route.return_value = mock_ptr
        self.router._lib.free_string.return_value = None

        with mock.patch('ctypes.cast') as mock_cast:
            mock_result = mock.MagicMock()
            mock_result.value = b'primary_llm_cluster'
            mock_cast.return_value = mock_result

            self.router.route_request("/v1/chat/completions")
            self.router._lib.free_string.assert_called_once_with(mock_ptr)

    def test_route_native_memory_cleanup_on_error(self):
        """Test native routing cleans up memory even on error."""
        mock_ptr = mock.MagicMock()
        self.router._lib.get_optimal_route.return_value = mock_ptr
        self.router._lib.free_string.return_value = None

        with mock.patch('ctypes.cast') as mock_cast:
            mock_result = mock.MagicMock()
            mock_result.value = b'ERROR'
            mock_cast.return_value = mock_result

            with self.assertRaises(RuntimeError):
                self.router.route_request("/v1/chat/completions")
            self.router._lib.free_string.assert_called_once_with(mock_ptr)


class TestEdgeChainsSmartRouterMemoryManagement(unittest.TestCase):
    """Test memory management and cleanup."""

    def test_finalizer_called_on_deletion(self):
        """Test __del__ is called on router deletion."""
        with mock.patch('sys.platform', 'darwin'):
            router = EdgeChainsSmartRouter(fallback_to_python=True)
            router._lib = mock.MagicMock()

            # Manually call __del__
            router.__del__()
            # Should not raise any exception

    def test_finalizer_handles_errors(self):
        """Test __del__ handles cleanup errors gracefully."""
        with mock.patch('sys.platform', 'darwin'):
            router = EdgeChainsSmartRouter(fallback_to_python=True)
            router._lib = mock.MagicMock()
            router._lib = None  # This will cause an error if not handled

            # Should not raise any exception
            router.__del__()


class TestEdgeChainsSmartRouterIntegration(unittest.TestCase):
    """Integration tests for router."""

    def test_route_request_all_known_paths(self):
        """Test all known routes are accessible."""
        with mock.patch('sys.platform', 'darwin'):
            router = EdgeChainsSmartRouter(fallback_to_python=True)

            routes = [
                ("/v1/chat/completions", "primary_llm_cluster"),
                ("/v1/embeddings", "vector_processing_node"),
                ("/v1/models", "metadata_server"),
            ]

            for path, expected_destination in routes:
                with self.subTest(path=path):
                    result = router.route_request(path)
                    self.assertEqual(result, expected_destination)

    def test_multiple_routers_independent(self):
        """Test multiple router instances are independent."""
        with mock.patch('sys.platform', 'darwin'):
            router1 = EdgeChainsSmartRouter(fallback_to_python=True)
            router2 = EdgeChainsSmartRouter(fallback_to_python=True)

            # Both should route the same paths
            result1 = router1.route_request("/v1/chat/completions")
            result2 = router2.route_request("/v1/chat/completions")
            self.assertEqual(result1, result2)


if __name__ == "__main__":
    unittest.main()
