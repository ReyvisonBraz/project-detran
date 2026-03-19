const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const DetranPaScraper = require('./src/scrapers/detranScraper');
const TwoCaptchaService = require('./src/services/twoCaptchaService');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Pasta para servir screenshots
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
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
        await scraper.init(service);
        
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
            finalResult = await scraper.obterResultado();

            if (finalResult.success) {
                resolved = true;
            } else if (finalResult.error === 'Captcha incorreto') {
                console.log('[API] Captcha incorreto, tentando novamente...');
                // No DETRAN-PA, o captcha geralmente recarrega sozinho ou permanece na mesma página com erro
                // Se houver botão de voltar necessário, o needsBack trataria, mas aqui parece que só recarregar basta
                if (finalResult.needsBack) await scraper.clicarVoltar();
            } else {
                // Erro fatal (ex: dados inválidos)
                break;
            }
        }

        if (resolved) {
            // Mover arquivos para pasta pública se houver
            if (finalResult.screenshot) {
                const oldPath = path.join(__dirname, finalResult.screenshot);
                const newPath = path.join(uploadsDir, finalResult.screenshot);
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newPath);
                    finalResult.screenshot = `/uploads/${finalResult.screenshot}`;
                }
            }
            if (finalResult.pdf) {
                const oldPath = path.join(__dirname, finalResult.pdf);
                const newPath = path.join(uploadsDir, finalResult.pdf);
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newPath);
                    finalResult.pdf = `/uploads/${finalResult.pdf}`;
                }
            }
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
