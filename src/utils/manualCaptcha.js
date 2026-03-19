const readline = require('readline');

/**
 * Solicita que o usuário digite o captcha manualmente no terminal.
 * @returns {Promise<string>} O texto do captcha digitado.
 */
async function promptManualCaptcha() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n--------------------------------------------------');
  console.log('🤖 AGUARDANDO CAPTCHA MANUAL');
  console.log('Olhe para o navegador aberto e digite os 5 caracteres.');
  console.log('--------------------------------------------------\n');

  return new Promise((resolve) => {
    rl.question('Digite o Captcha: ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });
}

module.exports = { promptManualCaptcha };
