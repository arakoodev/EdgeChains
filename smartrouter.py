from typing import List, Dict, Any
import time
import logging

logger = logging.getLogger(__name__)

class Deployment:
    def __init__(self, url: str, rate_limit: int, max_tokens: int = 4000):
        self.url = url
        self.rate_limit = rate_limit
        self.max_tokens = max_tokens
        self.tokens_used = 0
    
    def add_tokens(self, count: int):
        self.tokens_used += count

class SmartRouter:
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        self.deployments: List[Deployment] = []
        self.timeout_seconds = timeout
        self.retry_count = max_retries
        self.request_log = []
        self.logger = logger
    
    def add_deployment(self, deployment: Deployment):
        self.deployments.append(deployment)
    
    def _select_deployment(self) -> Deployment:
        """Pick deployment below rate limit with least tokens. FIX: use <= not <"""
        available = [d for d in self.deployments if d.tokens_used <= d.rate_limit]
        if not available:
            return None
        return min(available, key=lambda d: d.tokens_used)
    
    def route(self, prompt: str, stream: bool = False, retries: int = 0) -> Dict[str, Any]:
        """Route request to least-loaded deployment."""
        deployment = self._select_deployment()
        if not deployment:
            raise Exception("No available deployments")
        
        try:
            tokens_used = len(prompt.split()) + 10
            deployment.tokens_used += tokens_used
            
            response = {
                "choices": [{"text": "Mock response"}],
                "usage": {"total_tokens": tokens_used, "prompt_tokens": len(prompt.split())}
            }
            
            self.logger.info(f"Request routed to {deployment.url}, tokens: {tokens_used}")
            self.request_log.append({
                "timestamp": time.time(),
                "deployment": deployment.url,
                "tokens": tokens_used,
                "status": "success"
            })
            
            return response
        except Exception as e:
            if retries < self.retry_count:
                return self.route(prompt, stream, retries + 1)
            raise
