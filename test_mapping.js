const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
require('dotenv').config();

async function runTest() {
    process.env.MANUAL_CAPTCHA = 'true'; // Ativa modo manual para teste

    const scraper = new DetranPaScraper();
    const solver = new TwoCaptchaService();

    try {
        // Testando com CRLV Digital
        await scraper.init('CRLV');
        
        // Dados de teste: Placa/Renavam válidos + CPF PROPRIETÁRIO
        const placa = 'OFK3A50'; 
        const renavam = '00408146338';
        const cpf = '89787161215'; // CPF correto
        
        await scraper.preencherDados(placa, renavam, cpf);

        console.log('[Test] Por favor, resolva o captcha no terminal se solicitado ou aguarde...');
        
        const captchaBuffer = await scraper.capturarCaptcha();
        const fs = require('fs');
        fs.writeFileSync('captcha_test.png', captchaBuffer);
        console.log('[Test] Captcha salvo em captcha_test.png');

        const captchaText = await solver.resolverCaptcha(captchaBuffer);

        if (!captchaText) {
            console.error('[Test] Sem texto de captcha.');
            return;
        }

        await scraper.submeterCaptcha(captchaText);
        
        console.log('[Test] Verificando resultado e avanço...');
        const result = await scraper.obterResultado();
        
        console.log('[Test] Resultado Final:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('[Test] Erro durante o teste:', error);
    } finally {
        // await scraper.close(); // Comente se quiser ver o que sobrou no browser (se headful)
    }
}

runTest();
