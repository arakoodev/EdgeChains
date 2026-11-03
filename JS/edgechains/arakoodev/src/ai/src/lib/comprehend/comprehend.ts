import axios from "axios";

export type PiiEntityType =
  | "BANK_ACCOUNT_NUMBER"
  | "BANK_ROUTING"
  | "CREDIT_DEBIT_NUMBER"
  | "CREDIT_DEBIT_CVV"
  | "CREDIT_DEBIT_EXPIRY"
  | "PIN"
  | "EMAIL"
  | "ADDRESS"
  | "NAME"
  | "PHONE"
  | "SSN"
  | "DATE_TIME"
  | "PASSPORT_NUMBER"
  | "DRIVER_ID"
  | "USERNAME"
  | "PASSWORD"
  | "AGE"
  | "OTHER";

export interface PiiEntity {
  type: PiiEntityType;
  beginOffset: number;
  endOffset: number;
  score: number;
}

interface DetectPiiRequest {
  Text: string;
  LanguageCode: string;
}

interface DetectPiiResponse {
  Entities: Array<{
    BeginOffset: number;
    EndOffset: number;
    Score: number;
    Type: string;
  }>;
}

export class Observable<T> {
  private subscribers: Array<(value: T) => void> = [];

  subscribe(onNext: (value: T) => void): () => void {
    this.subscribers.push(onNext);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== onNext);
    };
  }

  protected next(value: T): void {
    this.subscribers.forEach((s) => s(value));
  }

  map<U>(fn: (value: T) => U): Observable<U> {
    const out = new Observable<U>();
    this.subscribe((v) => out.next(fn(v)));
    return out;
  }
}

export class ComprehendPIIRedactor extends Observable<string> {
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly endpoint: string;

  constructor(options: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }) {
    super();
    this.region = options.region;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
    this.endpoint =
      options.endpoint ?? `https://comprehend.${options.region}.amazonaws.com`;
  }

  async detectPiiEntities(text: string): Promise<PiiEntity[]> {
    const body: DetectPiiRequest = {
      Text: text,
      LanguageCode: "en",
    };

    const resp = await axios.post<DetectPiiResponse>(this.endpoint, body, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
        "X-Amz-Date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
      },
    });

    return (resp.data.Entities || []).map((e) => ({
      type: e.Type as PiiEntityType,
      beginOffset: e.BeginOffset,
      endOffset: e.EndOffset,
      score: e.Score,
    }));
  }

  async redact(
    text: string,
    options: { threshold?: number; mask?: string } = {}
  ): Promise<string> {
    const threshold = options.threshold ?? 0.5;
    const mask = options.mask ?? "[REDACTED]";
    const entities = await this.detectPiiEntities(text);
    const relevant = entities.filter((e) => e.score >= threshold);

    relevant.sort((a, b) => b.beginOffset - a.beginOffset);

    let result = text;
    for (const e of relevant) {
      result =
        result.slice(0, e.beginOffset) +
        `${mask}<${e.type}>` +
        result.slice(e.endOffset);
    }

    this.next(result);
    return result;
  }

  pipe<U>(fn: (value: string) => U): Observable<U> {
    return this.map(fn);
  }
}
