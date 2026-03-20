const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runInteractiveTest() {
    process.env.MANUAL_CAPTCHA = 'true'; // Usaremos manual para você ver o código que digito!
    const scraper = new DetranPaScraper();
    const solver = new TwoCaptchaService();
    const tempDir = path.join(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    try {
        console.log('[VisualTest] 1. Iniciando navegador VISÍVEL...');
        await scraper.init('CRLV', { headless: false });

        const placa = 'OFK3A50'; 
        const renavam = '00408146338';
        const cpf = '89787161215';

        console.log('[VisualTest] 2. Preenchendo campos...');
        await scraper.preencherDados(placa, renavam, cpf);
        
        // Print 1: Tela com dados preenchidos
        await scraper.page.screenshot({ path: path.join(tempDir, 'step1_preenchido.png') });
        console.log('[VisualTest] -> Print 1 salvo: Dados preenchidos.');

        console.log('[VisualTest] 3. Lendo CAPTCHA...');
        const captchaBuffer = await scraper.capturarCaptcha();
        fs.writeFileSync(path.join(tempDir, 'step2_captcha.png'), captchaBuffer);
        console.log('[VisualTest] -> Print 2 salvo: Imagem do Captcha.');

        const captchaText = await solver.resolverCaptcha(captchaBuffer);
        console.log(`[VisualTest] 4. Resolvendo CAPTCHA: ${captchaText}`);

        if (!captchaText) {
            console.error('[VisualTest] Sem captcha.');
            await scraper.close();
            return;
        }

        await scraper.submeterCaptcha(captchaText);
        
        // Print 2: Após clique em confirmar
        await scraper.page.waitForTimeout(2000); 
        await scraper.page.screenshot({ path: path.join(tempDir, 'step3_submetido.png') });
        console.log('[VisualTest] -> Print 3 salvo: Submissão (aguardando documento).');

        console.log('[VisualTest] 5. Processando resultado...');
        const result = await scraper.obterResultado();
        
        console.log('[VisualTest] 📊 RESULTADO FINAL:', JSON.stringify(result, null, 2));

        // Print final
        if (result.screenshot) {
            fs.copyFileSync(result.screenshot, path.join(tempDir, 'step4_final.png'));
            console.log('[VisualTest] -> Print 4 salvo: Sucesso do Documento.');
        }

        await scraper.close();
    } catch (e) {
        console.error('[VisualTest] ERRO:', e);
        await scraper.close();
    }
}

runInteractiveTest();
