const fs = require('fs');
const path = require('path');

/**
 * Utilitário para gerenciamento de arquivos temporários e screenshots.
 */
class FileUtils {
  /**
   * Remove arquivos antigos de um diretório baseado na idade em minutos.
   * @param {string} directory Caminho do diretório.
   * @param {number} maxAgeMinutes Idade máxima em minutos.
   */
  static cleanupOldFiles(directory, maxAgeMinutes = 30) {
    if (!fs.existsSync(directory)) return;

    const now = Date.now();
    const files = fs.readdirSync(directory);

    files.forEach(file => {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        const ageInMinutes = (now - stats.mtimeMs) / (1000 * 60);

        if (ageInMinutes > maxAgeMinutes) {
          fs.unlinkSync(filePath);
          console.log(`[FileUtils] Removido arquivo antigo: ${file}`);
        }
      } catch (err) {
        console.warn(`[FileUtils] Erro ao processar arquivo ${file}: ${err.message}`);
      }
    });
  }

  /**
   * Garante que um diretório exista.
   */
  static ensureDir(directory) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }
}

module.exports = FileUtils;
