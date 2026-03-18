# Product Requirements Document (PRD) - Projeto DETRAN

## 1. Introdução e Visão Geral
O Projeto DETRAN visa [Descrever o propósito principal aqui, ex: facilitar o agendamento de serviços, consulta de débitos, ou gestão de frotas].

## 2. O Problema
Atualmente, os usuários enfrentam dificuldades em [Descrever os problemas atuais, ex: burocracia, demora no atendimento, falta de clareza nas informações].

## 3. Objetivos do Projeto
- **Objetivo 1:** [Ex: Reduzir o tempo de agendamento em 50%]
- **Objetivo 2:** [Ex: Centralizar todos os serviços em uma plataforma móvel]
- **Objetivo 3:** [Ex: Melhorar a comunicação com o cidadão via WhatsApp]

## 4. Personas do Usuário
- **Cidadão Comum:** Pessoa física que busca renovar CNH ou pagar multas.
- **Despachante:** Profissional que gerencia múltiplos processos para terceiros.
- **Agente de Trânsito:** Usuário interno que realiza consultas e fiscalizações.

## 5. Requisitos Funcionais (Consultas Veiculares)
- **RF01: Consulta de Licenciamento (Ano Atual):** Exige Placa, Renavam e resolução de Captcha.
- **RF02: Consulta de Licenciamento (Anos Anteriores):** Exige Placa, Renavam e resolução de Captcha.
- **RF03: Consulta Detalhada de Veículo:** Exige Placa, Renavam e resolução de Captcha (dados de multas, restrições, etc).
- **RF04: Consulta SNG (Chassi):** Permite consulta através do Chassi correto + Captcha.
- **RF05: Emissão de CRLV Digital:** Exige Placa, Renavam, CPF do Proprietário e resolução de Captcha.

## 6. Histórias de Usuário (User Stories)
> [!NOTE]
> Para quem está começando: Histórias de usuário ajudam a entender *quem* quer *o quê* e *por quê*.

1. **Como Proprietário**, eu quero emitir meu CRLV digital informando meus dados, para que eu possa circular com o veículo regularizado sem depender de documento físico.
2. **Como Comprador**, eu quero realizar uma consulta detalhada e SNG de um veículo, para verificar se ele possui multas, restrições financeiras (gravames) ou problemas de chassi antes de fechar negócio.

## 7. Requisitos Não Funcionais e Restrições Técnicas (Boas Práticas)
- **RNF01: Segurança e LGPD:** Dados como CPF e Renavam devem ser mascarados em logs e nunca expostos publicamente.
- **RNF02: Automação de Captcha (Resiliência):**
    - Implementar lógica de **Retry** (tentar novamente) se a leitura falhar.
    - Preparar integração com **2Captcha** (API externa) como plano B/C.
- **RNF03: Arquitetura Limpa (Clean Code):** O código deve ser modular. O "Scraper" (quem lê o site) deve ser separado da "Lógica de Negócio" (quem decide o que fazer com o dado).
- **RNF04: Logs e Monitoramento:** Cada tentativa de acesso deve gerar um log para sabermos quando o site do DETRAN mudou ou parou de funcionar.

## 7. Integrações Necessárias
- **Crawlers/Scrapers:** Módulos para acessar as URLs do DETRAN e extrair dados.
- **Bypass de Captcha:**
    - **Estratégia A:** OCR local (Tesseract/Modelos customizados) para captchas simples de texto.
    - **Estratégia B:** Serviços de terceiros (Anti-Captcha, 2Captcha) para reCAPTCHA/hCaptcha.
- **Notificação:** Webhooks para avisar quando a consulta for concluída.

## 8. Tabela de Mapeamento de Serviços (Análise Técnica - DETRAN-PA)
| Serviço | Entrada | IDs dos Campos (JSF) | Complexidade Captcha |
| :--- | :--- | :--- | :--- |
| Licenciamento Atual | Placa/Renavam | `indexBoletoAnoAtual:placa1`, `renavam`, `senha` | Média (Distorsão/Cores) |
| Licenciamento Anterior | Placa/Renavam | `indexBoletoAnoAnterior:placa1`, `renavam`, `senha` | Média (Distorsão/Cores) |
| Consulta Detalhada | Placa/Renavam | `indexRenavam:placa1`, `renavam`, `senha` | Média (Distorsão/Cores) |
| Consulta SNG | Chassi | `indexGravame:chassi`, `senha` | Média (Distorsão/Cores) |
| Emissão de CRLV | Placa/Renavam/CPF | `placa`, `renavam`, `cpfCnpj`, `senha` | Média (S/ prefixo de form) |

### Análise de Captcha (DETRAN-PA)
Os captchas identificados são imagens geradas dinamicamente com as seguintes características:
- Caracteres alfanuméricos distorcidos.
- Sobreposição de linhas pretas finas.
- Fundo dividido em blocos de cores sólidas (ex: vermelho, laranja, verde).
- **Viabilidade:** Requer pré-processamento (limpeza de ruído e normalização de cores) para ser lido com sucesso por motores OCR como Tesseract, ou uso de serviço especializado.

## 11. Arquitetura Sugerida (Estrutura de Pastas)
Para manter o projeto organizado e fácil de aprender:
- `/src`
    - `/scrapers`: Scripts que navegam nos sites do DETRAN (Puppeteer/Playwright).
    - `/services`: Lógica para processar dados e integração com **2Captcha**.
    - `/api`: Servidor (Express.js) que recebe as requisições do usuário.
    - `/utils`: Funções de ajuda (formatação de data, logs).
- `.env`: Onde guardaremos sua chave do 2Captcha com segurança.

## 12. Próximos Passos (Desenvolvimento)
1. **Configuração do Ambiente:** Instalar Node.js e as bibliotecas de automação.
2. **Desenvolvimento do Scraper Base:** Criar a função que preenche Placa/Renavam.
3. **Módulo de Captcha:** Implementar a lógica de recarregar e a integração (espera) para o 2Captcha.
4. **Criação da API:** Disponibilizar os dados extraídos em formato JSON.

## 13. Boas Práticas para este Projeto (Aprendizado)
- **Não Inventar a Roda:** Usar bibliotecas estáveis para automação (ex: Playwright ou Puppeteer).
- **Tratamento de Erros:** Sempre prever que o site do governo pode estar fora do ar. Retornar mensagens claras ao usuário.
- **Secrets Management:** Chaves de API (como a do 2Captcha) nunca devem ficar "chapadas" no código. Usaremos arquivos `.env`.
- **Modularização:** Criar um arquivo separado apenas para lidar com o 2Captcha, facilitando a troca por outro serviço no futuro.
