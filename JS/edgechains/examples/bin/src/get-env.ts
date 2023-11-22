function get_env() {
    let text = `
    OPEN_AI_API_KEY=
    OPEN_AI_ORG_ID=
    CHAT_COMPLETION_ENDPOINT=https://api.openai.com/v1/chat/completions
    OPEN_AI_MODEL=gpt-3.5-turbo
    OPEN_AI_ROLE=user
    OPEN_AI_TEMP=0.7
  `.trim();
  
    return text.trim() + "\n";
  }
  
  export { get_env };
  