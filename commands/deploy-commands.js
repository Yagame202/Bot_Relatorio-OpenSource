// ============================================================
// commands/deploy-commands.js
// Execute: node commands/deploy-commands.js
// ============================================================

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const relatorio = require('./relatorio');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄  Registrando slash commands...');

    const dados = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [relatorio.data.toJSON()] }
    );

    console.log(`✅  ${dados.length} comando(s) registrado(s) com sucesso!`);
    console.log('');
    console.log('  Comandos disponíveis:');
    console.log('  /relatorio painel       → Painel principal');
    console.log('  /relatorio limpar       → Apagar uma seção');
    console.log('  /relatorio compartilhar → Publicar PDF no canal');
    console.log('');
  } catch (e) {
    console.error('❌  Erro ao registrar comandos:', e.message);
    if (e.status === 401) console.error('   Token inválido. Verifique DISCORD_TOKEN no .env');
    if (e.status === 404) console.error('   Servidor não encontrado. Verifique GUILD_ID no .env');
    process.exit(1);
  }
})();
