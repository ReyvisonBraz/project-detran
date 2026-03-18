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

    this.browser = await chromium.launch({ headless: false });
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
    
    // Seletores híbridos (ID parcial e Placeholder)
    const placaInput = 'input[id$="placa"], input[placeholder*="Placa"]';
    const renavamInput = 'input[id$="renavam"], input[placeholder*="Renavam"]';
    
    await this.page.waitForSelector(placaInput, { state: 'attached', timeout: 30000 });
    
    await this.page.fill(placaInput, '');
    await this.page.type(placaInput, placa, { delay: 100 });
    
    await this.page.fill(renavamInput, '');
    await this.page.type(renavamInput, renavam, { delay: 100 });

    if (cpf) {
      console.log(`[Scraper] Preenchendo CPF...`);
      const cpfInput = 'input[id$="cpf"], input[id$="dnCpf"], input[placeholder*="CPF"]';
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
    return await captchaElement.screenshot();
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
    const captchaInput = 'input[id$="captcha"], input[id$="senha"], input[id$="txtCaptcha"], input[placeholder*="sequência"]';
    const confirmarBtn = 'button:has-text("CONFIRMAR"), button:has-text("Confirmar"), input[value="Confirmar"], input[id$="confirma"]';
    
    await this.page.waitForSelector(captchaInput, { timeout: 15000 });
    await this.page.fill(captchaInput, '');
    await this.page.type(captchaInput, texto, { delay: 100 });
    
    await this.page.click(confirmarBtn);
    await this.page.waitForTimeout(4000);
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
        return document.body.innerText.includes('Sequência de caracteres incorreta');
    });

    if (isErrorPage) {
        return { success: false, error: 'Sequência de caracteres incorreta!!', needsBack: true };
    }

    // Botão Prosseguir (Licenciamento)
    const prosseguirSelector = 'button:has-text("Prosseguir"), input[value="Prosseguir"]';
    const hasProsseguir = await this.page.$(prosseguirSelector);
    if (hasProsseguir) {
        console.log('[Scraper] Prosseguindo...');
        await hasProsseguir.click();
        await this.page.waitForTimeout(4000); 
    }

    // PDF/Visualização
    const isDocView = await this.page.evaluate(() => {
        return !!document.querySelector('embed[type="application/pdf"]') || 
               !!document.querySelector('iframe') ||
               document.body.innerText.includes('Visualização do Documento');
    });

    if (isDocView) {
        console.log('[Scraper] Documento disponível.');
        const screenshotPath = `documento_${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        return { success: true, isDocument: true, screenshot: screenshotPath };
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
    console.log('[Scraper] Voltando...');
    const voltarSelector = 'a:has-text("Voltar"), button:has-text("Voltar")';
    await this.page.click(voltarSelector);
    await this.page.waitForTimeout(2000);
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = DetranPaScraper;
