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
  | "URL"
  | "AGE"
  | "USERNAME"
  | "PASSWORD"
  | "AWS_ACCESS_KEY"
  | "AWS_SECRET_KEY"
  | "IP_ADDRESS"
  | "MAC_ADDRESS"
  | "ALL"
  | string;

export interface PiiEntity {
  Score?: number;
  Type?: PiiEntityType;
  BeginOffset?: number;
  EndOffset?: number;
}

export type RedactionMode = "REPLACE_LABEL" | "MASK" | "REMOVE" | "CUSTOM";

export interface PiiLabel {
  name: string;
  score: number;
}

export interface RedactionResult {
  originalText: string;
  redactedText: string;
  entities: PiiEntity[];
  labels: PiiLabel[];
}

export interface AwsComprehendOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  languageCode?: string;
  defaultMode?: RedactionMode;
  maskChar?: string;
  minScore?: number;
  entityTypes?: PiiEntityType[];
  excludedTypes?: PiiEntityType[];
  customReplacer?: (entity: PiiEntity, matchedText: string) => string;
  client?: ComprehendClientLike;
  fallbackLocalRules?: boolean;
}

export interface ComprehendClientLike {
  detectPiiEntities(params: {
    Text: string;
    LanguageCode: string;
  }): Promise<{ Entities?: PiiEntity[] }>;
  containsPiiEntities?(params: {
    Text: string;
    LanguageCode: string;
  }): Promise<{ Labels?: { Name: string; Score: number }[] }>;
}

export interface ChatEndpointLike {
  chat(messages: any[]): Promise<any>;
}
