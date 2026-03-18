const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

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
    if (!this.apiKey || this.apiKey === 'SUA_CHAVE_AQUI') {
      throw new Error('Chave de API do 2Captcha não configurada no arquivo .env');
    }

    console.log('[2Captcha] Enviando imagem...');
    const base64Image = imageBuffer.toString('base64');

    try {
      const response = await axios.post(`${this.baseUrl}/in.php`, null, {
        params: {
          key: this.apiKey,
          method: 'base64',
          body: base64Image,
          json: 1
        }
      });

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
  async obterResposta(taskId, retries = 20) {
    console.log(`[2Captcha] Aguardando resolução da tarefa ${taskId}...`);
    
    for (let i = 0; i < retries; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5s entre tentativas

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
            
            console.log(`[2Captcha] Ainda não está pronto (${i + 1}/${retries})...`);
        } catch (error) {
            console.error('[2Captcha] Erro ao obter resposta:', error.message);
            throw error;
        }
    }

    throw new Error('Tempo limite de espera pelo captcha atingido.');
  }
}

module.exports = TwoCaptchaService;
