// ============================================================
// index.js v2.0 — Bot de Relatórios Técnicos
// ============================================================

require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const relatorio = require('./commands/relatorio');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
client.commands.set('relatorio', relatorio);

// ── Pronto ─────────────────────────────────────────────────
client.once('ready', (c) => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   📋  Bot de Relatórios Técnicos v2  ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  ✅  ${c.user.tag.padEnd(33)}║`);
  console.log(`║  📅  ${new Date().toLocaleString('pt-BR').padEnd(33)}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('  /relatorio painel       → Painel principal');
  console.log('  /relatorio limpar       → Apagar uma seção');
  console.log('  /relatorio compartilhar → Publicar no canal');
  console.log('');
});

// ── Interações ─────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
      return;
    }

    // Botões → handleButton
    if (interaction.isButton()) {
      await relatorio.handleButton(interaction);
      return;
    }

    // Select Menus → handleSelect
    if (interaction.isStringSelectMenu()) {
      await relatorio.handleSelect(interaction);
      return;
    }

    // Modais → handleModal
    if (interaction.isModalSubmit()) {
      await relatorio.handleModal(interaction);
      return;
    }

  } catch (error) {
    console.error('[Error]', error);

    const msg = {
      embeds: [{
        color: 0xe74c3c,
        description: `❌  Erro inesperado: ${error.message}`,
      }],
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch (_) {}
  }
});

process.on('unhandledRejection', err => console.error('[Process]', err));
process.on('uncaughtException',  err => console.error('[Process]', err));

if (!process.env.DISCORD_TOKEN) {
  console.error('❌  DISCORD_TOKEN não encontrado no .env');
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️   GROQ_API_KEY não configurada — melhoria com IA desativada.');
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌  Falha no login:', err.message);
  process.exit(1);
});
