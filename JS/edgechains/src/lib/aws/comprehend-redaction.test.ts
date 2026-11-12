import { Observable, of, throwError } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { ComprehendRedaction, ComprehendConfig } from './comprehend-redaction';
import { ComprehendClient, DetectPiiEntitiesCommand, PiiEntityType } from '@aws-sdk/client-comprehend';

// Mock the AWS ComprehendClient
jest.mock('@aws-sdk/client-comprehend', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-comprehend');
  return {
    ...actualModule,
    ComprehendClient: jest.fn(() => ({
      send: jest.fn(),
    })),
  };
});

const mockComprehendClient = new ComprehendClient({}) as jest.Mocked<ComprehendClient>;
const mockSend = mockComprehendClient.send as jest.Mock;

describe('ComprehendRedaction', () => {
  const mockConfig: ComprehendConfig = {
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with valid configuration', () => {
    const redaction = new ComprehendRedaction(mockConfig);
    expect(redaction).toBeInstanceOf(ComprehendRedaction);
    expect(ComprehendClient).toHaveBeenCalledWith({
      region: mockConfig.region,
      credentials: {
        accessKeyId: mockConfig.accessKeyId,
        secretAccessKey: mockConfig.secretAccessKey,
      },
    });
  });

  it('should throw error if configuration is incomplete', () => {
    expect(() => new ComprehendRedaction({ region: 'us-east-1', accessKeyId: 'abc', secretAccessKey: '' }))
      .toThrow('AWS Comprehend configuration requires region, accessKeyId, and secretAccessKey.');
  });

  it('should redact a single PII entity (NAME)', async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: PiiEntityType.NAME, BeginOffset: 11, EndOffset: 15, Score: 0.99 },
      ],
    });

    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('Hello, John Doe. How are you?');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('Hello, [REDACTED_NAME] Doe. How are you?');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { Text: 'Hello, John Doe. How are you?', LanguageCode: 'en' },
      })
    );
  });

  it('should redact multiple PII entities of different types', async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: PiiEntityType.NAME, BeginOffset: 11, EndOffset: 15, Score: 0.99 }, // John
        { Type: PiiEntityType.EMAIL, BeginOffset: 26, EndOffset: 41, Score: 0.98 }, // john@example.com
        { Type: PiiEntityType.PHONE_NUMBER, BeginOffset: 47, EndOffset: 59, Score: 0.97 }, // 123-456-7890
      ],
    });

    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('Hello, John Doe. My email is john@example.com and my phone is 123-456-7890.');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('Hello, [REDACTED_NAME] Doe. My email is [REDACTED_EMAIL] and my phone is [REDACTED_PHONE_NUMBER].');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should handle text with no PII entities', async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [],
    });

    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('This is a simple sentence with no sensitive data.');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('This is a simple sentence with no sensitive data.');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should handle empty string input', async () => {
    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('');
    expect(mockSend).not.toHaveBeenCalled(); // Should not call Comprehend for empty string
  });

  it('should handle whitespace string input', async () => {
    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('   ');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('   ');
    expect(mockSend).not.toHaveBeenCalled(); // Should not call Comprehend for whitespace string
  });

  it('should pass through original text on AWS API error', async () => {
    const errorMessage = 'AWS service unavailable';
    mockSend.mockRejectedValueOnce(new Error(errorMessage));

    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('This text contains PII like John Doe.');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    // The catchError in execute should return the original text
    expect(result).toBe('This text contains PII like John Doe.');
    expect(mockSend).toHaveBeenCalledTimes(1);
    // Optionally, check if console.error was called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await redaction.execute(input$).pipe(take(1)).toPromise();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error during Comprehend PII redaction:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('should respect specified language code', async () => {
    mockSend.mockResolvedValueOnce({ Entities: [] }); // No PII for simplicity

    const redaction = new ComprehendRedaction(mockConfig, { languageCode: 'es' });
    const input$ = of('Hola mundo.');
    await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { Text: 'Hola mundo.', LanguageCode: 'es' },
      })
    );
  });

  it('should only redact specified entity types', async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: PiiEntityType.NAME, BeginOffset: 11, EndOffset: 15, Score: 0.99 }, // John
        { Type: PiiEntityType.EMAIL, BeginOffset: 26, EndOffset: 41, Score: 0.98 }, // john@example.com
        { Type: PiiEntityType.PHONE_NUMBER, BeginOffset: 47, EndOffset: 59, Score: 0.97 }, // 123-456-7890
      ],
    });

    const redaction = new ComprehendRedaction(mockConfig, { entityTypes: [PiiEntityType.EMAIL] });
    const input$ = of('Hello, John Doe. My email is john@example.com and my phone is 123-456-7890.');
    const result = await redaction.execute(input$).pipe(take(1)).toPromise();

    expect(result).toBe('Hello, John Doe. My email is [REDACTED_EMAIL] and my phone is 123-456-7890.');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple items in the observable stream', async () => {
    mockSend
      .mockResolvedValueOnce({
        Entities: [{ Type: PiiEntityType.NAME, BeginOffset: 0, EndOffset: 4, Score: 0.99 }], // Alice
      })
      .mockResolvedValueOnce({
        Entities: [{ Type: PiiEntityType.EMAIL, BeginOffset: 0, EndOffset: 19, Score: 0.98 }], // bob@company.com
      });

    const redaction = new ComprehendRedaction(mockConfig);
    const input$ = of('Alice', 'bob@company.com', 'No PII here');
    const results = await redaction.execute(input$).pipe(toArray()).toPromise();

    expect(results).toEqual(['[REDACTED_NAME]', '[REDACTED_EMAIL]', 'No PII here']);
    expect(mockSend).toHaveBeenCalledTimes(3); // One for each non-empty string
  });

  // Test chaining with a dummy endpoint
  it('should chain correctly with another observable (e.g., an Endpoint)', async () => {
    mockSend.mockResolvedValueOnce({
      Entities: [
        { Type: PiiEntityType.NAME, BeginOffset: 11, EndOffset: 15, Score: 0.99 }, // John
      ],
    });

    // Simulate an Endpoint that emits a string
    const mockEndpoint = {
      execute: (prompt$: Observable<string>): Observable<string> => {
        return prompt$.pipe(map(p => `Processed: ${p}`));
      }
    };

    const redaction = new ComprehendRedaction(mockConfig);
    const originalPrompt$ = of('Hello, John Doe. How are you?');

    // Chain: originalPrompt$ -> ComprehendRedaction -> MockEndpoint
    const result = await redaction.execute(originalPrompt$).pipe(
      mockEndpoint.execute, // This is how you'd chain it with an Endpoint's execute method
      take(1)
    ).toPromise();

    expect(result).toBe('Processed: Hello, [REDACTED_NAME] Doe. How are you?');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
