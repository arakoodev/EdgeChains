{
  deployments: [
    {
      id: 'openai-primary',
      provider: 'openai',
      model: 'gpt-4o',
      rpmLimit: 60,
      tpmLimit: 100000,
      timeoutMs: 30000,
    },
    {
      id: 'openai-backup',
      provider: 'openai',
      model: 'gpt-4o',
      rpmLimit: 60,
      tpmLimit: 100000,
      timeoutMs: 30000,
    },
  ],
}
