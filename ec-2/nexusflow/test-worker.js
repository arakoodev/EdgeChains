console.log('Testing worker imports...');

try {
  console.log('Importing startLogWorker...');
  const { startLogWorker } = await import('./nodes/actions/log.js');
  console.log('startLogWorker imported successfully');
} catch (e) {
  console.error('Error importing startLogWorker:', e);
}

try {
  console.log('Importing startEchoWorker...');
  const { startEchoWorker } = await import('./workers/echo.js');  
  console.log('startEchoWorker imported successfully');
} catch (e) {
  console.error('Error importing startEchoWorker:', e);
}

console.log('Test complete');