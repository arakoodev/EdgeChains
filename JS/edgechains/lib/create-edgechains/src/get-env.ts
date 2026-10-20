function get_env() {
    let text = `
    OPENAI_API_KEY=
    OPENAI_ORG_ID=
  `.trim();

    return text.trim() + "\n";
}

export { get_env };
