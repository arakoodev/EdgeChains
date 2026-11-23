function get_gitignore() {
    let text = `
  # standard exclusions
  node_modules
  
  # build artifacts
  dist
  
  # environment files
  .env
  `.trim();

    return text.trim() + "\n";
}

export { get_gitignore };
