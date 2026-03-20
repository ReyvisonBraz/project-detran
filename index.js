const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');
const FileUtils = require('./src/utils/fileUtils');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Pasta para servir screenshots
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const tempDir = path.join(__dirname, 'temp');

FileUtils.ensureDir(uploadsDir);
FileUtils.ensureDir(tempDir);

// Limpeza inicial de arquivos com mais de 1 hora
FileUtils.cleanupOldFiles(uploadsDir, 60);
FileUtils.cleanupOldFiles(tempDir, 60);

app.use('/uploads', express.static(uploadsDir));

/**
 * Endpoint de Consulta Unificado
 */
app.post('/api/consultar', async (req, res) => {
    const { service, placa, renavam, cpf, chassi } = req.body;
    console.log(`[API] Nova consulta: ${service} para Placa ${placa}`);

    const scraper = new DetranPaScraper();
    const solver = new TwoCaptchaService();

    try {
        const isVisible = process.env.VISIBLE === 'true';
        await scraper.init(service, { headless: !isVisible });
        
        if (service === 'SNG' && chassi) {
            await scraper.preencherSNG(chassi);
        }

        await scraper.preencherDados(placa, renavam, cpf);

        let resolved = false;
        let attempts = 0;
        const maxAttempts = 3;
        let finalResult = null;

        while (!resolved && attempts < maxAttempts) {
            attempts++;
            console.log(`[API] Tentativa ${attempts} de resolver captcha...`);
            
            const captchaBuffer = await scraper.capturarCaptcha();
            const captchaText = await solver.resolverCaptcha(captchaBuffer);

            if (!captchaText) {
                await scraper.recarregarCaptcha();
                continue;
            }

            await scraper.submeterCaptcha(captchaText);
            // Captura o resultado da consulta
            const result = await scraper.obterResultado();
            
            finalResult = {
                success: result.success,
                message: result.message,
                error: result.error,
                isDocument: result.isDocument || false,
                dados: result.dados || null,
                screenshot: result.screenshot, // Manter o screenshot para processamento posterior
                pdfPath: result.pdfPath, // Novo campo
                shareableUrl: result.shareableUrl, // Novo campo
                needsBack: result.needsBack // Manter para lógica de voltar
            };

            if (finalResult.success) {
                resolved = true;
            } else if (finalResult.needsBack) {
                await scraper.clicarVoltar();
            } else {
                // Erro fatal ou seletor não encontrado
                break;
            }
        }

        if (resolved) {
            // Mover screenshot para pasta pública se houver
            if (finalResult.screenshot) {
                const oldPath = finalResult.screenshot;
                const fileName = path.basename(oldPath);
                const newPath = path.join(uploadsDir, fileName);
                
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newPath);
                    finalResult.screenshotUrl = `/uploads/${fileName}`;
                }
            }

            // Mover PDF para pasta pública se houver
            if (finalResult.pdfPath) {
                const oldPdfPath = finalResult.pdfPath;
                const pdfFileName = path.basename(oldPdfPath);
                const newPdfPath = path.join(uploadsDir, pdfFileName);
                
                if (fs.existsSync(oldPdfPath)) {
                    fs.renameSync(oldPdfPath, newPdfPath);
                    finalResult.pdfUrl = `/uploads/${pdfFileName}`;
                    console.log(`[Server] PDF disponibilizado em: ${finalResult.pdfUrl}`);
                }
            }
            
            // Remove caminhos absolutos antes de enviar ao cliente
            delete finalResult.screenshot;
            delete finalResult.pdfPath;
            
            res.json(finalResult);
        } else {
            console.error('[API] Erro na consulta:', finalResult?.error);
            res.status(500).json({ success: false, error: finalResult?.error || 'Máximo de tentativas excedido' });
        }

    } catch (error) {
        console.error('[API] Erro interno:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await scraper.close();
    }
});

app.listen(port, () => {
    console.log(`[Server] Portal rodando em http://localhost:${port}`);
});
