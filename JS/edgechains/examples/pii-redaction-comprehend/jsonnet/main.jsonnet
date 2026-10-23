local prompt = std.extVar("redacted_prompt");

{
    system_instruction: "You are a privacy-preserving customer support assistant. All PII tokens such as [NAME], [SSN], [EMAIL], and [PHONE] have already been redacted using AWS Comprehend.",
    sanitized_prompt: prompt,
}
