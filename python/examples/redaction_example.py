from edgechains.utils.aws_comprehend import AwsComprehendRedactor

def main():
    # 1. Initialize the Redactor
    # Note: In production, use environment variables for AWS credentials
    redactor = AwsComprehendRedactor(region_name="us-east-1")

    # 2. A sensitive prompt containing PII
    raw_prompt = "Hello, my name is John Doe and my phone number is 555-0123. Can you help me?"
    print(f"--- RAW PROMPT ---\n{raw_prompt}\n")

    # 3. Redact the data
    clean_prompt = redactor.run(raw_prompt)
    print(f"--- REDACTED PROMPT ---\n{clean_prompt}\n")

    # Now clean_prompt is safe to send to an GPT model!

if __name__ == "__main__":
    main()
