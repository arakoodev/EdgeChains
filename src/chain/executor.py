import asyncio

class ChainExecutor:
    def __init__(self):
        self.steps = []
    def add_step(self, fn):
        self.steps.append(fn)
    async def execute(self, ctx):
        results = []
        for step in self.steps:
            result = await step(ctx)
            results.append(result)
        return results