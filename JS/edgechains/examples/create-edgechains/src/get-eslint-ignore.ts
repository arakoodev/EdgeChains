function get_eslintignore() {
  let text = `
    node_modules
    dist
  `.trim();

  return text.trim() + "\n";
}

export { get_eslintignore };
