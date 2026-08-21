// Generates an offline-shareable PDF with the full user guide + onboarding
import { APP_VERSION } from '@/lib/versionCheck';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function downloadGuidePdf(): Promise<void> {
  const [{ GUIDE_PAGES }, { ONBOARDING_STEPS }, html2pdfMod] = await Promise.all([
    import('@/components/UserGuideStepByStep'),
    import('@/components/OnboardingTutorial'),
    import('html2pdf.js'),
  ]);
  const html2pdf = (html2pdfMod as any).default;

  const onboardingHtml = ONBOARDING_STEPS.map(
    (s, i) => `
      <div class="block">
        <h3>${i + 1}. ${esc(s.title)}</h3>
        <p>${esc(s.description)}</p>
        ${s.tip ? `<p class="tip">💡 ${esc(s.tip)}</p>` : ''}
      </div>`
  ).join('');

  const guideHtml = GUIDE_PAGES.map(
    (p, i) => `
      <div class="page-block">
        <h2>${i + 1}. ${esc(p.title)}</h2>
        ${p.sections
          .map(
            (sec) => `
          <div class="block">
            ${sec.heading ? `<h3>${esc(sec.heading)}</h3>` : ''}
            ${sec.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
            ${sec.tip ? `<p class="tip">💡 ${esc(sec.tip)}</p>` : ''}
            ${sec.warning ? `<p class="warn">⚠️ ${esc(sec.warning)}</p>` : ''}
          </div>`
          )
          .join('')}
      </div>`
  ).join('');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.innerHTML = `
    <style>
      .mats-pdf { font-family: Arial, Helvetica, sans-serif; color:#111; background:#fff; padding:8px 12px; }
      .mats-pdf h1 { font-size:26px; margin:0 0 4px; color:#111; }
      .mats-pdf h2 { font-size:19px; margin:18px 0 8px; color:#111; border-bottom:2px solid #ddd; padding-bottom:4px; }
      .mats-pdf h3 { font-size:15px; margin:12px 0 6px; color:#333; }
      .mats-pdf p { font-size:13px; line-height:1.55; margin:0 0 6px; }
      .mats-pdf .tip { background:#eef4ff; border-left:3px solid #3b6fd4; padding:6px 8px; }
      .mats-pdf .warn { background:#fff2f2; border-left:3px solid #d43b3b; padding:6px 8px; }
      .mats-pdf .block, .mats-pdf .page-block { page-break-inside: avoid; }
      .mats-pdf .muted { color:#666; font-size:12px; }
    </style>
    <div class="mats-pdf">
      <h1>M.A.T.S. — Guía Completa</h1>
      <p class="muted">Mutual Aid Tracking System · Versión ${esc(APP_VERSION)} · Generada ${new Date().toLocaleDateString('es-MX')}</p>
      <h2>Primeros pasos (Onboarding)</h2>
      ${onboardingHtml}
      <h2>Guía paso a paso</h2>
      ${guideHtml}
    </div>`;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [12, 12, 14, 12],
        filename: `MATS_Guia_Completa_v${APP_VERSION}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(container.firstElementChild?.nextElementSibling || container)
      .save();
  } finally {
    container.remove();
  }
}
