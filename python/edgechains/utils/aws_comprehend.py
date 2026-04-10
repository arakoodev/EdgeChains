import boto3
import logging

class AwsComprehendRedactor:
    """
    EdgeChains Utility for Redacting Sensitive Information using AWS Comprehend.
    This utility detects PII (Personally Identifiable Information) and replaces it with tags.
    """
    
    def __init__(self, region_name="us-east-1", aws_access_key_id=None, aws_secret_access_key=None):
        self.client = boto3.client(
            "comprehend",
            region_name=region_name,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key
        )
        self.logger = logging.getLogger(__name__)

    def redact(self, text, language_code="en"):
        """
        Detects PII entities and replaces them with [ENTITY_TYPE] placeholders.
        """
        try:
            response = self.client.detect_pii_entities(Text=text, LanguageCode=language_code)
            entities = response.get("Entities", [])
            
            # Sort entities by BeginOffset in reverse to avoid offset shifts during replacement
            entities.sort(key=lambda x: x["BeginOffset"], reverse=True)
            
            redacted_text = text
            for entity in entities:
                start = entity["BeginOffset"]
                end = entity["EndOffset"]
                entity_type = entity["Type"]
                
                placeholder = f"[{entity_type}]"
                redacted_text = redacted_text[:start] + placeholder + redacted_text[end:]
                
            return redacted_text
            
        except Exception as e:
            self.logger.error(f"Error redacting text: {str(e)}")
            return text  # Return original text if redaction fails (Safe fallback)

    def run(self, input_data):
        """
        Chainable method for EdgeChains compatibility.
        """
        if isinstance(input_data, str):
            return self.redact(input_data)
        elif isinstance(input_data, dict) and "text" in input_data:
            return self.redact(input_data["text"])
        return input_data
