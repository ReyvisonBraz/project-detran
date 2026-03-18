const { chromium } = require('playwright');
require('dotenv').config();

/**
 * Classe responsável por navegar no portal do DETRAN-PA e realizar a Consulta Detalhada.
 */
class DetranPaScraper {
  constructor() {
    this.url = 'https://sistemas-renavam.detran.pa.gov.br/sistransito/detran-web/servicos/veiculos/indexRenavam.jsf';
    this.browser = null;
    this.page = null;
  }

  /**
   * Inicializa o navegador Chromium.
   */
  async init() {
    console.log('[Scraper] Iniciando navegador...');
    this.browser = await chromium.launch({ headless: false }); // Navegador visível para o teste
    this.page = await this.browser.newPage();
  }

  /**
   * Acessa a página de consulta e preenche os dados do veículo.
   * @param {string} placa 
 * @param {string} renavam 
   */
  async preencherDados(placa, renavam) {
    console.log(`[Scraper] Acessando portal para Placa: ${placa}...`);
    await this.page.goto(this.url);

    // Seletores mapeados na análise técnica
    const selectorPlaca = 'input[id="indexRenavam:placa1"]';
    const selectorRenavam = 'input[id="indexRenavam:renavam"]';

    // Adicionado delay de digitação para parecer mais humano (100ms entre teclas)
    await this.page.fill(selectorPlaca, ''); // Limpa antes
    await this.page.type(selectorPlaca, placa, { delay: 150 });
    
    await this.page.fill(selectorRenavam, ''); // Limpa antes
    await this.page.type(selectorRenavam, renavam, { delay: 150 });
    
    console.log('[Scraper] Dados preenchidos com sucesso.');
  }

  /**
   * Lógica para recarregar o captcha se necessário.
   */
  async recarregarCaptcha() {
    console.log('[Scraper] Recarregando imagem do captcha...');
    // O botão de recarregar está dentro de um link com title 'Atualizar'
    const reloadButton = 'a[title="Atualizar"]';
    await this.page.click(reloadButton);
    await this.page.waitForTimeout(1500); // Aumentado para garantir a troca da imagem
  }

  /**
   * Captura a imagem do captcha em memória (Buffer).
   * @returns {Promise<Buffer>} Buffer da imagem capturada.
   */
  async capturarCaptcha() {
    console.log('[Scraper] Capturando imagem do captcha em memória...');
    const captchaElement = await this.page.$('#indexRenavam img'); 
    const buffer = await captchaElement.screenshot();
    return buffer;
  }

  /**
   * Insere o texto do captcha e clica em Confirmar.
   * @param {string} captchaText 
   */
  async submeterFormulario(captchaText) {
    console.log(`[Scraper] Inserindo captcha: ${captchaText}...`);
    const selectorCaptchaInput = 'input[id="indexRenavam:senha"]';
    const selectorConfirmar = 'input[id="indexRenavam:confirma"]';

    await this.page.fill(selectorCaptchaInput, ''); // Limpa antes
    await this.page.type(selectorCaptchaInput, captchaText, { delay: 150 });
    
    await this.page.click(selectorConfirmar);
    
    // Aguarda um pouco para a página processar a resposta
    await this.page.waitForTimeout(2000);
  }

  /**
   * Verifica se houve erro ou se os dados foram carregados.
   */
  async obterResultado() {
    console.log('[Scraper] Verificando resultado da submissão...');
    
    // Verifica por mensagens de erro em balões (layout padrão detran)
    const errorSelector = '.ui-messages-error-detail';
    const mainErrorSelector = 'li[role="alert"]'; // Outra forma comum de erro no JSF
    
    const hasError = await this.page.$(errorSelector) || await this.page.$(mainErrorSelector);

    if (hasError) {
      const errorText = await hasError.innerText();
      console.log(`[Scraper] Erro detectado no site: ${errorText}`);
      return { success: false, error: errorText };
    }

    // Verifica se caiu na página específica de "Sequência de caracteres incorreta"
    const isErrorPage = await this.page.evaluate(() => {
        return document.body.innerText.includes('Sequência de caracteres incorreta');
    });

    if (isErrorPage) {
        console.log('[Scraper] Página de sequência incorreta detectada.');
        return { success: false, error: 'Sequência de caracteres incorreta!!', needsBack: true };
    }

    // Tentativa de sucesso - Extrair dados da tabela
    console.log('[Scraper] Dados do veículo carregados. Extraindo informações...');
    const dados = await this.extrairDadosVeiculo();
    
    const resultScreenshot = `resultado_${Date.now()}.png`;
    await this.page.screenshot({ path: resultScreenshot });
    
    return { success: true, screenshot: resultScreenshot, dados };
  }

  /**
   * Extrai os dados da tabela de resultados baseada no layout do Detran-PA.
   */
  async extrairDadosVeiculo() {
    return await this.page.evaluate(() => {
        const extrairValor = (label) => {
            const rows = Array.from(document.querySelectorAll('tr'));
            const row = rows.find(r => r.innerText.includes(label));
            if (!row) return 'Não encontrado';
            
            // Tenta pegar o texto após o label
            const text = row.innerText;
            const parts = text.split(label);
            return parts[1] ? parts[1].split('\t')[0].trim().replace(/^:/, '').trim() : 'Não encontrado';
        };

        return {
            proprietario: extrairValor('NOME'),
            placa: extrairValor('PLACA'),
            renavam: extrairValor('RENAVAM'),
            chassi: extrairValor('CHASSI'),
            anoFabricacao: extrairValor('ANO DE FABRICAÇÃO'),
            anoModelo: extrairValor('ANO DO MODELO'),
            marcaModelo: extrairValor('MARCA/ MODELO'),
            situacaoLicenciamento: extrairValor('SITUAÇÃO DO LICENCIAMENTO'),
            statusVeiculo: extrairValor('STATUS DO VEÍCULO')
        };
    });
  }

  /**
   * Clica no botão 'Voltar' quando ocorre erro de captcha.
   */
  async clicarVoltar() {
    console.log('[Scraper] Clicando no botão Voltar...');
    // Baseado na imagem, o botão "Voltar" costuma ser um link ou botão com o texto
    const voltarSelector = 'a:has-text("Voltar"), button:has-text("Voltar")';
    await this.page.click(voltarSelector);
    await this.page.waitForTimeout(2000); // Aguarda volta ao formulário
  }

  /**
   * Finaliza a sessão do navegador.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = DetranPaScraper;
