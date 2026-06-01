# EdgeChains Router Optimization

## Overview

This directory contains the EdgeChains **native FFI router** — a high-performance request routing kernel written in Rust and exposed to Python via ctypes Foreign Function Interface (FFI).

The native router provides:
- **Low-latency routing** for distributed LLM API clusters
- **Cross-language interop** (Rust ↔ Python) via FFI
- **Automatic fallback** to pure Python routing on unsupported platforms
- **Memory-safe** pointer handling and cleanup

## Architecture

```
┌────────────────────────────────────────────┐
│  Python Application (EdgeChains)    │
└────────────────────┬────────────────────────┘
             │
             │ ctypes FFI
             ↓
┌────────────────────────────────────────────┐
│  smart_router.py (Python Bridge)    │
│  - Load native library              │
│  - Type marshalling                 │
│  - Memory management                │
│  - Platform detection & fallback    │
└────────────────────┬────────────────────────┘
             │
             │ C ABI
             ↓
┌────────────────────────────────────────────┐
│  librouter_core.so (Native Binary)  │
│  - get_optimal_route()              │
│  - free_string()                    │
│  - Route registry (HashMap)         │
└────────────────────────────────────────────┘
```

## File Structure

```
edgechains-router-optimization/
├── router_core.rs              # Rust native kernel (30 lines)
├── smart_router.py             # Python FFI bridge (180+ lines)
├── librouter_core.so           # Compiled native binary (Linux x86_64/ARM64)
├── test_smart_router.py        # Comprehensive unit tests
└── README.md                   # This file
```

## Usage

### Basic Example

```python
from smart_router import EdgeChainsSmartRouter

# Initialize router (auto-detects platform)
router = EdgeChainsSmartRouter()

# Route requests
destination = router.route_request("/v1/chat/completions")
print(destination)  # Output: "primary_llm_cluster"

# Unknown routes fall back to 'default'
unknown = router.route_request("/v1/unknown-endpoint")
print(unknown)  # Output: "default"
```

### Platform-Specific Behavior

#### Linux (x86_64, ARM64)
- ✅ **Native FFI acceleration** via `librouter_core.so`
- High performance, low latency
- Requires compiled binary

#### macOS, Windows
- ⚠️ **Pure Python fallback** (native binary not compiled)
- Same API, slightly higher latency
- No binary dependencies needed

### Forcing Fallback

To use Python fallback even on Linux (e.g., for testing):

```python
router = EdgeChainsSmartRouter(fallback_to_python=True)
router.route_request("/v1/chat/completions")
```

To raise an error on unsupported platforms (no Python fallback):

```python
router = EdgeChainsSmartRouter(fallback_to_python=False)  # Linux only
```

## Route Registry

The native router maintains a static registry of LLM cluster routes:

| Endpoint | Cluster |
|----------|----------|
| `/v1/chat/completions` | `primary_llm_cluster` |
| `/v1/embeddings` | `vector_processing_node` |
| `/v1/models` | `metadata_server` |
| (default) | `default` |

**To update routes**, modify `init_registry()` in `router_core.rs` and recompile:

```bash
cargo build --release
cp target/release/librouter_core.so .
```

## Memory Management

### Automatic Cleanup

The Python bridge automatically manages memory allocated by the Rust kernel:

```python
router = EdgeChainsSmartRouter()
result = router.route_request("/v1/chat/completions")
# Memory automatically freed, no manual cleanup needed
```

Under the hood:
1. Python calls `get_optimal_route()` → returns allocated C string pointer
2. Python reads the pointer value
3. Python calls `free_string()` in a `finally` block
4. Rust deallocates the C string

### No Memory Leaks

✅ Cleanup happens automatically even if exceptions occur:

```python
try:
    result = router.route_request("/invalid")
except RuntimeError:
    pass  # Memory still cleaned up!
```

## Error Handling

### Native FFI Errors

```python
try:
    router = EdgeChainsSmartRouter(fallback_to_python=False)
except OSError as e:
    print(f"Native router unavailable: {e}")
    # Handle gracefully, or use fallback manually
```

### Invalid Input

```python
try:
    router.route_request("")  # Empty path
except ValueError:
    print("Path cannot be empty")

try:
    router.route_request(None)  # Non-string
except ValueError:
    print("Path must be a string")
```

### Runtime Errors

```python
try:
    router = EdgeChainsSmartRouter()
    result = router.route_request("/v1/chat/completions")
except RuntimeError as e:
    print(f"Routing failed: {e}")
    # Possibly native binary corrupted or FFI issue
```

## Building from Source

### Prerequisites

- Rust 1.70+
- `cargo`
- Linux target (x86_64-unknown-linux-gnu or aarch64-unknown-linux-gnu)

### Build Steps

```bash
# Navigate to this directory
cd edgechains-router-optimization

# Build for Linux x86_64
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target x86_64-unknown-linux-gnu
cp target/x86_64-unknown-linux-gnu/release/librouter_core.so .

# Or for Linux ARM64
rustup target add aarch64-unknown-linux-gnu
cargo build --release --target aarch64-unknown-linux-gnu
cp target/aarch64-unknown-linux-gnu/release/librouter_core.so .
```

### Verify Build

```bash
ldd librouter_core.so
# Should show only standard C library dependencies
```

## Testing

### Run Unit Tests

```bash
pip install pytest pytest-mock
pytest test_smart_router.py -v
```

### Test Coverage

- ✅ Platform detection (Linux, macOS, Windows)
- ✅ Native FFI loading and initialization
- ✅ Python fallback routing
- ✅ Path normalization (leading/trailing slashes)
- ✅ Edge cases (null paths, invalid input)
- ✅ Memory cleanup verification
- ✅ FFI type safety
- ✅ Error handling and recovery

### Manual Testing

```python
from smart_router import EdgeChainsSmartRouter

# Test 1: Native loading
router = EdgeChainsSmartRouter()
print(f"Using native: {router._use_native}")

# Test 2: Routing
for path in ["/v1/chat/completions", "/v1/embeddings", "/v1/models", "/unknown"]:
    result = router.route_request(path)
    print(f"{path} → {result}")

# Test 3: Path normalization
assert router.route_request("/v1/chat/completions") == router.route_request("v1/chat/completions")
assert router.route_request("/v1/chat/completions/") == router.route_request("/v1/chat/completions")

# Test 4: Error handling
try:
    router.route_request("")
except ValueError as e:
    print(f"Expected error: {e}")

print("\nAll manual tests passed!")
```

## Performance

### Benchmarks (Rough Estimates)

| Platform | Latency | Throughput |
|----------|---------|------------|
| Linux (Native FFI) | < 1μs per call | ~1M calls/sec |
| macOS (Python fallback) | ~50μs per call | ~20k calls/sec |
| Windows (Python fallback) | ~50μs per call | ~20k calls/sec |

**Note**: Actual performance depends on system load, cache behavior, and GIL contention.

## Security Considerations

### Pointer Safety

- ✅ All C pointers validated (null checks)
- ✅ No buffer overflows (Rust guarantees)
- ✅ No data races (OnceLock provides thread-safe initialization)
- ✅ Memory freed correctly (CString::from_raw)

### Input Validation

- ✅ UTF-8 validation on C string conversion
- ✅ Path normalization to prevent directory traversal
- ✅ Empty path rejection

### Compilation

- ✅ No unsafe code outside FFI boundary
- ✅ Bounds checking for all array accesses
- ✅ No hardcoded paths (uses `__file__` relative paths)

## Troubleshooting

### "OSError: Native routing binary not found"

**Cause**: `librouter_core.so` missing or in wrong location

**Solution**:
1. Verify file exists: `ls -la edgechains-router-optimization/librouter_core.so`
2. Rebuild from source (see "Building from Source")
3. Check file permissions: `chmod +x librouter_core.so`

### "RuntimeError: Native router returned null pointer"

**Cause**: FFI call failed or native binary corrupted

**Solution**:
1. Force Python fallback for testing: `EdgeChainsSmartRouter(fallback_to_python=True)`
2. Verify binary is valid: `file librouter_core.so`
3. Check system compatibility: `uname -m` (should be x86_64 or aarch64)

### Memory leaks detected

**Cause**: Cleanup failed or double-free attempted

**Solution**:
1. Check exception logs (memory cleanup warnings)
2. Verify Python version compatibility (3.8+)
3. Run with valgrind to profile actual leaks: `valgrind python test.py`

## Contributing

To modify the native router:

1. Edit `router_core.rs` (Rust kernel)
2. Rebuild: `cargo build --release`
3. Update tests in `test_smart_router.py`
4. Run full test suite: `pytest test_smart_router.py -v`
5. Commit both `.rs` and `.so` files

## Future Improvements

- [ ] Dynamic route registration (runtime HashMap updates)
- [ ] Metrics collection (request counts, latencies)
- [ ] macOS/Windows native binaries (compile targets)
- [ ] Benchmarking suite
- [ ] Route caching and preloading
- [ ] Async FFI support

## References

- [Rust FFI Guide](https://doc.rust-lang.org/nomicon/ffi.html)
- [Python ctypes Documentation](https://docs.python.org/3/library/ctypes.html)
- [OnceLock Documentation](https://doc.rust-lang.org/std/sync/struct.OnceLock.html)

## License

Same as EdgeChains project.
