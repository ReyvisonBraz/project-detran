document.addEventListener('DOMContentLoaded', () => {
    const serviceSelect = document.getElementById('service');
    const cpfField = document.querySelector('.field-cpf');
    const chassiField = document.querySelector('.field-chassi');
    const btnConsultar = document.getElementById('btn-consultar');
    const loader = document.querySelector('.loader');
    const resultArea = document.getElementById('result-area');
    const finalResults = document.getElementById('final-results');
    const statusText = document.getElementById('status-text');
    const dataDisplay = document.getElementById('data-display');
    const docPreview = document.getElementById('doc-preview');
    const screenshotView = document.getElementById('screenshot-view');
    const downloadBtn = document.getElementById('download-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const shareLinkBtn = document.getElementById('share-link-btn');

    // Lógica de campos dinâmicos
    serviceSelect.addEventListener('change', () => {
        const val = serviceSelect.value;
        cpfField.classList.toggle('hidden', val !== 'CRLV');
        chassiField.classList.toggle('hidden', val !== 'SNG');
    });

    // Função de consulta
    btnConsultar.addEventListener('click', async () => {
        const placa = document.getElementById('placa').value.toUpperCase();
        const renavam = document.getElementById('renavam').value;
        const service = serviceSelect.value;
        const cpf = document.getElementById('cpf').value;
        const chassi = document.getElementById('chassi').value;

        if (!placa || !renavam) {
            alert('Por favor, preencha Placa e Renavam.');
            return;
        }

        // Reset UI
        btnConsultar.disabled = true;
        loader.classList.remove('hidden');
        resultArea.classList.remove('hidden');
        finalResults.classList.add('hidden');
        docPreview.classList.add('hidden');
        statusText.innerText = 'Iniciando robô e resolvendo captcha...';

        try {
            const response = await fetch('/api/consultar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service, placa, renavam, cpf, chassi })
            });

            const result = await response.json();

            if (result.success) {
                statusText.innerText = 'Consulta finalizada com sucesso!';
                renderResults(result);
            } else {
                statusText.innerText = `Erro: ${result.error || 'Falha na consulta'}`;
            }
        } catch (error) {
            statusText.innerText = 'Erro ao conectar com o servidor.';
            console.error(error);
        } finally {
            loader.classList.add('hidden');
            btnConsultar.disabled = false;
        }
    });

    function renderResults(res) {
        finalResults.classList.remove('hidden');
        dataDisplay.innerHTML = '';

        if (res.dados) {
            Object.entries(res.dados).forEach(([key, value]) => {
                if (value) {
                    const item = document.createElement('div');
                    item.className = 'data-item';
                    item.innerHTML = `<span>${key.toUpperCase()}</span><span>${value}</span>`;
                    dataDisplay.appendChild(item);
                }
            });
        }

        if (res.screenshotUrl) {
            docPreview.classList.remove('hidden');
            screenshotView.src = res.screenshotUrl;
            downloadBtn.href = res.screenshotUrl;
        }

        if (res.pdfUrl) {
            downloadPdfBtn.classList.remove('hidden');
            downloadPdfBtn.href = res.pdfUrl;
            downloadPdfBtn.setAttribute('download', `CRLV_${res.dados?.placa || 'documento'}.pdf`);
        } else {
            downloadPdfBtn.classList.add('hidden');
        }

        if (res.shareableUrl) {
            shareLinkBtn.classList.remove('hidden');
            shareLinkBtn.href = res.shareableUrl;
        } else {
            shareLinkBtn.classList.add('hidden');
        }
    }
});
