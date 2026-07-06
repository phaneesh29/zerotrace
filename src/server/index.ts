import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import * as path from 'path';
import { loadOrCreateKeyPair } from '../crypto/keys';
import { KEY_FILE } from '../config';
import { createEncodeRouter } from './routes/encode';
import { createDecodeRouter } from './routes/decode';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const { publicKey, privateKey } = loadOrCreateKeyPair(KEY_FILE);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', createEncodeRouter(privateKey));
app.use('/api', createDecodeRouter(publicKey));

app.listen(PORT, () => {
    console.log(`ZeroTrace web app listening on http://localhost:${PORT}`);
});
