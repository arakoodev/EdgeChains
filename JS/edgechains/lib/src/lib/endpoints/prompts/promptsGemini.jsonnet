local generateContentPrompt(text) = {
  contents: [
    {
      parts: [
        {
          text: text,
        },
      ],
    },
  ],
};

generateContentPrompt("Hiii");// your prompts here