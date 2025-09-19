
import express from 'express';
import cors from 'cors';
const app = express();
const port = 4000;
app.use(cors());

const VARIANCES = (await import('../src/mockData.ts')).VARIANCES;
const MOCK_TXNS = (await import('../src/mockData.ts')).MOCK_TXNS;

app.get('/api/variances', (req,res)=>{
  res.json(VARIANCES);
});
app.get('/api/transactions/:id', (req,res)=>{
  const id = req.params.id;
  res.json(MOCK_TXNS[id] ?? []);
});

app.listen(port, ()=>{
  console.log(`Mock API listening on http://localhost:${port}`);
});
