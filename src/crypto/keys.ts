import * as fs from 'fs';
import { createPrivateKey, createPublicKey, KeyObject } from 'crypto';
import { generateKeyPair } from './signature';
import { KEY_FILE } from '../config';

export interface LoadedKeyPair {
    publicKey: KeyObject;
    privateKey: KeyObject;
}

/**
 * Loads the demo Ed25519 keypair from KEY_FILE, generating and persisting a
 * new one on first run.
 */
export function loadOrCreateKeyPair(keyFile: string = KEY_FILE): LoadedKeyPair {
    if (fs.existsSync(keyFile)) {
        const keys = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
        return {
            publicKey: createPublicKey({ key: keys.publicKey, format: 'pem', type: 'spki' }),
            privateKey: createPrivateKey({ key: keys.privateKey, format: 'pem', type: 'pkcs8' }),
        };
    }

    const { publicKey, privateKey } = generateKeyPair();
    fs.writeFileSync(keyFile, JSON.stringify({
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }));
    return { publicKey, privateKey };
}
