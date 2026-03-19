const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function generateCRLVPDF() {
    const scraper = new DetranPaScraper();
    const solver = new TwoCaptchaService();
    
    const placa = process.env.PLACA_TESTE;
    const renavam = process.env.RENAVAM_TESTE;
    const cpf = process.env.CPF_TESTE;

    console.log(`\n[GERADOR] Iniciando emissão de CRLV para Placa: ${placa}, Renavam: ${renavam}, CPF: ${cpf}\n`);

    try {
        await scraper.init('CRLV');
        console.log('[GERADOR] Preenchendo dados do formulário...');
        await scraper.preencherDados(placa, renavam, cpf);

        let resolved = false;
        let attempts = 0;
        const maxAttempts = 3;
        let finalResult = null;

        while (!resolved && attempts < maxAttempts) {
            attempts++;
            console.log(`\n[GERADOR] Tentativa ${attempts}/${maxAttempts} de resolver captcha...\n`);
            
            const captchaBuffer = await scraper.capturarCaptcha();
            const captchaText = await solver.resolverCaptcha(captchaBuffer);

            if (!captchaText) {
                console.log('[GERADOR] Captcha vazio, recarregando...');
                await scraper.recarregarCaptcha();
                continue;
            }

            await scraper.submeterCaptcha(captchaText);
            finalResult = await scraper.obterResultado();

            if (finalResult.success) {
                console.log('\n[GERADOR] ✅ Sucesso! Documento gerado com sucesso!\n');
                resolved = true;
            } else if (finalResult.error === 'Captcha incorreto') {
                console.log('[GERADOR] ❌ Captcha incorreto, tentando novamente...');
                if (finalResult.needsBack) await scraper.clicarVoltar();
            } else {
                console.log('[GERADOR] ❌ Erro fatal:', finalResult.error);
                break;
            }
        }

        if (resolved && finalResult) {
            console.log('[GERADOR] Arquivos gerados:');
            if (finalResult.screenshot) {
                console.log(`  - Screenshot: ${finalResult.screenshot}`);
            }
            if (finalResult.pdf) {
                console.log(`  - PDF: ${finalResult.pdf}`);
                const pdfPath = path.join(__dirname, finalResult.pdf);
                if (fs.existsSync(pdfPath)) {
                    const stats = fs.statSync(pdfPath);
                    console.log(`  - Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
                    console.log(`  - Caminho completo: ${pdfPath}`);
                    return finalResult;
                }
            }
        } else {
            console.log('[GERADOR] ❌ Falha ao gerar CRLV após máximo de tentativas');
        }

        return finalResult;
    } catch (error) {
        console.error('[GERADOR] ❌ Erro no processo:', error.message);
        return null;
    } finally {
        await scraper.close();
    }
}

generateCRLVPDF().then(result => {
    if (result && result.pdf) {
        console.log('\n[GERADOR] ✅ Processo concluído com sucesso!');
        process.exit(0);
    } else {
        console.log('\n[GERADOR] ❌ Processo falhou');
        process.exit(1);
    }
});
