const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
require('dotenv').config();

/**
 * Script de teste para validar a configuração inicial do Scraper.
 */
async function testarScraper() {
  const scraper = new DetranPaScraper();
  
  try {
    await scraper.init();
    
    // Usando dados do .env ou valores fixos de teste
    const placa = process.env.PLACA_TESTE || 'OFK3A50';
    const renavam = process.env.RENAVAM_TESTE || '00408146338';

    await scraper.preencherDados(placa, renavam);
    
    let tentativas = 0;
    const maxTentativas = 3; // Reduzido para economizar créditos, já que o 2Captcha é assertivo
    let sucesso = false;

    while (tentativas < maxTentativas && !sucesso) {
      tentativas++;
      console.log(`\n[Teste] Tentativa ${tentativas} de ${maxTentativas}...`);

      // Delay antes de capturar para garantir carregamento total da imagem
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const captchaBuffer = await scraper.capturarCaptcha();
      const captchaService = new TwoCaptchaService();
      
      let captchaText;
      try {
        const taskId = await captchaService.enviarCaptcha(captchaBuffer);
        captchaText = await captchaService.obterResposta(taskId);
      } catch (err) {
        console.log(`[Teste] Erro no 2Captcha: ${err.message}. Recarregando...`);
        await scraper.recarregarCaptcha();
        continue;
      }

      // Validação do tamanho exigido (sempre 5 dígitos)
      if (captchaText.length !== 5) {
        console.log(`[Teste] Captcha inválido (Tamanho: ${captchaText.length}). Recarregando...`);
        await scraper.recarregarCaptcha();
        continue;
      }

      console.log(`[Teste] Captcha com 5 dígitos identificado: ${captchaText}`);

      // Submissão
      await scraper.submeterCaptcha(captchaText);
      const resultado = await scraper.obterResultado();

      if (resultado.success) {
        console.log(`[Teste] 🎉 SUCESSO! Resultado salvo em: ${resultado.screenshot}`);
        console.log('[Teste] Dados Extraídos:', JSON.stringify(resultado.dados, null, 2));
        sucesso = true;
      } else {
        console.log(`[Teste] ❌ FALHA: ${resultado.error}`);
        
        if (resultado.needsBack) {
          await scraper.clicarVoltar();
          // Após voltar, alguns campos podem estar limpos, recarregamos por segurança
          await scraper.preencherDados(placa, renavam);
        } else if (resultado.error.toLowerCase().includes('imagem') || resultado.error.toLowerCase().includes('captcha') || resultado.error.toLowerCase().includes('sequência')) {
          console.log('[Teste] Erro de captcha detectado. Recarregando e tentando novamente...');
          await scraper.recarregarCaptcha();
        } else {
          // Erro fatal (veículo não existe, etc)
          break;
        }
      }
    }

    if (!sucesso && tentativas >= maxTentativas) {
      console.log('[Teste] Atingiu o limite de tentativas sem sucesso.');
    }
    
  } catch (error) {
    console.error('[Teste] Erro ao executar o scraper:', error);
  } finally {
    await scraper.close();
  }
}

testarScraper();
