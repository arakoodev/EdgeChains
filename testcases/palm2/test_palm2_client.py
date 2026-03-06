"""
Test cases for Palm2/Gemini API Client
Run with: python -m pytest testcases/palm2/ -v
"""

import os
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from palm2_client import Palm2API, create_palm2_client


class TestPalm2API:
    """Test suite for Palm2API client"""
    
    @pytest.fixture
    def mock_api_key(self):
        return "test-api-key-12345"
    
    @pytest.fixture
    def client(self, mock_api_key):
        return Palm2API(api_key=mock_api_key)
    
    def test_initialization_with_api_key(self, mock_api_key):
        """Test client initialization with explicit API key"""
        client = Palm2API(api_key=mock_api_key)
        assert client.api_key == mock_api_key
        assert client.base_url == "https://generativelanguage.googleapis.com/v1beta"
    
    def test_initialization_from_env(self, monkeypatch):
        """Test client initialization from environment variable"""
        monkeypatch.setenv("GOOGLE_API_KEY", "env-api-key")
        client = Palm2API()
        assert client.api_key == "env-api-key"
    
    def test_factory_function(self, mock_api_key):
        """Test factory function creates client correctly"""
        client = create_palm2_client(mock_api_key)
        assert isinstance(client, Palm2API)
        assert client.api_key == mock_api_key


class TestGenerateText:
    """Test text generation functionality"""
    
    @pytest.fixture
    def client(self):
        return Palm2API(api_key="test-key")
    
    @patch('palm2_client.requests.post')
    def test_generate_text_success(self, mock_post, client):
        """Test successful text generation"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "Test response"}]
                }
            }]
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = client.generate_text("Hello, world!")
        
        assert "candidates" in result
        assert result["candidates"][0]["content"]["parts"][0]["text"] == "Test response"
        mock_post.assert_called_once()
    
    @patch('palm2_client.requests.post')
    def test_generate_text_with_params(self, mock_post, client):
        """Test text generation with custom parameters"""
        mock_response = Mock()
        mock_response.json.return_value = {"candidates": []}
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = client.generate_text(
            prompt="Test prompt",
            model="gemini-pro",
            temperature=0.5,
            max_tokens=500,
            top_p=0.9,
            top_k=20
        )
        
        # Verify the call was made
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        
        # Check payload
        payload = call_args.kwargs['json']
        assert payload['generationConfig']['temperature'] == 0.5
        assert payload['generationConfig']['maxOutputTokens'] == 500
        assert payload['generationConfig']['topP'] == 0.9
        assert payload['generationConfig']['topK'] == 20
    
    @patch('palm2_client.requests.post')
    def test_generate_text_error(self, mock_post, client):
        """Test error handling in text generation"""
        mock_post.side_effect = Exception("Network error")
        
        result = client.generate_text("Test")
        
        assert "error" in result
        assert result["status"] == "failed"


class TestEmbeddings:
    """Test embedding functionality"""
    
    @pytest.fixture
    def client(self):
        return Palm2API(api_key="test-key")
    
    @patch('palm2_client.requests.post')
    def test_embed_text_success(self, mock_post, client):
        """Test successful text embedding"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "embedding": {
                "values": [0.1, 0.2, 0.3, 0.4]
            }
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = client.embed_text("Test text")
        
        assert "embedding" in result
        assert result["embedding"]["values"] == [0.1, 0.2, 0.3, 0.4]
    
    @patch('palm2_client.requests.post')
    def test_batch_embed_success(self, mock_post, client):
        """Test successful batch embedding"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "embeddings": [
                {"values": [0.1, 0.2]},
                {"values": [0.3, 0.4]}
            ]
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        texts = ["First text", "Second text"]
        result = client.batch_embed(texts)
        
        assert "embeddings" in result
        assert len(result["embeddings"]) == 2


class TestChat:
    """Test chat functionality"""
    
    @pytest.fixture
    def client(self):
        return Palm2API(api_key="test-key")
    
    @patch('palm2_client.requests.post')
    def test_chat_success(self, mock_post, client):
        """Test successful multi-turn chat"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "role": "model",
                    "parts": [{"text": "I'm doing well, thanks!"}]
                }
            }]
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        messages = [
            {"role": "user", "content": "Hello!"},
            {"role": "model", "content": "Hi there!"},
            {"role": "user", "content": "How are you?"}
        ]
        
        result = client.chat(messages)
        
        assert "candidates" in result
        assert len(messages) == 3


class TestTokenCount:
    """Test token counting functionality"""
    
    @pytest.fixture
    def client(self):
        return Palm2API(api_key="test-key")
    
    @patch('palm2_client.requests.post')
    def test_count_tokens_success(self, mock_post, client):
        """Test successful token counting"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "totalTokens": 42
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = client.count_tokens("This is a test prompt")
        
        assert "totalTokens" in result
        assert result["totalTokens"] == 42


class TestListModels:
    """Test model listing functionality"""
    
    @pytest.fixture
    def client(self):
        return Palm2API(api_key="test-key")
    
    @patch('palm2_client.requests.get')
    def test_list_models_success(self, mock_get, client):
        """Test successful model listing"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "models": [
                {
                    "name": "models/gemini-pro",
                    "displayName": "Gemini Pro"
                }
            ]
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response
        
        result = client.list_models()
        
        assert "models" in result
        assert result["models"][0]["name"] == "models/gemini-pro"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
