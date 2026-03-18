const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
require('dotenv').config();

/**
 * Script de teste para múltiplos serviços.
 */
async function testarServico(servico, dadosVeiculo) {
  const scraper = new DetranPaScraper();
  
  try {
    await scraper.init(servico);
    
    // Escolhe preenchimento baseado no serviço
    if (servico === 'SNG') {
        await scraper.preencherSNG(dadosVeiculo.chassi);
    } else if (servico === 'CRLV') {
        await scraper.preencherDados(dadosVeiculo.placa, dadosVeiculo.renavam, dadosVeiculo.cpf);
    } else {
        await scraper.preencherDados(dadosVeiculo.placa, dadosVeiculo.renavam);
    }
    
    let sucesso = false;
    let tentativas = 0;
    const maxTentativas = 3;

    while (tentativas < maxTentativas && !sucesso) {
        tentativas++;
        console.log(`\n[Teste - ${servico}] Tentativa ${tentativas} de ${maxTentativas}...`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const captchaBuffer = await scraper.capturarCaptcha();
        const captchaService = new TwoCaptchaService();
        
        let captchaText;
        try {
            const taskId = await captchaService.enviarCaptcha(captchaBuffer);
            captchaText = await captchaService.obterResposta(taskId);
        } catch (err) {
            console.log(`[Teste] Erro: ${err.message}. Recarregando...`);
            await scraper.recarregarCaptcha();
            continue;
        }

        await scraper.submeterCaptcha(captchaText);
        const resultado = await scraper.obterResultado();

        if (resultado.success) {
            console.log(`[Teste - ${servico}] 🎉 SUCESSO! Resultado em: ${resultado.screenshot}`);
            if (resultado.dados) console.log('[Teste] Dados:', JSON.stringify(resultado.dados, null, 2));
            sucesso = true;
        } else {
            console.log(`[Teste - ${servico}] ❌ FALHA: ${resultado.error}`);
            if (resultado.needsBack) {
                await scraper.clicarVoltar();
                // Repreenche conforme o serviço
                if (servico === 'SNG') await scraper.preencherSNG(dadosVeiculo.chassi);
                else if (servico === 'CRLV') await scraper.preencherDados(dadosVeiculo.placa, dadosVeiculo.renavam, dadosVeiculo.cpf);
                else await scraper.preencherDados(dadosVeiculo.placa, dadosVeiculo.renavam);
            } else {
                await scraper.recarregarCaptcha();
            }
        }
    }

  } catch (error) {
    console.error(`[Erro Crítico] ${error.message}`);
  } finally {
    await scraper.close();
  }
}

// Execução sequencial para teste
(async () => {
    const dados = {
        placa: process.env.PLACA_TESTE,
        renavam: process.env.RENAVAM_TESTE,
        chassi: process.env.CHASSI_TESTE,
        cpf: process.env.CPF_TESTE
    };

    console.log('--- INICIANDO TESTE DE CONSULTA DETALHADA ---');
    await testarServico('CONSULTA_DETALHADA', dados);

    console.log('\n--- INICIANDO TESTE DE CRLV ---');
    await testarServico('CRLV', dados);
})();
