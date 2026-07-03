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
  /** Error-correction telemetry, used as a graded tamper signal. */
  ecc?: EccTamperStats;
}

export interface EccTamperStats {
  /** Bit errors repaired by the BCH inner stage. */
  bchBitsCorrected: number;
  /** Byte errors repaired by the Reed-Solomon outer stage. */
  rsBytesCorrected: number;
  /** ECC blocks that were beyond repair (strong tamper evidence). */
  uncorrectableBlocks: number;
  /** Total symbols the codes had to repair. */
  totalCorrections: number;
}

export interface ParaphraseProvider {
  paraphrase(text: string): Promise<string>;
}
