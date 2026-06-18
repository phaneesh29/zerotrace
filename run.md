# ZeroTrace Quickstart Guide

This guide walks you through running the ZeroTrace prototype using the simple CLI.

## Prerequisites

Ensure you have Node.js installed. We will use `tsx` to run the TypeScript files directly without needing a manual compilation step.

Navigate into the project directory:
```bash
cd D:\pilabs\zerotrace
```

If you haven't installed dependencies yet, run:
```bash
npm install
```

## 1. Embed a Watermark

To embed a watermark into a text file, use the `embed` command. The CLI will automatically generate a cryptographic keypair (saved to `demo-keys.json`) on its first run and use it to sign the provenance payload.

```bash
npx tsx src/cli/index.ts embed input.txt -o watermarked.txt
```

**What happens under the hood:**
- `input.txt` is canonicalized and hashed (SHA-256).
- A provenance payload is generated and signed with Ed25519.
- The payload and signature are serialized, bitstreamed, and encoded with Error Correction (ECC).
- The ECC bits are converted into invisible zero-width Unicode characters and pseudo-randomly distributed across the text boundaries.
- The output is saved to `watermarked.txt`.

## 2. Detect a Watermark

To detect and verify a watermark from a file, use the `detect` command.

```bash
npx tsx src/cli/index.ts detect watermarked.txt
```

**What happens under the hood:**
- The steganographic zero-width Unicode characters are extracted from the text.
- The bits are decoded through the ECC algorithm.
- The JSON payload and Ed25519 signature are reconstructed.
- The signature is verified using the public key (loaded from `demo-keys.json`).
- The canonical document hash is compared against the hash stored in the payload to generate an integrity score.

**Example Output:**
```text
Reading input file: watermarked.txt
Running detection...

--- Detection Results ---
Detected:        true
Confidence:      1
Signature Valid: true
Integrity Score: 1

Recovered Payload:
{
  "version": "1.0",
  "provider": "zerotrace-cli",
  "modelId": "prototype-1",
  "timestamp": "2026-06-18T08:39:41.290Z",
  "nonce": "2t6n2pgqsgy",
  "documentHash": "895994bb21f2e33851747ae0be3c2ee0d30e3bd53a7af445d51fb24570e37e0a"
}
```

## 3. Help Command

You can view all available CLI commands by running:
```bash
npx tsx src/cli/index.ts --help
```
