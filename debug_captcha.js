const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function debugCaptcha() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const placa = process.env.PLACA_TESTE;
    const renavam = process.env.RENAVAM_TESTE;
    const cpf = process.env.CPF_TESTE;

    console.log('[DEBUG] Navegando para o site do DETRAN-PA...');
    
    try {
        await page.goto('https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/crlv/indexCRLVe.jsf', 
            { waitUntil: 'load', timeout: 60000 });
        
        console.log('[DEBUG] Preenchendo dados...');
        
        // Preencher placa
        const placaInput = 'input[id$="placa"], input[placeholder*="Placa"]';
        await page.waitForSelector(placaInput, { state: 'attached', timeout: 30000 });
        await page.fill(placaInput, placa);
        
        // Preencher renavam
        const renavamInput = 'input[id$="renavam"], input[placeholder*="Renavam"]';
        await page.fill(renavamInput, renavam);
        
        // Preencher CPF
        const cpfInput = 'input[id$="cpf"], input[id$="dnCpf"], input[placeholder*="CPF"]';
        await page.waitForSelector(cpfInput, { timeout: 15000 });
        await page.fill(cpfInput, cpf);
        
        console.log('[DEBUG] Aguardando captcha...');
        
        // Esperar o captcha carregar
        await page.waitForSelector('img[id$="captcha"]', { timeout: 15000 });
        
        // Tirar screenshot da página inteira
        await page.screenshot({ path: 'debug_page_full.png', fullPage: true });
        console.log('[DEBUG] Screenshot da página salvo: debug_page_full.png');
        
        // Capturar apenas a imagem do captcha
        const captchaElement = await page.$('img[id$="captcha"]');
        if (captchaElement) {
            const captchaBuffer = await captchaElement.screenshot();
            fs.writeFileSync('debug_captcha_image.png', captchaBuffer);
            console.log('[DEBUG] Imagem do captcha salva: debug_captcha_image.png');
            console.log(`[DEBUG] Tamanho da imagem: ${captchaBuffer.length} bytes`);
            
            // Verificar informações do elemento
            const boundingBox = await captchaElement.boundingBox();
            console.log('[DEBUG] Bounding box do captcha:', boundingBox);
            
            // Verificar atributos
            const src = await captchaElement.getAttribute('src');
            const id = await captchaElement.getAttribute('id');
            console.log('[DEBUG] ID do captcha:', id);
            console.log('[DEBUG] SRC do captcha:', src ? src.substring(0, 100) + '...' : 'N/A');
        } else {
            console.log('[DEBUG] ❌ Elemento de captcha não encontrado!');
        }
        
        // Verificar se há outros elementos de imagem na página
        const allImages = await page.$$('img');
        console.log(`[DEBUG] Total de imagens na página: ${allImages.length}`);
        
        for (let i = 0; i < allImages.length; i++) {
            const alt = await allImages[i].getAttribute('alt');
            const id = await allImages[i].getAttribute('id');
            const src = await allImages[i].getAttribute('src');
            if (alt || id) {
                console.log(`  [${i}] alt="${alt}" id="${id}" src="${src ? src.substring(0, 50) : 'N/A'}"`);
            }
        }
        
    } catch (error) {
        console.error('[DEBUG] Erro:', error.message);
    } finally {
        await browser.close();
    }
}

debugCaptcha();
