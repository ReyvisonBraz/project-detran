const { chromium } = require('playwright');
require('dotenv').config();

async function analyzeCaptchaHTML() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const placa = process.env.PLACA_TESTE;
    const renavam = process.env.RENAVAM_TESTE;
    const cpf = process.env.CPF_TESTE;

    console.log('[ANÁLISE] Navegando para o site do DETRAN-PA...');
    
    try {
        await page.goto('https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/crlv/indexCRLVe.jsf', 
            { waitUntil: 'load', timeout: 60000 });
        
        console.log('[ANÁLISE] Preenchendo dados...');
        
        const placaInput = 'input[id$="placa"], input[placeholder*="Placa"]';
        await page.waitForSelector(placaInput, { state: 'attached', timeout: 30000 });
        await page.fill(placaInput, placa);
        
        const renavamInput = 'input[id$="renavam"], input[placeholder*="Renavam"]';
        await page.fill(renavamInput, renavam);
        
        const cpfInput = 'input[id$="cpf"], input[id$="dnCpf"], input[placeholder*="CPF"]';
        await page.waitForSelector(cpfInput, { timeout: 15000 });
        await page.fill(cpfInput, cpf);
        
        console.log('[ANÁLISE] Aguardando captcha...');
        await page.waitForSelector('img[id$="captcha"]', { timeout: 15000 });
        
        // Extrair o HTML completo do formulário
        const formHTML = await page.evaluate(() => {
            const form = document.querySelector('form');
            return form ? form.outerHTML : document.body.outerHTML;
        });
        
        console.log('[ANÁLISE] ===== HTML DO FORMULÁRIO =====\n');
        console.log(formHTML);
        console.log('\n[ANÁLISE] ===== FIM DO HTML =====\n');
        
        // Procurar por inputs ocultos
        const hiddenInputs = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="hidden"]');
            const result = [];
            inputs.forEach(input => {
                result.push({
                    name: input.name,
                    id: input.id,
                    value: input.value.substring(0, 100)
                });
            });
            return result;
        });
        
        console.log('[ANÁLISE] Inputs ocultos encontrados:');
        hiddenInputs.forEach(input => {
            console.log(`  - name="${input.name}" id="${input.id}" value="${input.value}"`);
        });
        
        // Procurar por informações do captcha
        const captchaInfo = await page.evaluate(() => {
            const captchaImg = document.querySelector('img[id$="captcha"]');
            const captchaInput = document.querySelector('input[id$="captcha"], input[id$="senha"], input[id$="txtCaptcha"], input[placeholder*="sequência"]');
            
            return {
                captchaImg: captchaImg ? {
                    id: captchaImg.id,
                    src: captchaImg.src,
                    alt: captchaImg.alt,
                    title: captchaImg.title,
                    className: captchaImg.className
                } : null,
                captchaInput: captchaInput ? {
                    id: captchaInput.id,
                    name: captchaInput.name,
                    type: captchaInput.type,
                    placeholder: captchaInput.placeholder,
                    className: captchaInput.className,
                    value: captchaInput.value
                } : null
            };
        });
        
        console.log('\n[ANÁLISE] Informações do Captcha:');
        console.log(JSON.stringify(captchaInfo, null, 2));
        
        // Interceptar requisições de rede
        console.log('\n[ANÁLISE] Monitorando requisições de rede...');
        
        page.on('request', request => {
            if (request.url().includes('captcha') || request.url().includes('validar') || request.url().includes('confirmar')) {
                console.log(`[REDE] ${request.method()} ${request.url()}`);
                console.log(`[REDE] Headers: ${JSON.stringify(request.headers())}`);
                console.log(`[REDE] Body: ${request.postData()}`);
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('captcha') || response.url().includes('validar') || response.url().includes('confirmar')) {
                console.log(`[REDE] Response ${response.status()} ${response.url()}`);
            }
        });
        
        // Aguardar um pouco para capturar tráfego
        await page.waitForTimeout(3000);
        
    } catch (error) {
        console.error('[ANÁLISE] Erro:', error.message);
    } finally {
        await browser.close();
    }
}

analyzeCaptchaHTML();
