import express from 'express';
import zkpController from './controllers/zkpController';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'zkp-service' });
});

app.use('/zkp', zkpController);

app.listen(PORT, () => {
    console.log(`ZKP Service running on port ${PORT}`);
});
