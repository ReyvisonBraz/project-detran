const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FileUtils = require('../utils/fileUtils');
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
    this.currentPlaca = null;
    this.pdfBuffer = null; // Para armazenar o PDF capturado
    this.tempDir = path.join(__dirname, '../../temp');
    FileUtils.ensureDir(this.tempDir);
  }

  /**
   * Inicializa o navegador e acessa a URL do serviço desejado.
   * @param {string} servico Nome do serviço (chave de DETRAN_URLS)
   * @param {object} options Opções de inicialização (ex: { headless: false })
   */
  async init(servico = 'CONSULTA_DETALHADA', options = { headless: true }) {
    this.currentService = servico;
    const url = DETRAN_URLS[servico] || DETRAN_URLS.CONSULTA_DETALHADA;
    console.log(`[Scraper] Iniciando navegador para serviço: ${servico}...`);

    if (this.browser) await this.browser.close();

    this.browser = await chromium.launch({ headless: options.headless });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    if (process.env.ENABLE_TRACE === 'true') {
      console.log('[Scraper] Habilitando Tracing do Playwright...');
      await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    }

    // Interceptador para capturar o PDF do CRLV
    this.pdfBuffer = null;
    this.pdfUrlToDownload = null;
    this.downloadEventReceived = null;

    // Escuta por eventos de download explícitos (clique no botão)
    this.page.on('download', async download => {
      console.log(`[Scraper] !!! EVENTO DE DOWNLOAD DETECTADO !!! -> ${download.url()}`);
      this.downloadEventReceived = download;
      try {
        const downloadPath = await download.path();
        this.pdfBuffer = fs.readFileSync(downloadPath);
        console.log(`[Scraper] PDF capturado via evento 'download': ${this.pdfBuffer.length} bytes`);
      } catch (err) {
        console.error(`[Scraper] Erro ao processar download: ${err.message}`);
      }
    });

    this.page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Filtra apenas o que realmente parece um PDF ou binário de documento
      if (contentType.includes('application/pdf') ||
        (url.includes('indexCRLVe.jsf') && contentType.includes('application/octet-stream'))) {
        
        console.log(`[Scraper] !!! PDF POSSÍVEL DETECTADO (Rede) !!! -> ${url.substring(0, 100)}`);
        this.pdfUrlToDownload = url;

        try {
          const buffer = await response.body();
          // Evita sobrescrever se for um arquivo muito pequeno (como o wrapper HTML de 536 bytes)
          if (buffer.length > 2000) {
            this.pdfBuffer = buffer;
            console.log(`[Scraper] Buffer do PDF capturado via Rede: ${this.pdfBuffer.length} bytes`);
          } else {
            console.log(`[Scraper] Ignorando buffer pequeno demais (${buffer.length} bytes) - provável wrapper.`);
          }
        } catch (e) {
          // Silencioso se o corpo não puder ser lido (ex: download já iniciado)
        }
      }
    });

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
    this.currentPlaca = placa; // Guarda para nomear arquivos depois

    // Seletores híbridos (ID parcial e Placeholder)
    const placaInput = 'input[id*="placa"], input[placeholder*="Placa"], input#placa';
    const renavamInput = 'input[id*="renavam"], input[placeholder*="Renavam"], input#renavam';
    const cpfInput = 'input#cpfCnpj, input[id$="cpf"], input[placeholder*="CPF"]';

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
    await this.page.waitForTimeout(1000);
    
    const buffer = await captchaElement.screenshot();

    // Validar que a imagem não está vazia
    if (!buffer || buffer.length === 0) {
      throw new Error('Captcha screenshot vazio');
    }

    // Opcional: Salvar cópia local para depuração
    const debugPath = path.join(this.tempDir, `captcha_debug_${Date.now()}.png`);
    await fs.promises.writeFile(debugPath, buffer);

    console.log(`[Scraper] Captcha capturado com sucesso (${buffer.length} bytes)`);
    return buffer;
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
    const captchaInput = 'input[id*="captcha"], input#senha, input[id$="senha"], input[placeholder*="sequência"]';
    const confirmarBtn = 'input#confirma, button:has-text("CONFIRMAR"), button:has-text("Confirmar"), input[value="Confirmar"]';

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

    const errorStrings = [
      'Sequência de caracteres incorreta',
      'Veículo não encontrado',
      'Dados divergentes',
      'Sessão expirada',
      'Erro ao processar',
      'Sistema indisponível',
      'não existe no cadastro',
      'não pertence ao renavam',
      'Renavam Inválido',
      'não é proprietário',
      'não é o proprietário',
      'não é do proprietário',
      'não pertence ao proprietário',
      'Documento informado',
      'Contra-senha não confere com a imagem'
    ];

    const errorDetected = await this.page.evaluate((strings) => {
      const text = document.body.innerText;
      return strings.find(s => text.includes(s));
    }, errorStrings);

    if (errorDetected) {
      console.log(`[Scraper] Erro detectado na página: "${errorDetected}"`);
      return { success: false, error: errorDetected, needsBack: true };
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
      'button:has-text("Guia de Recolhimento")',
      'button:has-text("Avançar")',
      'button:has-text("AVANÇAR")',
      'input[value*="Avançar"]',
      'input[value*="AVANÇAR"]',
      'button:has-text("2ª via")',
      'a:has-text("2ª via")',
      'button:has-text("Emitir")',
      'input[value="Emitir"]'
    ];

    let buttonFound = false;
    for (const selector of prosseguirSelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            console.log(`[Scraper] Encontrei ação: "${selector}". Clicando para avançar...`);
            await btn.click();
            buttonFound = true;
            // Espera generosa para carregamento da próxima etapa/mapping
            await this.page.waitForTimeout(6000);
            console.log(`[Scraper] Avançado para URL: ${this.page.url()}`);
            break;
          }
        }
      } catch (err) {
        // Silencioso se o seletor for inválido ou não estiver presente
      }
    }

    if (buttonFound) {
      console.log('[Scraper] Capturando tela após avançar para mapeamento...');
      const mappingPath = path.join(this.tempDir, `mapping_${Date.now()}.png`);
      await this.page.screenshot({ path: mappingPath, fullPage: true });
      console.log(`[Scraper] Print de mapeamento salvo em: ${mappingPath}`);
      return { success: true, screenshot: mappingPath, isMapping: true };
    }

    // PDF/Visualização - Aguarda um pouco para o PDF carregar se necessário
    await this.page.waitForTimeout(3000);
    const { isDocView, docSrc, currentUrl } = await this.page.evaluate(() => {
      // Se houver campos de busca, ainda estamos no formulário!
      const hasInputs = !!document.querySelector('#placa') || !!document.querySelector('#renavam');
      if (hasInputs) return { isDocView: false, docSrc: null, currentUrl: window.location.href };

      const embed = document.querySelector('embed[type="application/pdf"]');
      const iframe = document.querySelector('iframe');
      const viewer = document.querySelector('#viewer');
      const text = document.body.innerText;
      
      const hasText = text.includes('Visualização do Documento') || 
                      text.includes('CERTIFICADO DE REGISTRO') ||
                      text.includes('CRLV-e');
                      
      const urlMatch = window.location.href.includes('jsessionid') && 
                      (window.location.href.includes('CRLVe') || window.location.href.includes('pdf'));
      
      const docSrc = (embed && embed.src) || (iframe && iframe.src) || null;
      const isDoc = !!embed || !!iframe || !!viewer || (text.length > 0 && hasText) || urlMatch;
      return { isDocView: isDoc, docSrc, currentUrl: window.location.href };
    });

    if (isDocView) {
      console.log(`[Scraper] Documento Visualizado em: ${currentUrl}`);
      
      // Estratégia 1: Download via URL capturada na rede (Mais forte)
      if (!this.pdfBuffer && this.pdfUrlToDownload) {
        console.log(`[Scraper] Tentando baixar PDF via URL interceptada: ${this.pdfUrlToDownload}`);
        try {
          const response = await this.page.request.get(this.pdfUrlToDownload);
          this.pdfBuffer = await response.body();
          console.log(`[Scraper] Download via page.request.get(pdfUrl) concluído: ${this.pdfBuffer.length} bytes`);
        } catch (e) {
          console.log(`[Scraper] Falha ao baixar via page.request.get(pdfUrl): ${e.message}`);
        }
      }

      // Estratégia 2: Download via src do iframe/embed
      if (!this.pdfBuffer && docSrc) {
        console.log(`[Scraper] Tentando baixar PDF da fonte DOM: ${docSrc}`);
        try {
          const response = await this.page.request.get(docSrc);
          this.pdfBuffer = await response.body();
          console.log(`[Scraper] Download via page.request.get(docSrc) concluído: ${this.pdfBuffer.length} bytes`);
        } catch (e) {
          console.log(`[Scraper] Falha ao baixar via page.request.get(docSrc): ${e.message}`);
        }
      }
      
      // Estratégia 3: Fallback page.pdf() se nada mais funcionar
      if (!this.pdfBuffer) {
        console.log('[Scraper] Usando fallback page.pdf()...');
        try {
          this.pdfBuffer = await this.page.pdf({ format: 'A4', printBackground: true });
          console.log(`[Scraper] PDF gerado via page.pdf(): ${this.pdfBuffer.length} bytes`);
        } catch (e) {
          console.log(`[Scraper] Erro no fallback page.pdf(): ${e.message}`);
        }
      }

      console.log('[Scraper] Documento disponível.');
      
      // Aguarda até o PDF buffer ser preenchido (máximo 5 segundos adicionais)
      let waitAttempts = 0;
      while (!this.pdfBuffer && waitAttempts < 5) {
        console.log(`[Scraper] Aguardando buffer do PDF (tentativa ${waitAttempts + 1}/5)...`);
        await this.page.waitForTimeout(1000);
        waitAttempts++;
      }

      const plateStr = this.currentPlaca ? `_${this.currentPlaca}` : '';
      const timestamp = Date.now();
      const screenshotPath = path.join(this.tempDir, `documento_CRLV${plateStr}_${timestamp}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });

      let pdfPath = null;
      if (this.pdfBuffer) {
        pdfPath = path.join(this.tempDir, `documento_CRLV${plateStr}_${timestamp}.pdf`);
        fs.writeFileSync(pdfPath, this.pdfBuffer);
        console.log(`[Scraper] PDF salvo com sucesso em: ${pdfPath}`);
      } else {
        console.warn('[Scraper] ATENÇÃO: Documento detectado mas buffer do PDF está vazio!');
      }

      return {
        success: true,
        isDocument: true,
        screenshot: screenshotPath,
        pdfPath: pdfPath,
        shareableUrl: currentUrl // Link temporário com session
      };
    }

    const dados = await this.extrairDadosVeiculo();
    const resultScreenshot = path.join(this.tempDir, `resultado_${Date.now()}.png`);
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
    if (process.env.ENABLE_TRACE === 'true' && this.context) {
      const tracePath = path.join(this.tempDir, `trace_${this.currentService || 'service'}_${Date.now()}.zip`);
      await this.context.tracing.stop({ path: tracePath });
      console.log(`[Scraper] Trace salvo com sucesso em: ${tracePath}`);
    }
    if (this.browser) await this.browser.close();
  }
}

module.exports = DetranPaScraper;
