const axios = require('axios');
const fs = require('fs');
const path = require('path');
// Força o carregamento do .env da raiz do projeto
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Serviço responsável por interagir com a API do 2Captcha.
 */
class TwoCaptchaService {
  constructor() {
    this.apiKey = process.env.TWO_CAPTCHA_KEY;
    this.baseUrl = 'https://2captcha.com';
  }

  /**
   * Envia a imagem do captcha para o 2Captcha.
   * @param {Buffer} imageBuffer Buffer da imagem.
   * @returns {string} ID da tarefa no 2Captcha.
   */
  async enviarCaptcha(imageBuffer) {
    const keyPrefix = this.apiKey ? `${this.apiKey.substring(0, 4)}...` : 'NÃO DEFINIDA';
    console.log(`[2Captcha] Verificando chave (Início: ${keyPrefix})`);

    if (!this.apiKey || this.apiKey === 'SUA_CHAVE_AQUI' || this.apiKey.trim() === '') {
      throw new Error(`Chave de API do 2Captcha não configurada ou inválida no arquivo .env`);
    }

    console.log('[2Captcha] Enviando imagem...');
    const base64Image = imageBuffer.toString('base64');

    try {
      const params = new URLSearchParams();
      params.append('key', this.apiKey);
      params.append('method', 'base64');
      params.append('body', base64Image);
      params.append('json', '1');
      // Parâmetros de precisão baseados no portal Detran-PA
      params.append('min_len', '5');
      params.append('max_len', '5');
      params.append('regsense', '1'); // O Detran costuma ser sensível a maiúsculas/minúsculas

      const response = await axios.post(`${this.baseUrl}/in.php`, params);

      if (response.data.status === 1) {
        return response.data.request;
      } else {
        throw new Error(`Erro ao enviar captcha: ${response.data.request}`);
      }
    } catch (error) {
      console.error('[2Captcha] Erro na requisição:', error.message);
      throw error;
    }
  }

  /**
   * Aguarda a resolução do captcha (Polling).
   * @param {string} taskId ID retornado no envio.
   * @param {number} retries Número de tentativas de verificação.
   * @returns {string} Texto resolvido do captcha.
   */
  async obterResposta(taskId, retries = 30) {
    console.log(`[2Captcha] Aguardando resolução da tarefa ${taskId}...`);
    console.log('[2Captcha] Aguardando 15 segundos iniciais para processamento humano...');
    
    await new Promise(resolve => setTimeout(resolve, 15000)); // Delay inicial generoso conforme solicitado

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(`${this.baseUrl}/res.php`, {
                params: {
                    key: this.apiKey,
                    action: 'get',
                    id: taskId,
                    json: 1
                }
            });

            if (response.data.status === 1) {
                const captchaText = response.data.request.toUpperCase();
                console.log(`[2Captcha] Captcha resolvido: ${captchaText}`);
                return captchaText;
            } else if (response.data.request !== 'CAPCHA_NOT_READY') {
                throw new Error(`Erro na resposta do captcha: ${response.data.request}`);
            }
            
            console.log(`[2Captcha] Ainda não está pronto (${i + 1}/${retries}). Próximo check em 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Espera entre tentativas
        } catch (error) {
            console.error('[2Captcha] Erro ao obter resposta:', error.message);
            throw error;
        }
    }

    throw new Error('Tempo limite de espera pelo captcha atingido.');
  }

  /**
   * Método de conveniência para resolver o captcha.
   * Agora suporta modo manual através da variável de ambiente MANUAL_CAPTCHA.
   */
  async resolverCaptcha(imageBuffer) {
    if (process.env.MANUAL_CAPTCHA === 'true') {
      const { promptManualCaptcha } = require('../utils/manualCaptcha');
      return await promptManualCaptcha();
    }

    const taskId = await this.enviarCaptcha(imageBuffer);
    return await this.obterResposta(taskId);
  }
}

module.exports = TwoCaptchaService;
