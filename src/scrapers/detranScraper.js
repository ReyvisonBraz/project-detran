const { chromium } = require('playwright');
const path = require('path');
require('dotenv').config();

/**
 * URLs dos serviços do DETRAN-PA
 */
const DETRAN_URLS = {
  CONSULTA_DETALHADA: 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/veiculos/indexRenavam.jsf',
  LICENCIAMENTO_ATUAL: 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/b/indexBLicencAnoAtual.jsf',
  LICENCIAMENTO_ANTERIOR: 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/b/indexBLicencAnoAnterior.jsf',
  SNG: 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/veiculos/indexSNG.jsf',
  CRLV: 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/crlv/indexCRLVe.jsf'
};

/**
 * Classe responsável por navegar no portal do DETRAN-PA.
 */
class DetranPaScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.currentService = 'CONSULTA_DETALHADA';
  }

  /**
   * Inicializa o navegador e acessa a URL do serviço desejado.
   * @param {string} servico Nome do serviço (chave de DETRAN_URLS)
   */
  async init(servico = 'CONSULTA_DETALHADA') {
    this.currentService = servico;
    const url = DETRAN_URLS[servico] || DETRAN_URLS.CONSULTA_DETALHADA;
    console.log(`[Scraper] Iniciando navegador para serviço: ${servico}...`);
    
    if (this.browser) await this.browser.close();

    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    console.log(`[Scraper] Navegando para ${url}...`);
    try {
        await this.page.goto(url, { waitUntil: 'load', timeout: 60000 });
    } catch (e) {
        console.warn(`[Scraper] Alerta: Tempo de carregamento excedido, prosseguindo mesmo assim...`);
    }
  }

  /**
   * Preenche os dados comuns (Placa e Renavam).
   */
  async preencherDados(placa, renavam, cpf = null) {
    console.log(`[Scraper] Preenchendo dados básicos...`);
        // Seletores corretos para o formulário DETRAN-PA
    const placaInput = 'input#placa';
    const renavamInput = 'input#renavam';
    const cpfInput = 'input#cpfCnpj';
    
    await this.page.waitForSelector(placaInput, { state: 'attached', timeout: 30000 });
    
    await this.page.fill(placaInput, '');
    await this.page.type(placaInput, placa, { delay: 100 });
    
    await this.page.fill(renavamInput, '');
    await this.page.type(renavamInput, renavam, { delay: 100 });

    if (cpf) {
      console.log(`[Scraper] Preenchendo CPF...`);
      await this.page.waitForSelector(cpfInput, { timeout: 15000 });
      await this.page.fill(cpfInput, '');
      await this.page.type(cpfInput, cpf, { delay: 100 });
    }
  }

  /**
   * Preenche dados específicos para consulta SNG (Chassi).
   */
  async preencherSNG(chassi) {
    console.log(`[Scraper] Preenchendo Chassi para SNG...`);
    const chassiInput = 'input[id$="chassi"]';
    await this.page.waitForSelector(chassiInput, { timeout: 15000 });
    await this.page.fill(chassiInput, '');
    await this.page.type(chassiInput, chassi, { delay: 100 });
  }

  /**
   * Captura a imagem do captcha em memória (Buffer).
   */
  async capturarCaptcha() {
    console.log('[Scraper] Capturando imagem do captcha em memória...');
    const captchaElement = await this.page.waitForSelector('img[id$="captcha"]', { timeout: 15000 });
    
    // Aguardar um pouco para garantir que a imagem está totalmente carregada
    await this.page.waitForTimeout(2000);
    
    // Tirar screenshot do elemento
    const screenshot = await captchaElement.screenshot();
    
    // Validar que a imagem não está vazia
    if (!screenshot || screenshot.length === 0) {
      throw new Error('Captcha screenshot vazio');
    }
    
    console.log(`[Scraper] Captcha capturado com sucesso (${screenshot.length} bytes)`);
    return screenshot;
  }

  /**
   * Recarrega a imagem do captcha.
   */
  async recarregarCaptcha() {
    console.log('[Scraper] Recarregando imagem do captcha...');
    const reloadButton = 'a[title="Atualizar"]';
    await this.page.click(reloadButton);
    await this.page.waitForTimeout(2000); 
  }

  /**
   * Insere o texto do captcha e clica em Confirmar.
   */
  async submeterCaptcha(texto) {
    console.log(`[Scraper] Inserindo captcha: ${texto}...`);
    const captchaInput = 'input#senha';
    const confirmarBtn = 'input#confirma';
    
    await this.page.waitForSelector(captchaInput, { timeout: 15000 });
    await this.page.fill(captchaInput, '');
    await this.page.type(captchaInput, texto, { delay: 100 });
    
    // Aguardar um pouco antes de clicar para garantir que o valor foi preenchido
    await this.page.waitForTimeout(1000);
    
    await this.page.click(confirmarBtn);
    await this.page.waitForTimeout(5000);
  }

  /**
   * Verifica o resultado final.
   */
  async obterResultado() {
    console.log('[Scraper] Verificando resultado da submissão...');
    
    const errorSelector = '.ui-messages-error-detail, li[role="alert"]';
    const hasError = await this.page.$(errorSelector);

    if (hasError) {
      const errorText = await hasError.innerText();
      console.log(`[Scraper] Erro detectado: ${errorText}`);
      return { success: false, error: errorText };
    }

    const isErrorPage = await this.page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Sequência de caracteres incorreta') || 
               text.includes('Contra-senha não confere com a imagem');
    });

    if (isErrorPage) {
        console.log('[Scraper] Captcha incorreto detectado.');
        return { success: false, error: 'Captcha incorreto', needsBack: false };
    }

    // Aguardar o processamento do DETRAN ("AGUARDE, CONSULTANDO DADOS...")
    const loadingText = await this.page.evaluate(() => {
        return document.body.innerText.includes('AGUARDE, CONSULTANDO DADOS');
    });
    
    if (loadingText) {
        console.log('[Scraper] Detectado processamento em andamento, aguardando conclusão...');
        // Aguardar até 30 segundos pelo resultado
        for (let i = 0; i < 30; i++) {
            await this.page.waitForTimeout(1000);
            const stillLoading = await this.page.evaluate(() => {
                return document.body.innerText.includes('AGUARDE, CONSULTANDO DADOS');
            });
            if (!stillLoading) {
                console.log('[Scraper] Processamento concluído!');
                break;
            }
        }
    }
    
    // Botão Prosseguir / Continuar / Imprimir (Licenciamento e outros)
    const prosseguirSelectors = [
      'button:has-text("Prosseguir")', 
      'input[value="Prosseguir"]',
      'button:has-text("Continuar")',
      'input[value="Continuar"]',
      'button:has-text("Imprimir")',
      'input[value="Imprimir"]',
      'a:has-text("Imprimir Boleto")',
      'button:has-text("Guia de Recolhimento")'
    ];

    for (const selector of prosseguirSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
            const isVisible = await btn.isVisible();
            if (isVisible) {
                console.log(`[Scraper] Encontrei ação: ${selector}. Clicando...`);
                await btn.click();
                await this.page.waitForTimeout(4000); // Espera carregamento da próxima etapa
                break;
            }
        }
    }

    // PDF/Visualização
    const isDocView = await this.page.evaluate(() => {
        return !!document.querySelector('embed[type="application/pdf"]') || 
               !!document.querySelector('iframe') ||
               document.body.innerText.includes('Visualização do Documento');
    });

    if (isDocView) {
        console.log('[Scraper] Documento disponível.');
        
        // Tentar capturar o PDF se for um embed ou se houver link de download
        const pdfUrl = await this.page.evaluate(() => {
            const embed = document.querySelector('embed[type="application/pdf"]');
            if (embed) return embed.src;
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.src.endsWith('.pdf')) return iframe.src;
            return null;
        });

        let pdfPath = null;
        if (pdfUrl) {
            console.log(`[Scraper] PDF URL encontrada: ${pdfUrl}`);
            // Em alguns casos o PDF é gerado dinamicamente, podemos tentar salvar a página como PDF
            // ou baixar a URL se for direta.
        }

        // Fallback: Salvar a página como PDF (Playwright suporta isso nativamente)
        pdfPath = `crlv_${Date.now()}.pdf`;
        await this.page.pdf({ path: pdfPath, format: 'A4' });
        console.log(`[Scraper] PDF salvo em: ${pdfPath}`);

        const screenshotPath = `documento_${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        return { success: true, isDocument: true, screenshot: screenshotPath, pdf: pdfPath };
    }

    const dados = await this.extrairDadosVeiculo();
    const resultScreenshot = `resultado_${Date.now()}.png`;
    await this.page.screenshot({ path: resultScreenshot, fullPage: true });
    
    return { success: true, screenshot: resultScreenshot, dados };
  }

  /**
   * Extração de dados via DOM.
   */
  async extrairDadosVeiculo() {
    return await this.page.evaluate(() => {
        const extrairValor = (label) => {
            const cells = Array.from(document.querySelectorAll('td, span, label'));
            const found = cells.find(c => c.innerText.includes(label));
            if (!found) return null;
            
            const next = found.nextElementSibling;
            return next ? next.innerText.trim() : found.innerText.split(label)[1]?.trim() || null;
        };

        return {
            proprietario: extrairValor('NOME'),
            placa: extrairValor('PLACA'),
            renavam: extrairValor('RENAVAM'),
            chassi: extrairValor('CHASSI'),
            status: extrairValor('STATUS') || extrairValor('SITUAÇÃO')
        };
    });
  }

  async clicarVoltar() {
    console.log('[Scraper] Tentando voltar...');
    const voltarSelector = 'a:has-text("Voltar"), button:has-text("Voltar"), input[value="Voltar"]';
    
    try {
        const btn = await this.page.waitForSelector(voltarSelector, { timeout: 5000 }).catch(() => null);
        if (btn) {
            await btn.click();
        } else {
            console.log('[Scraper] Botão voltar não encontrado via seletor, usando navegação do browser...');
            await this.page.goBack();
        }
        await this.page.waitForTimeout(2000);
    } catch (error) {
        console.warn(`[Scraper] Erro ao tentar voltar: ${error.message}`);
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = DetranPaScraper;
