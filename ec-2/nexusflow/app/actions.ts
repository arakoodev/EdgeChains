'use server';
import { flowProducer } from '../lib/queue';

export async function runEchoWorkflow(message: string) {
  await flowProducer.add({
    name: 'echo',
    queueName: 'echo',
    data: { message },
  });
}
