const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testCRLVWithDebug() {
    const scraper = new DetranPaScraper();
    const solver = new TwoCaptchaService();
    
    const placa = process.env.PLACA_TESTE;
    const renavam = process.env.RENAVAM_TESTE;
    const cpf = process.env.CPF_TESTE;

    console.log(`\n[TESTE] Iniciando teste de CRLV para Placa: ${placa}, Renavam: ${renavam}, CPF: ${cpf}\n`);

    try {
        await scraper.init('CRLV');
        await scraper.preencherDados(placa, renavam, cpf);

        let resolved = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!resolved && attempts < maxAttempts) {
            attempts++;
            console.log(`\n[TESTE] ========== TENTATIVA ${attempts}/${maxAttempts} ==========\n`);
            
            // Capturar captcha
            const captchaBuffer = await scraper.capturarCaptcha();
            
            // Salvar imagem do captcha para debug
            const captchaDebugPath = `captcha_attempt_${attempts}.png`;
            fs.writeFileSync(captchaDebugPath, captchaBuffer);
            console.log(`[TESTE] Captcha salvo em: ${captchaDebugPath}`);
            
            // Enviar para 2Captcha
            console.log('[TESTE] Enviando para 2Captcha...');
            const captchaText = await solver.resolverCaptcha(captchaBuffer);

            if (!captchaText) {
                console.log('[TESTE] ❌ Captcha vazio, recarregando...');
                await scraper.recarregarCaptcha();
                continue;
            }

            console.log(`[TESTE] ✅ Captcha resolvido: ${captchaText}`);
            
            // Submeter captcha
            console.log('[TESTE] Submetendo captcha...');
            await scraper.submeterCaptcha(captchaText);
            
            // Verificar resultado
            console.log('[TESTE] Verificando resultado...');
            const result = await scraper.obterResultado();

            if (result.success) {
                console.log('\n[TESTE] ✅ SUCESSO! Documento gerado com sucesso!\n');
                console.log('[TESTE] Resultado:', result);
                resolved = true;
            } else if (result.error === 'Captcha incorreto') {
                console.log(`[TESTE] ❌ Captcha incorreto (${captchaText}), tentando novamente...`);
                if (result.needsBack) await scraper.clicarVoltar();
            } else {
                console.log('[TESTE] ❌ Erro fatal:', result.error);
                break;
            }
        }

        if (!resolved) {
            console.log('\n[TESTE] ❌ Falha ao gerar CRLV após máximo de tentativas\n');
        }
    } catch (error) {
        console.error('[TESTE] ❌ Erro no teste:', error.message);
    } finally {
        await scraper.close();
    }
}

testCRLVWithDebug();
