// ============================================================
// commands/relatorio.js  v2.0
// Relatório Técnico — Interface profissional completa
// ============================================================

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

const fs   = require('fs');
const path = require('path');

const { melhorarTextoComIA } = require('../services/ai');
const { gerarPDF }           = require('../services/pdf');

// ── Configuração ───────────────────────────────────────────

const SECOES = [
  { chave: 'introducao',      nome: 'Introdução',      emoji: '📝', num: 1 },
  { chave: 'objetivo',        nome: 'Objetivo',        emoji: '🎯', num: 2 },
  { chave: 'metodologia',     nome: 'Metodologia',     emoji: '🔬', num: 3 },
  { chave: 'desenvolvimento', nome: 'Desenvolvimento', emoji: '⚙️', num: 4 },
  { chave: 'resultados',      nome: 'Resultados',      emoji: '📊', num: 5 },
  { chave: 'conclusao',       nome: 'Conclusão',       emoji: '✅', num: 6 },
  { chave: 'referencias',     nome: 'Referências',     emoji: '📚', num: 7 },
];

const CORES = {
  primaria:  0x1a1a2e,   // azul escuro — cor principal da marca
  sucesso:   0x27ae60,   // verde
  info:      0x2980b9,   // azul
  aviso:     0xe67e22,   // laranja
  erro:      0xe74c3c,   // vermelho
  roxa:      0x8e44ad,   // roxo (preview)
  completo:  0x1abc9c,   // turquesa (100%)
};

const CAMINHO_JSON = path.join(__dirname, '..', 'data', 'relatorios.json');

// ── Storage ────────────────────────────────────────────────

function lerTodos() {
  try {
    if (!fs.existsSync(CAMINHO_JSON)) {
      fs.mkdirSync(path.dirname(CAMINHO_JSON), { recursive: true });
      fs.writeFileSync(CAMINHO_JSON, '{}', 'utf-8');
      return {};
    }
    const c = fs.readFileSync(CAMINHO_JSON, 'utf-8').trim();
    return c ? JSON.parse(c) : {};
  } catch (e) {
    console.error('[Storage] Leitura:', e.message);
    return {};
  }
}

function salvarTodos(dados) {
  try {
    fs.mkdirSync(path.dirname(CAMINHO_JSON), { recursive: true });
    fs.writeFileSync(CAMINHO_JSON, JSON.stringify(dados, null, 2), 'utf-8');
  } catch (e) {
    throw new Error('Falha ao salvar os dados. Tente novamente.');
  }
}

/** Retorna o objeto do usuário, criando se não existir. */
function obterUsuario(userId) {
  const todos = lerTodos();

  if (!todos[userId]) {
    todos[userId] = _novoUsuario();
    salvarTodos(todos);
    return todos[userId];
  }

  const u = todos[userId];

  // Migração v1 → v2: seções eram strings simples
  let migrou = false;
  SECOES.forEach(s => {
    if (!u.secoes) u.secoes = {};
    if (typeof u.secoes[s.chave] === 'string') {
      const t = u.secoes[s.chave];
      u.secoes[s.chave] = { atual: t, original: t };
      migrou = true;
    }
    if (!u.secoes[s.chave]) {
      u.secoes[s.chave] = { atual: '', original: '' };
      migrou = true;
    }
  });
  if (u.iaAtiva === undefined) { u.iaAtiva = true; migrou = true; }
  if (!u.titulo) { u.titulo = 'Relatório Técnico'; migrou = true; }

  if (migrou) salvarTodos({ ...lerTodos(), [userId]: u });

  return u;
}

function salvarUsuario(userId, usuario) {
  const todos = lerTodos();
  todos[userId] = { ...usuario, atualizadoEm: new Date().toISOString() };
  salvarTodos(todos);
}

function _novoUsuario() {
  const secoes = {};
  SECOES.forEach(s => { secoes[s.chave] = { atual: '', original: '' }; });
  return {
    titulo: 'Relatório Técnico',
    iaAtiva: true,
    secoes,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
}

// ── Helpers ────────────────────────────────────────────────

const getAtual    = (u, k) => u.secoes[k]?.atual    || '';
const getOriginal = (u, k) => u.secoes[k]?.original || '';
const estaPreenchida = (u, k) => getAtual(u, k).trim().length > 0;
const temVersionOriginal = (u, k) => {
  const orig = getOriginal(u, k);
  return orig.trim().length > 0 && orig !== getAtual(u, k);
};

function contarPreenchidas(u) {
  return SECOES.filter(s => estaPreenchida(u, s.chave)).length;
}

function barraProgresso(feito, total) {
  const pct    = Math.round((feito / total) * 100);
  const blocos = Math.round((feito / total) * 14);
  const barra  = '█'.repeat(blocos) + '░'.repeat(14 - blocos);
  return `\`${barra}\`  **${pct}%**  ·  ${feito}/${total} seções`;
}

function listaSecoes(u) {
  return SECOES.map(s => {
    const ok   = estaPreenchida(u, s.chave);
    const orig = temVersionOriginal(u, s.chave);
    let badge  = ok ? '✅' : '⬜';
    if (orig) badge += ' 🔄'; // tem versão original disponível
    return `${badge} **${s.num}.** ${s.nome}`;
  }).join('\n');
}

function corPainel(preenchidas, total) {
  if (preenchidas === 0)     return CORES.primaria;
  if (preenchidas === total) return CORES.completo;
  if (preenchidas >= total / 2) return CORES.info;
  return CORES.aviso;
}

// ── Construtores de UI ─────────────────────────────────────

function embedPainel(u, nomeUsuario) {
  const feito  = contarPreenchidas(u);
  const total  = SECOES.length;
  const falta  = total - feito;
  const ia     = u.iaAtiva ? '🟢 Ativada' : '🔴 Desativada';

  const dataCriacao = new Date(u.criadoEm).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const rodape = feito === total
    ? '✨ Relatório completo! Pronto para gerar o PDF.'
    : `📝 ${falta} seção${falta > 1 ? 'ões' : ''} aguardando preenchimento`;

  return new EmbedBuilder()
    .setColor(corPainel(feito, total))
    .setTitle(`📋  ${u.titulo}`)
    .setDescription(
      `> 👤  **Autor:** ${nomeUsuario}\n` +
      `> 📅  **Iniciado em:** ${dataCriacao}\n\n` +
      `**── PROGRESSO ─────────────────**\n` +
      barraProgresso(feito, total)
    )
    .addFields(
      {
        name: '📄  Seções',
        value: listaSecoes(u),
        inline: true,
      },
      {
        name: '⚙️  Painel',
        value:
          `🤖  **IA:** ${ia}\n\n` +
          `──────────────\n` +
          `🔄  = original disponível\n` +
          `✅  = preenchida\n` +
          `⬜  = vazia`,
        inline: true,
      }
    )
    .setFooter({ text: rodape })
    .setTimestamp();
}

function botoesPainel(iaAtiva) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_preencher')
      .setLabel('Preencher')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('btn_preview')
      .setLabel('Preview')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_pdf')
      .setLabel('Gerar PDF')
      .setEmoji('📄')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('btn_publicar')
      .setLabel('Publicar')
      .setEmoji('📢')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('btn_toggle_ia')
      .setLabel(`IA: ${iaAtiva ? 'ON' : 'OFF'}`)
      .setEmoji('🤖')
      .setStyle(iaAtiva ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_restaurar')
      .setLabel('Restaurar')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_limpar_secao')
      .setLabel('Limpar seção')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_titulo')
      .setLabel('Editar Título')
      .setEmoji('🏷️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_resetar')
      .setLabel('Resetar tudo')
      .setEmoji('⚠️')
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

/** Envia ou atualiza o painel principal. */
async function exibirPainel(interaction, atualizar = false) {
  const u     = obterUsuario(interaction.user.id);
  const embed = embedPainel(u, interaction.user.displayName);
  const comps = botoesPainel(u.iaAtiva);
  const dados = { embeds: [embed], components: comps };

  if (atualizar) {
    await interaction.update(dados);
  } else {
    await interaction.reply({ ...dados, ephemeral: true });
  }
}

// ── Select Menu helpers ────────────────────────────────────

function selectSecoes(customId, placeholder, filtro, descFn, emoji = null) {
  const u    = obterUsuario._cache; // passado via argumento abaixo
  const opts = SECOES.filter(filtro).map(s =>
    new StringSelectMenuOptionBuilder()
      .setLabel(s.nome)
      .setValue(s.chave)
      .setEmoji(emoji || s.emoji)
      .setDescription(descFn(s))
  );

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(opts);
}

// ── Handlers: Botões ───────────────────────────────────────

async function handleButton(interaction) {
  const id = interaction.customId;

  // ── ✏️ Preencher ────────────────────────────────────────
  if (id === 'btn_preencher') {
    const u = obterUsuario(interaction.user.id);

    const opcoes = SECOES.map(s =>
      new StringSelectMenuOptionBuilder()
        .setLabel(s.nome)
        .setValue(s.chave)
        .setEmoji(s.emoji)
        .setDescription(estaPreenchida(u, s.chave) ? '✅ Já preenchida — editar' : '⬜ Ainda vazia')
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.info)
          .setTitle('✏️  Selecionar Seção')
          .setDescription(
            'Escolha qual seção deseja preencher ou editar.\n\n' +
            '> **✅** = já preenchida  ·  **⬜** = vazia'
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_secao')
            .setPlaceholder('Escolha a seção...')
            .addOptions(opcoes)
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // ── 👁️ Preview ──────────────────────────────────────────
  if (id === 'btn_preview') {
    await interaction.deferReply({ ephemeral: true });
    const u     = obterUsuario(interaction.user.id);
    const feito = contarPreenchidas(u);

    const embed = new EmbedBuilder()
      .setColor(CORES.roxa)
      .setTitle(`👁️  Preview — ${u.titulo}`)
      .setDescription(
        `*Pré-visualização do relatório atual*\n\n` +
        `${barraProgresso(feito, SECOES.length)}`
      )
      .setTimestamp()
      .setFooter({ text: 'Este é apenas um preview — use Gerar PDF para o documento final.' });

    SECOES.forEach(s => {
      const texto = getAtual(u, s.chave);
      const val   = texto.trim()
        ? (texto.length > 280 ? texto.substring(0, 277) + '...' : texto)
        : '*— Não preenchida —*';
      embed.addFields({ name: `${s.emoji}  ${s.nome}`, value: val, inline: false });
    });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── 📄 Gerar PDF (privado) ──────────────────────────────
  if (id === 'btn_pdf') {
    await interaction.deferReply({ ephemeral: true });
    const u = obterUsuario(interaction.user.id);

    try {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.info)
            .setDescription('📄  Gerando PDF... Aguarde um momento.'),
        ],
      });

      const flat    = _relatorioFlat(u);
      const caminho = await gerarPDF(flat, interaction.user.displayName, u.titulo);
      const arquivo = new AttachmentBuilder(caminho, {
        name: `${_nomeArquivo(u.titulo)}.pdf`,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.sucesso)
            .setTitle('✅  PDF Gerado com Sucesso!')
            .setDescription(
              `**${u.titulo}**\n\n` +
              `📋  ${contarPreenchidas(u)}/${SECOES.length} seções incluídas\n` +
              `👤  Autor: ${interaction.user.displayName}`
            )
            .setTimestamp(),
        ],
        files: [arquivo],
      });

      _limparArquivo(caminho);
    } catch (e) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor(CORES.erro)
            .setDescription(`❌  Erro ao gerar PDF: ${e.message}`),
        ],
      });
    }
    return;
  }

  // ── 📢 Publicar (canal público) ─────────────────────────
  if (id === 'btn_publicar') {
    await interaction.deferReply({ ephemeral: true });
    const u = obterUsuario(interaction.user.id);

    if (!interaction.channel) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(CORES.erro)
          .setDescription('❌  Não foi possível acessar o canal. Use em um servidor.')],
      });
      return;
    }

    try {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(CORES.info)
          .setDescription('📢  Gerando e publicando PDF...')],
      });

      const flat    = _relatorioFlat(u);
      const caminho = await gerarPDF(flat, interaction.user.displayName, u.titulo);
      const arquivo = new AttachmentBuilder(caminho, {
        name: `${_nomeArquivo(u.titulo)}.pdf`,
      });

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.primaria)
            .setTitle(`📋  ${u.titulo}`)
            .setDescription(
              `📤  Relatório compartilhado por **${interaction.user.displayName}**\n\n` +
              `${barraProgresso(contarPreenchidas(u), SECOES.length)}`
            )
            .setTimestamp()
            .setFooter({ text: `Exportado em ${new Date().toLocaleDateString('pt-BR')}` }),
        ],
        files: [arquivo],
      });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(CORES.sucesso)
          .setDescription('✅  **Relatório publicado no canal com sucesso!**')],
      });

      _limparArquivo(caminho);
    } catch (e) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(CORES.erro)
          .setDescription(`❌  Erro ao publicar: ${e.message}`)],
      });
    }
    return;
  }

  // ── 🤖 Toggle IA ────────────────────────────────────────
  if (id === 'btn_toggle_ia') {
    const u = obterUsuario(interaction.user.id);
    u.iaAtiva = !u.iaAtiva;
    salvarUsuario(interaction.user.id, u);
    await exibirPainel(interaction, true); // atualiza painel no lugar
    return;
  }

  // ── 🔄 Restaurar original ────────────────────────────────
  if (id === 'btn_restaurar') {
    const u = obterUsuario(interaction.user.id);
    const disponiveis = SECOES.filter(s => temVersionOriginal(u, s.chave));

    if (disponiveis.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.aviso)
            .setTitle('🔄  Restaurar Versão Original')
            .setDescription(
              '⚠️  Nenhuma seção tem versão original disponível.\n\n' +
              'A versão original só é guardada quando a IA melhora seu texto.\n' +
              '*(O indicador 🔄 aparece nas seções com versão disponível)*'
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const opcoes = disponiveis.map(s =>
      new StringSelectMenuOptionBuilder()
        .setLabel(s.nome)
        .setValue(s.chave)
        .setEmoji('🔄')
        .setDescription('Restaurar texto antes da melhoria da IA')
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.aviso)
          .setTitle('🔄  Restaurar Versão Original')
          .setDescription(
            'Selecione qual seção deseja restaurar para o texto original.\n\n' +
            '> Isso irá substituir a versão melhorada pela IA pelo texto que você digitou originalmente.'
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_restaurar')
            .setPlaceholder('Escolha a seção para restaurar...')
            .addOptions(opcoes)
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // ── 🗑️ Limpar seção ─────────────────────────────────────
  if (id === 'btn_limpar_secao') {
    await _mostrarMenuLimpar(interaction);
    return;
  }

  // ── 🏷️ Editar Título ────────────────────────────────────
  if (id === 'btn_titulo') {
    const u = obterUsuario(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId('modal_titulo')
      .setTitle('🏷️  Editar Título do Relatório');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('titulo')
          .setLabel('Título do Relatório')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Análise de Redes de Computadores')
          .setValue(u.titulo)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(100)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  // ── ⚠️ Resetar tudo ─────────────────────────────────────
  if (id === 'btn_resetar') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.erro)
          .setTitle('⚠️  Confirmar Reset Completo')
          .setDescription(
            '**Você tem certeza que deseja apagar tudo?**\n\n' +
            'Esta ação irá:\n' +
            '› Apagar todo o conteúdo das seções\n' +
            '› Remover o histórico de versões originais\n' +
            '› Redefinir o título para padrão\n\n' +
            '❌  **Esta ação é irreversível.**'
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_resetar_sim')
            .setLabel('Sim, apagar tudo')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('btn_resetar_nao')
            .setLabel('Cancelar')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // ── Confirmar reset ──────────────────────────────────────
  if (id === 'btn_resetar_sim') {
    const todos = lerTodos();
    delete todos[interaction.user.id];
    salvarTodos(todos);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.sucesso)
          .setTitle('✅  Relatório Resetado')
          .setDescription(
            'Seu relatório foi apagado com sucesso.\n\n' +
            'Use `/relatorio painel` para começar um novo.'
          ),
      ],
      components: [],
    });
    return;
  }

  // ── Cancelar reset ───────────────────────────────────────
  if (id === 'btn_resetar_nao') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.sucesso)
          .setDescription('✅  Operação cancelada. Seu relatório está seguro.'),
      ],
      components: [],
    });
    return;
  }

  await interaction.reply({ content: '❌  Ação não reconhecida.', ephemeral: true });
}

// ── Handlers: Select Menus ─────────────────────────────────

async function handleSelect(interaction) {
  const id = interaction.customId;

  // ── Preencher seção ──────────────────────────────────────
  if (id === 'select_secao') {
    const chave = interaction.values[0];
    const secao = SECOES.find(s => s.chave === chave);
    const u     = obterUsuario(interaction.user.id);
    const atual = getAtual(u, chave);

    const input = new TextInputBuilder()
      .setCustomId('conteudo')
      .setLabel(`Conteúdo — ${secao.nome}`)
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(`Escreva o conteúdo da seção "${secao.nome}"...\n\nPode ser informal — a IA melhora automaticamente!`)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(4000);

    if (atual.trim()) input.setValue(atual.substring(0, 4000));

    const modal = new ModalBuilder()
      .setCustomId(`modal_conteudo_${chave}`)
      .setTitle(`${secao.emoji}  ${secao.nome}`);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  // ── Restaurar original ───────────────────────────────────
  if (id === 'select_restaurar') {
    const chave = interaction.values[0];
    const secao = SECOES.find(s => s.chave === chave);
    const u     = obterUsuario(interaction.user.id);

    u.secoes[chave].atual = getOriginal(u, chave);
    salvarUsuario(interaction.user.id, u);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.sucesso)
          .setTitle('✅  Versão Original Restaurada')
          .setDescription(
            `A seção **${secao.nome}** foi restaurada para o texto original com sucesso.\n\n` +
            `> Use **👁️ Preview** para conferir o resultado.`
          ),
      ],
      components: [],
    });
    return;
  }

  // ── Limpar seção ─────────────────────────────────────────
  if (id === 'select_limpar') {
    const chave = interaction.values[0];
    const secao = SECOES.find(s => s.chave === chave);
    const u     = obterUsuario(interaction.user.id);

    u.secoes[chave] = { atual: '', original: '' };
    salvarUsuario(interaction.user.id, u);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.sucesso)
          .setTitle('✅  Seção Apagada')
          .setDescription(`O conteúdo de **${secao.nome}** foi removido com sucesso.`),
      ],
      components: [],
    });
    return;
  }
}

// ── Handlers: Modais ───────────────────────────────────────

async function handleModal(interaction) {
  const id = interaction.customId;

  // ── Editar título ────────────────────────────────────────
  if (id === 'modal_titulo') {
    const novo = interaction.fields.getTextInputValue('titulo').trim();
    const u    = obterUsuario(interaction.user.id);
    u.titulo   = novo;
    salvarUsuario(interaction.user.id, u);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.sucesso)
          .setTitle('✅  Título Atualizado')
          .setDescription(`O título do relatório foi alterado para:\n\n**"${novo}"**`),
      ],
      ephemeral: true,
    });
    return;
  }

  // ── Conteúdo de seção ────────────────────────────────────
  if (id.startsWith('modal_conteudo_')) {
    await interaction.deferReply({ ephemeral: true }); // IMEDIATO — evita timeout

    const chave   = id.replace('modal_conteudo_', '');
    const secao   = SECOES.find(s => s.chave === chave);
    const conteudo = interaction.fields.getTextInputValue('conteudo').trim();
    const u       = obterUsuario(interaction.user.id);

    // Salva texto original antes de qualquer processamento
    u.secoes[chave].original = conteudo;
    u.secoes[chave].atual    = conteudo;
    salvarUsuario(interaction.user.id, u);

    // Sem IA — apenas salva
    if (!u.iaAtiva) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.sucesso)
            .setTitle('✅  Seção Salva')
            .setDescription(
              `**${secao.nome}** foi salva com sucesso.\n\n` +
              `> 🤖  Melhoria com IA está desativada.\n` +
              `> Ative o botão **IA: OFF** no painel para usar a IA.`
            ),
        ],
      });
      return;
    }

    // Avisa que está melhorando
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.info)
          .setDescription(
            `💾  **${secao.nome}** salva!\n` +
            `🤖  Melhorando com IA... Aguarde alguns segundos.`
          ),
      ],
    });

    // Chama a IA
    try {
      const melhorado = await melhorarTextoComIA(secao.nome, conteudo);
      u.secoes[chave].atual = melhorado;
      salvarUsuario(interaction.user.id, u);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.sucesso)
            .setTitle('✅  Salvo e Melhorado com IA!')
            .setDescription(
              `A seção **${secao.nome}** foi salva e aprimorada.\n\n` +
              `> 🤖  Linguagem formal e estilo acadêmico aplicados.\n` +
              `> 🔄  Versão original guardada — use **Restaurar** se quiser voltar.\n\n` +
              `Continue preenchendo as demais seções ou gere o PDF quando estiver pronto.`
            ),
        ],
      });
    } catch (e) {
      console.error('[AI]', e.message);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CORES.aviso)
            .setTitle('✅  Salvo (IA indisponível)')
            .setDescription(
              `**${secao.nome}** foi salva com o texto original.\n\n` +
              `⚠️  A IA não respondeu: ${e.message}\n` +
              `Você pode tentar **🤖 Melhorar com IA** novamente pelo painel.`
            ),
        ],
      });
    }
  }
}

// ── Subcommands slash ──────────────────────────────────────

async function cmdPainel(interaction) {
  await exibirPainel(interaction, false);
}

async function cmdLimpar(interaction) {
  await _mostrarMenuLimpar(interaction);
}

async function cmdCompartilhar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const u = obterUsuario(interaction.user.id);

  if (!interaction.channel) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(CORES.erro)
        .setDescription('❌  Não foi possível acessar o canal. Use em um servidor.')],
    });
    return;
  }

  try {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(CORES.info)
        .setDescription('📢  Gerando PDF para publicação...')],
    });

    const flat    = _relatorioFlat(u);
    const caminho = await gerarPDF(flat, interaction.user.displayName, u.titulo);
    const arquivo = new AttachmentBuilder(caminho, {
      name: `${_nomeArquivo(u.titulo)}.pdf`,
    });

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.primaria)
          .setTitle(`📋  ${u.titulo}`)
          .setDescription(
            `📤  Compartilhado por **${interaction.user.displayName}**\n\n` +
            `${barraProgresso(contarPreenchidas(u), SECOES.length)}`
          )
          .setTimestamp()
          .setFooter({ text: `Exportado em ${new Date().toLocaleDateString('pt-BR')}` }),
      ],
      files: [arquivo],
    });

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(CORES.sucesso)
        .setDescription('✅  **Relatório publicado no canal com sucesso!**')],
    });

    _limparArquivo(caminho);
  } catch (e) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(CORES.erro)
        .setDescription(`❌  Erro ao publicar: ${e.message}`)],
    });
  }
}

// ── Funções utilitárias privadas ───────────────────────────

async function _mostrarMenuLimpar(interaction) {
  const u = obterUsuario(interaction.user.id);
  const preenchidas = SECOES.filter(s => estaPreenchida(u, s.chave));

  if (preenchidas.length === 0) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CORES.aviso)
          .setDescription('⚠️  Nenhuma seção preenchida para limpar.'),
      ],
      ephemeral: true,
    });
    return;
  }

  const opcoes = preenchidas.map(s =>
    new StringSelectMenuOptionBuilder()
      .setLabel(s.nome)
      .setValue(s.chave)
      .setEmoji('🗑️')
      .setDescription('Apagar todo o conteúdo desta seção')
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(CORES.erro)
        .setTitle('🗑️  Limpar Seção')
        .setDescription(
          'Selecione qual seção deseja apagar.\n\n' +
          '> ⚠️  Esta ação é **irreversível** e apagará o texto e a versão original.'
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_limpar')
          .setPlaceholder('Escolha a seção para apagar...')
          .addOptions(opcoes)
      ),
    ],
    ephemeral: true,
  });
}

function _relatorioFlat(u) {
  const flat = {};
  SECOES.forEach(s => { flat[s.chave] = getAtual(u, s.chave); });
  return flat;
}

function _nomeArquivo(titulo) {
  return titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 40);
}

function _limparArquivo(caminho, delay = 15_000) {
  setTimeout(() => {
    try { fs.unlinkSync(caminho); } catch (_) {}
  }, delay);
}

// ── Exportação ─────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relatorio')
    .setDescription('📋 Sistema de Relatório Técnico com IA')
    .addSubcommand(sub =>
      sub.setName('painel')
        .setDescription('Abre o painel principal do relatório')
    )
    .addSubcommand(sub =>
      sub.setName('limpar')
        .setDescription('Apagar o conteúdo de uma seção específica')
    )
    .addSubcommand(sub =>
      sub.setName('compartilhar')
        .setDescription('Publicar o PDF do relatório no canal atual')
    ),

async execute(interaction) {
  const sub = interaction.options.getSubcommand(false); // false = não lança erro
  if (!sub || sub === 'painel') return cmdPainel(interaction);
  if (sub === 'limpar')         return cmdLimpar(interaction);
  if (sub === 'compartilhar')   return cmdCompartilhar(interaction);
},

  handleButton,
  handleSelect,
  handleModal,
};
