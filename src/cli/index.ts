import { Command } from 'commander';
import * as fs from 'fs';
import { generateKeyPair } from '../crypto/signature';
import { embedWatermark } from '../watermark/embedder';
import { detectWatermark } from '../detector';
import { ProvenancePayload } from '../types';
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';

const program = new Command();

program
  .name('zerotrace')
  .description('ZeroTrace: Keyed Unicode Watermarking Framework for AI Generated Text Provenance')
  .version('1.0.0');

// Use a static keypair for the simple CLI demo by serializing/deserializing
const KEY_FILE = 'demo-keys.json';
let publicKey, privateKey;

if (fs.existsSync(KEY_FILE)) {
    const keys = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    publicKey = createPublicKey({ key: keys.publicKey, format: 'pem', type: 'spki' });
    privateKey = createPrivateKey({ key: keys.privateKey, format: 'pem', type: 'pkcs8' });
} else {
    const kp = generateKeyPair();
    publicKey = kp.publicKey;
    privateKey = kp.privateKey;
    fs.writeFileSync(KEY_FILE, JSON.stringify({
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
    }));
}

const SECRET_KEY = "zerotrace-secret-research-key";

program.command('embed')
  .description('Embed a watermark into a text file')
  .argument('<input>', 'input text file')
  .option('-o, --output <output>', 'output file', 'watermarked.txt')
  .action((input, options) => {
    try {
        console.log(`Reading input file: ${input}`);
        const text = fs.readFileSync(input, 'utf8');

        const payload: ProvenancePayload = {
            version: "1.0",
            provider: "zerotrace-cli",
            modelId: "prototype-1",
            timestamp: new Date().toISOString(),
            nonce: Math.random().toString(36).substring(2, 15),
            documentHash: "" // Will be populated by embedder
        };

        console.log('Embedding watermark...');
        const watermarkedText = embedWatermark(text, payload, privateKey, SECRET_KEY);

        fs.writeFileSync(options.output, watermarkedText, 'utf8');
        console.log(`Watermark successfully embedded. Saved to ${options.output}`);

    } catch (err) {
        console.error("Error during embedding:", err);
    }
  });

program.command('detect')
  .description('Detect a watermark in a text file')
  .argument('<input>', 'input text file')
  .action((input) => {
    try {
        console.log(`Reading input file: ${input}`);
        const text = fs.readFileSync(input, 'utf8');

        console.log('Running detection...');
        const result = detectWatermark(text, publicKey, SECRET_KEY);

        console.log('\n--- Detection Results ---');
        console.log(`Detected:        ${result.detected}`);
        console.log(`Confidence:      ${result.confidence}`);
        console.log(`Signature Valid: ${result.signatureValid}`);
        console.log(`Integrity Score: ${result.integrityScore}`);
        if (result.warnings.length > 0) {
            console.log(`Warnings:`);
            result.warnings.forEach(w => console.log(`  - ${w}`));
        }
        if (result.recoveredPayload) {
            console.log(`\nRecovered Payload:`);
            console.log(JSON.stringify(result.recoveredPayload, null, 2));
        }

    } catch (err) {
        console.error("Error during detection:", err);
    }
  });

program.parse(process.argv);
