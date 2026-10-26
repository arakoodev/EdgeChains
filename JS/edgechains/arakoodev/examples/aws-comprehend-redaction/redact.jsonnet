local promptTemplate = |||
    Please summarize the following customer support transcript:
    Customer: Hi, my name is {customer_name}, my email is {customer_email}, and my SSN is {customer_ssn}.
    Issue: {issue_summary}
|||;

{
    awsRegion: "us-east-1",
    languageCode: "en",
    minScore: 0.75,
    maskMode: "ENTITY_TYPE",
    prompt: std.strReplace(
        std.strReplace(
            std.strReplace(
                std.strReplace(promptTemplate, "{customer_name}", "Alice Johnson"),
                "{customer_email}",
                "alice.johnson@example.com"
            ),
            "{customer_ssn}",
            "123-45-6789"
        ),
        "{issue_summary}",
        "Unable to reset account two-factor authentication."
    ),
}
