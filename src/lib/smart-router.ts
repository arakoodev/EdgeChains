import { bandit } from '@oraclaw/bandit';

const provider = bandit({
  arms: [
    { id: 'openai', name: 'OpenAI', pulls: tokensUsed.openai, totalReward: success.openai },
    { id: 'palm', name: 'Google Palm', pulls: tokensUsed.palm, totalReward: success.palm },
    { id: 'cohere', name: 'Cohere', pulls: tokensUsed.cohere, totalReward: success.cohere },
  ],
  strategy: 'ucb1' // Ini kunci buat dapetin $200!
});

