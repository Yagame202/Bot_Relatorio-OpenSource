// ============================================================
// services/pdf.js — Geração de PDF profissional estilo ABNT
// ============================================================

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const SECOES = [
  { chave: 'introducao',      titulo: '1. Introdução'      },
  { chave: 'objetivo',        titulo: '2. Objetivo'        },
  { chave: 'metodologia',     titulo: '3. Metodologia'     },
  { chave: 'desenvolvimento', titulo: '4. Desenvolvimento' },
  { chave: 'resultados',      titulo: '5. Resultados'      },
  { chave: 'conclusao',       titulo: '6. Conclusão'       },
  { chave: 'referencias',     titulo: '7. Referências'     },
];

/**
 * Gera PDF profissional.
 * @param {object} relatorio - { chave: string } ou { chave: { atual, original } }
 * @param {string} nomeUsuario
 * @param {string} titulo - Título personalizado do relatório
 */
async function gerarPDF(relatorio, nomeUsuario, titulo = 'Relatório Técnico') {
  return new Promise((resolve, reject) => {
    try {
      const pastaData = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(pastaData)) fs.mkdirSync(pastaData, { recursive: true });

      const arquivo = path.join(pastaData, `relatorio_${Date.now()}.pdf`);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 85, right: 57 },
      });

      const stream = fs.createWriteStream(arquivo);
      doc.pipe(stream);

      _capa(doc, nomeUsuario, titulo);
      doc.addPage();
      _sumario(doc);
      doc.addPage();
      _conteudo(doc, relatorio);

      doc.end();
      stream.on('finish', () => resolve(arquivo));
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ── Helpers internos ──────────────────────────────────────

function _getTexto(relatorio, chave) {
  const val = relatorio[chave];
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.atual || '';
}

function _capa(doc, nomeUsuario, titulo) {
  const W  = doc.page.width;
  const H  = doc.page.height;
  const ml = doc.page.margins.left;
  const mr = doc.page.margins.right;
  const lw = W - ml - mr;

  // Barra superior decorativa
  doc.rect(ml, 40, lw, 4).fill('#1a1a2e');

  // Título centralizado verticalmente
  const inicioY = H * 0.30;

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#1a1a2e')
    .text(titulo.toUpperCase(), ml, inicioY, { width: lw, align: 'center' });

  doc.moveDown(0.6);

  // Linha divisória
  const ly = doc.y;
  doc.rect(W / 2 - 70, ly, 140, 1.5).fill('#1a1a2e');

  doc.moveDown(2.5);

  // Autor
  doc
    .font('Helvetica-Bold').fontSize(11).fillColor('#333333')
    .text('AUTOR', { width: lw, align: 'center' });
  doc.moveDown(0.2);
  doc
    .font('Helvetica').fontSize(13).fillColor('#1a1a2e')
    .text(nomeUsuario, { width: lw, align: 'center' });

  doc.moveDown(1.5);

  // Data
  doc
    .font('Helvetica-Bold').fontSize(11).fillColor('#333333')
    .text('DATA', { width: lw, align: 'center' });
  doc.moveDown(0.2);
  doc
    .font('Helvetica').fontSize(12).fillColor('#1a1a2e')
    .text(
      new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      { width: lw, align: 'center' }
    );

  // Barra inferior decorativa
  doc.rect(ml, H - 50, lw, 4).fill('#1a1a2e');
}

function _sumario(doc) {
  const ml = doc.page.margins.left;
  const lw = doc.page.width - ml - doc.page.margins.right;

  doc
    .font('Helvetica-Bold').fontSize(16).fillColor('#1a1a2e')
    .text('SUMÁRIO', { align: 'center' });

  doc.moveDown(0.4)
    .rect(ml, doc.y, lw, 1.5).fill('#1a1a2e');

  doc.moveDown(1.5);

  SECOES.forEach((s, i) => {
    doc
      .font('Helvetica').fontSize(11).fillColor('#333333')
      .text(s.titulo, { continued: true, width: lw - 30 })
      .text(`${3 + i}`, { align: 'right' });
    doc.moveDown(0.6);
  });
}

function _conteudo(doc, relatorio) {
  const ml = doc.page.margins.left;
  const lw = doc.page.width - ml - doc.page.margins.right;

  SECOES.forEach((s, i) => {
    if (i > 0) doc.addPage();

    // Título da seção
    doc
      .font('Helvetica-Bold').fontSize(13).fillColor('#1a1a2e')
      .text(s.titulo.toUpperCase());

    doc.moveDown(0.2)
      .rect(ml, doc.y, lw, 1).fill('#cccccc');

    doc.moveDown(0.9);

    // Conteúdo
    const texto = _getTexto(relatorio, s.chave);
    if (texto.trim()) {
      doc
        .font('Helvetica').fontSize(11).fillColor('#222222')
        .text(texto, { align: 'justify', lineGap: 4, paragraphGap: 8 });
    } else {
      doc
        .font('Helvetica-Oblique').fontSize(11).fillColor('#aaaaaa')
        .text('[Esta seção não foi preenchida.]');
    }
  });
}

module.exports = { gerarPDF };
