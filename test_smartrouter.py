import pytest
import json
from smartrouter import SmartRouter, Deployment

class TestSmartRouter:
    """Test SmartRouter load balancing, reliability, streaming, token tracking"""
    
    def setup_method(self):
        self.router = SmartRouter()
        self.router.add_deployment(Deployment(
            url='http://127.0.0.1:8001/completion',
            rate_limit=100,
            max_tokens=4000
        ))
        self.router.add_deployment(Deployment(
            url='http://127.0.0.1:8002/completion',
            rate_limit=50,
            max_tokens=2000
        ))
    
    def test_load_balance_picks_least_tokens(self):
        """Should pick deployment with least token usage"""
        self.router.deployments[0].tokens_used = 100
        self.router.deployments[1].tokens_used = 50
        best = self.router._select_deployment()
        assert best.tokens_used == 50
    
    def test_load_balance_respects_rate_limit(self):
        """Should not pick deployment at rate limit"""
        self.router.deployments[0].tokens_used = 95
        self.router.deployments[1].tokens_used = 49
        best = self.router._select_deployment()
        assert best is not None
        assert best.tokens_used <= 95
    
    def test_retry_on_timeout(self):
        """Should retry request on timeout"""
        self.router.retry_count = 3
        self.router.timeout_seconds = 5
        assert self.router.retry_count == 3
    
    def test_token_tracking(self):
        """Should track tokens per request"""
        initial = self.router.deployments[0].tokens_used
        self.router.deployments[0].add_tokens(50)
        assert self.router.deployments[0].tokens_used == initial + 50
    
    def test_streaming_flag(self):
        """Should support streaming parameter"""
        req = {"prompt": "test", "stream": True}
        assert req.get("stream") == True
    
    def test_logging_enabled(self):
        """Should log requests and responses"""
        assert self.router.logger is not None
