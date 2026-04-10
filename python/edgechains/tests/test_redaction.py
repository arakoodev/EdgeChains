import pytest
from unittest.mock import MagicMock, patch
from edgechains.utils.aws_comprehend import AwsComprehendRedactor

@pytest.fixture
def mock_redactor():
    with patch("boto3.client") as mock_client:
        redactor = AwsComprehendRedactor()
        redactor.client = MagicMock()
        yield redactor

def test_single_entity_redaction(mock_redactor):
    """Test redacting a single NAME entity."""
    raw_text = "My name is John Doe."
    mock_redactor.client.detect_pii_entities.return_value = {
        "Entities": [
            {"BeginOffset": 11, "EndOffset": 19, "Type": "NAME"}
        ]
    }
    
    result = mock_redactor.redact(raw_text)
    assert result == "My name is [NAME]."

def test_multiple_entities_redaction(mock_redactor):
    """Test redacting multiple entities (NAME and PHONE)."""
    raw_text = "Call John at 555-0123."
    # Entities are usually returned in order, but we handle any order
    mock_redactor.client.detect_pii_entities.return_value = {
        "Entities": [
            {"BeginOffset": 5, "EndOffset": 9, "Type": "NAME"},
            {"BeginOffset": 13, "EndOffset": 21, "Type": "PHONE"}
        ]
    }
    
    result = mock_redactor.redact(raw_text)
    assert "[NAME]" in result
    assert "[PHONE]" in result
    assert "John" not in result
    assert "555-0123" not in result

def test_overlapping_entities_handling(mock_redactor):
    """Test that we handle entities in reverse order to protect string offsets."""
    raw_text = "John Doe is here."
    mock_redactor.client.detect_pii_entities.return_value = {
        "Entities": [
            {"BeginOffset": 0, "EndOffset": 4, "Type": "FIRST_NAME"},
            {"BeginOffset": 5, "EndOffset": 8, "Type": "LAST_NAME"}
        ]
    }
    
    result = mock_redactor.redact(raw_text)
    assert result == "[FIRST_NAME] [LAST_NAME] is here."

def test_api_failure_fallback(mock_redactor):
    """Test that the utility returns original text if the API fails."""
    raw_text = "Don't break on me."
    mock_redactor.client.detect_pii_entities.side_effect = Exception("AWS Down")
    
    result = mock_redactor.redact(raw_text)
    assert result == raw_text
