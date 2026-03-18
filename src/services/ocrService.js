const Tesseract = require('tesseract.js');
const { Jimp } = require('jimp'); // Usaremos Jimp para pré-processamento

/**
 * Serviço responsável por realizar o OCR localmente com pré-processamento de imagem.
 */
class OcrService {
  /**
   * Processa uma imagem (Buffer) e retorna o texto extraído.
   * Melhora a assertividade limpando ruídos comuns.
   * @param {Buffer} imageBuffer 
   * @returns {Promise<string>} Texto extraído e limpo.
   */
  async reconhecer(imageBuffer) {
    console.log('[OCR] Iniciando processamento com limpeza de imagem...');
    
    try {
      // Pré-processamento com Jimp para remover ruído
      const image = await Jimp.read(imageBuffer);
      
      // Aplicar filtros para destacar o texto
      image
        .greyscale() // Converte para tons de cinza
        .contrast(0.2) // Aumenta o contraste
        .threshold({ max: 200 }); // Binarização (Preto e Branco puro)

      const processedBuffer = await image.getBuffer('image/png');

      const { data: { text } } = await Tesseract.recognize(
        processedBuffer,
        'eng', 
        { 
          logger: m => {
            if (m.status === 'recognizing text') {
               // log silencioso ou menos verboso se necessário
            }
          },
          tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        }
      );

      const cleanText = text.replace(/[^a-zA-Z0-9]/g, '').trim();
      console.log(`[OCR] Texto extraído após limpeza: ${cleanText}`);
      
      return cleanText;
    } catch (error) {
      console.error('[OCR] Erro ao processar imagem:', error);
      throw error;
    }
  }
}

module.exports = OcrService;
