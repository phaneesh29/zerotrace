import { generateKeyPairSync, sign, verify, KeyObject } from 'crypto';

/**
 * Core Module 4: Cryptographic Signature
 * Uses Ed25519
 */

export interface KeyPair {
    publicKey: KeyObject;
    privateKey: KeyObject;
}

export function generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return { publicKey, privateKey };
}

export function signPayload(payloadJson: string, privateKey: KeyObject): string {
    const signature = sign(null, Buffer.from(payloadJson, 'utf8'), privateKey);
    return signature.toString('base64');
}

export function verifyPayload(payloadJson: string, signatureBase64: string, publicKey: KeyObject): boolean {
    try {
        const signature = Buffer.from(signatureBase64, 'base64');
        return verify(null, Buffer.from(payloadJson, 'utf8'), publicKey, signature);
    } catch (e) {
        return false;
    }
}
