const express = require('express');
const DetranPaScraper = require('../scrapers/detranScraper');
const TwoCaptchaService = require('../services/twoCaptchaService');
require('dotenv').config();

const router = express.Router();
const captchaService = new TwoCaptchaService();

/**
 * Endpoint de Consulta Detalhada de Veículo
 */
router.post('/consulta-detalhada', async (req, res) => {
  const { placa, renavam } = req.body;

  if (!placa || !renavam) {
    return res.status(400).json({ error: 'Placa e Renavam são obrigatórios.' });
  }

  const scraper = new DetranPaScraper();
  
  try {
    await scraper.init();
    await scraper.preencherDados(placa, renavam);
    
    // 1. Capturar Captcha
    const captchaPath = await scraper.capturarCaptcha();
    
    // 2. Resolver Captcha via 2Captcha
    const taskId = await captchaService.enviarCaptcha(captchaPath);
    const captchaText = await captchaService.obterResposta(taskId);
    
    // 3. TODO: Inserir o texto no campo do site e clicar em confirmar
    // Por enquanto, vamos retornar o que conseguimos até aqui para validar a arquitetura
    
    res.json({
      success: true,
      message: 'Dados preenchidos e captcha resolvido (Simulação).',
      data: {
        placa,
        renavam,
        captchaResolvido: captchaText
      }
    });

  } catch (error) {
    console.error('[API] Erro na consulta:', error.message);
    res.status(500).json({ error: 'Erro interno ao processar a consulta.' });
  } finally {
    await scraper.close();
  }
});

module.exports = router;
