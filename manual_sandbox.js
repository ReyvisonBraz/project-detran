const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runSandbox() {
    console.log('--------------------------------------------------');
    console.log('🧪 SANDBOX MANUAL INICIADO 🧪');
    console.log('Instruções:');
    console.log('1. Uma janela do Chrome vai abrir em 3 segundos.');
    console.log('2. Faça o preenchimento manualmente, resolva o Captcha você mesmo.');
    console.log('3. Clique em Confirmar.');
    console.log('4. No momento que o documento aparecer na tela, o robô vai salvar o arquivo.');
    console.log('--------------------------------------------------\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let pdfBuffer = null;
    let pdfUrlToDownload = null;

    // Novo: Escuta por eventos de download explícitos (clique do usuário no botão)
    page.on('download', async download => {
        console.log(`\n📥 [Download] !!! EVENTO DE DOWNLOAD DETECTADO !!! -> ${download.url()}`);
        const path = await download.path();
        const buffer = fs.readFileSync(path);
        const filename = `manual_CRLV_clique_${Date.now()}.pdf`;
        fs.writeFileSync(filename, buffer);
        console.log(`✅ [SUCESSO] PDF salvo via evento de download: ${filename} (${buffer.length} bytes)`);
    });

    // Escuta a rede exatamente como o robô de produção
    page.on('response', async response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('application/pdf') || 
            (url.includes('indexCRLVe.jsf') && contentType.includes('application/octet-stream'))) {
            
            console.log(`\n🔔 [Rede] !!! PDF DETECTADO !!! -> ${url.substring(0, 80)}...`);
            pdfUrlToDownload = url;

            try {
                const buffer = await response.body();
                // Ignora se for muito pequeno (wrapper HTML de 536 bytes)
                if (buffer.length > 2000) {
                    pdfBuffer = buffer;
                    const filename = `manual_CRLV_rede_${Date.now()}.pdf`;
                    fs.writeFileSync(filename, pdfBuffer);
                    console.log(`✅ [SUCESSO] PDF Salvo via Rede: ${filename} (${pdfBuffer.length} bytes)`);
                } else {
                    console.log(`ℹ️ [Info] Ignorando buffer pequeno (${buffer.length} bytes) - provável visualizador.`);
                }
            } catch (e) {
                console.log(`⚠️ [Aviso] Protocolo bloqueou leitura direta: ${e.message}`);
                console.log(`🔄 [Estratégia 1] Tentando download paralelo via session cookies...`);
                try {
                    const fallbackResponse = await page.request.get(url);
                    const bufferFallback = await fallbackResponse.body();
                    if (bufferFallback.length > 2000) {
                         const filename2 = `manual_CRLV_fallback_${Date.now()}.pdf`;
                         fs.writeFileSync(filename2, bufferFallback);
                         console.log(`✅ [SUCESSO] PDF baixado via fallback: ${filename2} (${bufferFallback.length} bytes)`);
                    }
                } catch (err) {
                    console.error(`❌ [Erro] Falha no download paralelo: ${err.message}`);
                }
            }
        }
    });

    const url = 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/crlv/indexCRLVe.jsf';
    await page.goto(url);

    console.log('👀 Navegador Aberto. Estamos em escuta de downloads de PDF...');
    console.log('O script ficará aberto por 3 minutos para você testar.');

    // Espera 3 minutos para deixar o usuário brincar
    await page.waitForTimeout(180000); 
    await browser.close();
    console.log('\n⌛ Sandbox finalizado por tempo limite.');
}

runSandbox();
