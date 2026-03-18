# 🚀 Guia de Instalação: Projeto DETRAN-PA

Siga este passo a passo para rodar o projeto em uma nova máquina Windows.

## 1. Requisitos Prévios
- **Node.js:** Instale a versão LTS (recomendado v20+) através do site oficial: [nodejs.org](https://nodejs.org/)
- **Git:** (Opcional) Para clonar o código, ou apenas baixe a pasta do projeto.

## 2. Instalação das Dependências
Abra o terminal (PowerShell ou CMD) na pasta do projeto e execute:

```powershell
# Instala as bibliotecas do Node.js
npm install

# Instala o navegador Chromium necessário para o robô
npx playwright install chromium
```

## 3. Configuração do Ambiente (.env)
Crie um arquivo chamado `.env` na raiz do projeto (se não existir) e adicione sua chave do 2Captcha:

```env
TWO_CAPTCHA_KEY=SUA_CHAVE_AQUI
```

## 4. Como Executar

### Opção A: Portal Web (Recomendado)
Para usar a interface premium no seu navegador:

```powershell
node index.js
```
Após rodar, abra o navegador em: **`http://localhost:3000`**

### Opção B: Script de Teste Mestre
Para rodar consultas sequenciais via terminal (ideal para depuração):

```powershell
node test_master.js
```

## 🛠️ Solução de Problemas
- **Erro de Navegador:** Se o robô não abrir, rode `npx playwright install --with-deps`.
- **Erro de Captcha:** Verifique se sua chave no `.env` tem saldo e está correta.
- **Porta 3000 ocupada:** Feche outros terminais que possam estar rodando o `index.js`.
