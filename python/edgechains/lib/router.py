import time
import logging

class ArakooRouter:
    def __init__(self, model_list):
        """
        model_list: List of dicts with {
            'model_name': 'alias', 
            'params': {'model': 'actual-provider-name', 'api_key': 'key'}
        }
        """
        self.model_list = model_list

    def completion(self, model_alias, prompt):
        # Filter models that match the alias (e.g., 'gpt-3.5-turbo')
        eligible_models = [m for m in self.model_list if m['model_name'] == model_alias]
        
        for attempt, config in enumerate(eligible_models):
            try:
                return self._execute_call(prompt, config['params'])
            except Exception as e:
                if "429" in str(e) and attempt < len(eligible_models) - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s...
                    print(f"Retrying in {wait_time}s with fallback model...")
                    time.sleep(wait_time)
                    continue
                raise e

    def _execute_call(self, prompt, params):
        # Mechanical check: simulate a fail on the first key
        if params['api_key'] == "FAIL":
            raise Exception("429: Rate Limit")
        return f"Final Response from {params['model']} using {params['api_key']}"

# Example for Arakoo PR
model_list = [
    {
        "model_name": "smart-router",
        "params": {"model": "gemini-1.5-pro", "api_key": "FAIL"}
    },
    {
        "model_name": "smart-router",
        "params": {"model": "gemini-1.5-flash", "api_key": "SUCCESS_KEY"}
    }
]

router = ArakooRouter(model_list)
print(router.completion("smart-router", "Execute Project Monolith system check."))
