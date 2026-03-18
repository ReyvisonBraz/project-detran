const express = require('express');
const routes = require('./src/api/routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON
app.use(express.json());

// Rotas da API
app.use('/api', routes);

// Rota de status básico
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sistema DETRAN-PA Online' });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Servidor DETRAN-PA rodando na porta ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}/health`);
  console.log(`========================================`);
});
