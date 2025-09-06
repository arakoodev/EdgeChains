import { startLogWorker } from './nodes/actions/log';
import { startEchoWorker } from './workers/echo';
console.log('Starting NexusFlow workers...');
// Start all workers
const logWorker = startLogWorker();
const echoWorker = startEchoWorker();
// Import merge worker (it auto-starts)
import('./workers/merge');
console.log('✅ All workers started successfully');
console.log('- Log Worker: ready');
console.log('- Echo Worker: ready');
console.log('- Merge Worker: ready');
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down workers...');
    await logWorker.close();
    await echoWorker.close();
    console.log('✅ All workers shut down');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🔄 Shutting down workers...');
    await logWorker.close();
    await echoWorker.close();
    console.log('✅ All workers shut down');
    process.exit(0);
});
