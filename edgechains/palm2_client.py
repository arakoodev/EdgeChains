import requests
import json
from typing import Optional, Dict, Any, List
import os

class Palm2API:
    """
    Google PaLM 2 / Gemini API Client
    Supports both PaLM 2 (legacy) and Gemini models
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        
    def generate_text(
        self, 
        prompt: str, 
        model: str = "gemini-pro",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        top_p: float = 0.95,
        top_k: int = 40
    ) -> Dict[str, Any]:
        """
        Generate text using Gemini/PaLM2 API
        
        Args:
            prompt: Input text prompt
            model: Model name (gemini-pro, gemini-pro-vision, etc.)
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum output tokens
            top_p: Nucleus sampling parameter
            top_k: Top-k sampling parameter
            
        Returns:
            API response dictionary
        """
        url = f"{self.base_url}/models/{model}:generateContent"
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "topP": top_p,
                "topK": top_k
            }
        }
        
        params = {"key": self.api_key}
        
        try:
            response = requests.post(url, params=params, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}
    
    def embed_text(self, text: str, model: str = "embedding-001") -> Dict[str, Any]:
        """
        Generate embeddings for text
        
        Args:
            text: Input text to embed
            model: Embedding model name
            
        Returns:
            Embedding vector and metadata
        """
        url = f"{self.base_url}/models/{model}:embedContent"
        
        payload = {
            "content": {
                "parts": [{"text": text}]
            }
        }
        
        params = {"key": self.api_key}
        
        try:
            response = requests.post(url, params=params, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}
    
    def batch_embed(self, texts: List[str], model: str = "embedding-001") -> Dict[str, Any]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of input texts
            model: Embedding model name
            
        Returns:
            Batch embedding results
        """
        url = f"{self.base_url}/models/{model}:batchEmbedContents"
        
        requests_payload = []
        for text in texts:
            requests_payload.append({
                "content": {
                    "parts": [{"text": text}]
                }
            })
        
        payload = {"requests": requests_payload}
        params = {"key": self.api_key}
        
        try:
            response = requests.post(url, params=params, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}
    
    def count_tokens(self, text: str, model: str = "gemini-pro") -> Dict[str, Any]:
        """
        Count tokens in input text
        
        Args:
            text: Input text
            model: Model name
            
        Returns:
            Token count information
        """
        url = f"{self.base_url}/models/{model}:countTokens"
        
        payload = {
            "contents": [{
                "parts": [{"text": text}]
            }]
        }
        
        params = {"key": self.api_key}
        
        try:
            response = requests.post(url, params=params, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}
    
    def chat(
        self, 
        messages: List[Dict[str, str]], 
        model: str = "gemini-pro",
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> Dict[str, Any]:
        """
        Multi-turn chat completion
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name
            temperature: Sampling temperature
            max_tokens: Maximum output tokens
            
        Returns:
            Chat response
        """
        url = f"{self.base_url}/models/{model}:generateContent"
        
        contents = []
        for msg in messages:
            contents.append({
                "role": msg.get("role", "user"),
                "parts": [{"text": msg.get("content", "")}]
            })
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        
        params = {"key": self.api_key}
        
        try:
            response = requests.post(url, params=params, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}
    
    def list_models(self) -> Dict[str, Any]:
        """
        List available models
        
        Returns:
            List of available models
        """
        url = f"{self.base_url}/models"
        params = {"key": self.api_key}
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}


# Type definitions for TypeScript-style usage
Palm2Response = Dict[str, Any]
EmbeddingResponse = Dict[str, Any]
ChatMessage = Dict[str, str]

# Factory function
def create_palm2_client(api_key: Optional[str] = None) -> Palm2API:
    """Create a new PaLM2/Gemini API client"""
    return Palm2API(api_key)
