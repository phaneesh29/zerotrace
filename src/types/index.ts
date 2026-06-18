export interface ProvenancePayload {
  version: string;
  provider: string;
  modelId: string;
  timestamp: string;
  nonce: string;
  documentHash: string;
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  signatureValid: boolean;
  payloadRecovered: boolean;
  integrityScore: number;
  recoveredPayload?: ProvenancePayload;
  warnings: string[];
}

export interface ParaphraseProvider {
  paraphrase(text: string): Promise<string>;
}
