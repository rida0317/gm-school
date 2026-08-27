import { StudentReportCard } from '@/types/database';
import { SchoolSettings } from '@/lib/settings';

export interface PrintBulletinOptions {
  reportCards: StudentReportCard[];
  settings: Partial<SchoolSettings>;
}

export function printStudentBulletinsPDF({ reportCards, settings }: PrintBulletinOptions) {
  if (!reportCards || reportCards.length === 0) return;

  const logoUrl = settings.logo_url || '/logo.png';
  const fullLogoSrc = typeof window !== 'undefined' && logoUrl.startsWith('http')
    ? logoUrl
    : typeof window !== 'undefined'
    ? `${window.location.origin}${logoUrl}`
    : logoUrl;

  const schoolName = settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';
  const academicYear = settings.academic_year || '2025-2026';

  const bulletinsHtml = reportCards.map((rc, index) => {
    const isFirst = index === 0;
    const pageBreakClass = isFirst ? '' : 'page-break';

    const lvlLower = (rc.level || '').toLowerCase();
    const cycleLower = (rc.cycle || '').toLowerCase();
    const isPrimary = rc.max_scale === 10 || cycleLower.includes('primaire') || lvlLower.includes('ap') || lvlLower.includes('primaire') || lvlLower.includes('ce') || lvlLower.includes('cm') || lvlLower.includes('cp') || lvlLower.includes('ابتدائي');
    const maxScale = isPrimary ? 10 : 20;
    const passThreshold = isPrimary ? 5 : 10;
    const goodThreshold = isPrimary ? 7 : 14;
    const veryGoodThreshold = isPrimary ? 8 : 16;
    const excellentThreshold = isPrimary ? 9 : 18;

    // Format mentions
    let mentionBadgeClass = 'bg-slate-100 text-slate-800';
    let mentionText = 'Passable';
    if (isPrimary) {
      if (rc.general_average >= 9.0) {
        mentionBadgeClass = 'mention-tb';
        mentionText = 'Très Bien — Félicitations 🌟';
      } else if (rc.general_average >= 8.0) {
        mentionBadgeClass = 'mention-b';
        mentionText = 'Bien — Tableau d’Honneur 🎖️';
      } else if (rc.general_average >= 7.0) {
        mentionBadgeClass = 'mention-ab';
        mentionText = 'Assez Bien — Encouragements 👏';
      } else if (rc.general_average >= 5.0) {
        mentionBadgeClass = 'mention-p';
        mentionText = 'Passable / Moyen';
      } else {
        mentionBadgeClass = 'mention-insuff';
        mentionText = 'Insuffisant — Soutien Requis ⚠️';
      }
    } else {
      if (rc.general_average >= 16) {
        mentionBadgeClass = 'mention-tb';
        mentionText = 'Très Bien — Félicitations 🌟';
      } else if (rc.general_average >= 14) {
        mentionBadgeClass = 'mention-b';
        mentionText = 'Bien — Tableau d’Honneur 🎖️';
      } else if (rc.general_average >= 12) {
        mentionBadgeClass = 'mention-ab';
        mentionText = 'Assez Bien — Encouragements 👏';
      } else if (rc.general_average >= 10) {
        mentionBadgeClass = 'mention-p';
        mentionText = 'Passable';
      } else {
        mentionBadgeClass = 'mention-insuff';
        mentionText = 'Insuffisant — Travail & Soutien Requis ⚠️';
      }
    }

    const rowsHtml = rc.subjects.map((sub, idx) => {
      const cc1Val = sub.scores.cc1 !== null && sub.scores.cc1 !== undefined ? sub.scores.cc1.toFixed(2) : '—';
      const cc2Val = sub.scores.cc2 !== null && sub.scores.cc2 !== undefined ? sub.scores.cc2.toFixed(2) : '—';
      const cc3Val = sub.scores.cc3 !== null && sub.scores.cc3 !== undefined ? sub.scores.cc3.toFixed(2) : '—';
      const actVal = sub.scores.activities !== null && sub.scores.activities !== undefined ? sub.scores.activities.toFixed(2) : '—';
      const avgVal = sub.average !== null && sub.average !== undefined ? sub.average.toFixed(2) : '—';
      
      const weightedPoints = sub.average !== null && sub.average !== undefined ? (sub.average * sub.coefficient).toFixed(2) : '—';
      const scoreColorClass = sub.average !== null && sub.average !== undefined
        ? sub.average < passThreshold
          ? 'score-danger'
          : sub.average >= veryGoodThreshold
          ? 'score-success'
          : ''
        : '';

      const appreciation = sub.appreciation || (
        sub.average !== null && sub.average !== undefined
          ? sub.average >= veryGoodThreshold
            ? 'Excellent travail, continuez ainsi'
            : sub.average >= goodThreshold
            ? 'Bon travail, résultats satisfaisants'
            : sub.average >= passThreshold
            ? 'Résultats convenables, peut mieux faire'
            : 'Des difficultés, un travail régulier est nécessaire'
          : '—'
      );

      return `
        <tr class="${idx % 2 === 1 ? 'even-row' : ''}">
          <td class="col-subj">
            <div class="subj-name">${sub.subject_name}</div>
            ${sub.teacher_name ? `<div class="subj-teacher">Prof: ${sub.teacher_name}</div>` : ''}
          </td>
          <td class="col-score text-center">${cc1Val}</td>
          <td class="col-score text-center">${cc2Val}</td>
          <td class="col-score text-center">${cc3Val}</td>
          <td class="col-score text-center">${actVal}</td>
          <td class="col-avg text-center ${scoreColorClass}"><strong>${avgVal}</strong></td>
          <td class="col-coeff text-center">${sub.coefficient}</td>
          <td class="col-pts text-center">${weightedPoints}</td>
          <td class="col-stat text-center">
            <span class="text-muted">${sub.class_min?.toFixed(1) || '—'} / ${sub.class_max?.toFixed(1) || '—'}</span>
          </td>
          <td class="col-apprec">${appreciation}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="bulletin-sheet ${pageBreakClass}">
        <!-- Header -->
        <div class="header-box">
          <div class="header-left">
            <img src="${fullLogoSrc}" alt="Logo" class="logo-img" />
            <div class="school-titles">
              <div class="gov-text">ROYAUME DU MAROC &bull; MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
              <div class="school-name">${schoolName}</div>
              <div class="sub-text">Enseignement Privé &bull; Maternelle - Primaire - Collège - Lycée</div>
            </div>
          </div>
          <div class="header-right">
            <div class="badge-bulletin">BULLETIN SCOLAIRE OFFICIEL</div>
            <div class="meta-row"><strong>Semestre :</strong> ${rc.semester === 'S1' ? 'Semestre 1 (S1)' : 'Semestre 2 (S2)'}</div>
            <div class="meta-row"><strong>Année Scolaire :</strong> ${rc.academic_year || academicYear}</div>
          </div>
        </div>

        <!-- Student ID Card -->
        <div class="student-id-grid">
          <div class="id-item">
            <span class="id-label">Nom &amp; Prénom :</span>
            <span class="id-value text-highlight">${rc.student_name}</span>
          </div>
          <div class="id-item">
            <span class="id-label">Code Massar :</span>
            <span class="id-value massar-font">${rc.massar_code || '—'}</span>
          </div>
          <div class="id-item">
            <span class="id-label">Classe :</span>
            <span class="id-value">${rc.class_name} (${rc.level})</span>
          </div>
          <div class="id-item">
            <span class="id-label">Effectif de la classe :</span>
            <span class="id-value">${rc.total_students} élèves</span>
          </div>
        </div>

        <!-- Grades Table -->
        <div class="table-wrapper">
          <table class="grades-table">
            <thead>
              <tr>
                <th class="col-subj">Matière / Discipline</th>
                <th class="col-score">C.C 1</th>
                <th class="col-score">C.C 2</th>
                <th class="col-score">C.C 3</th>
                <th class="col-score">Activités</th>
                <th class="col-avg">Moyenne</th>
                <th class="col-coeff">Coeff</th>
                <th class="col-pts">Points</th>
                <th class="col-stat">Min / Max</th>
                <th class="col-apprec">Appréciations des Enseignants</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Summary KPI & Honors Section -->
        <div class="summary-container">
          <div class="kpi-box">
            <div class="kpi-title">RÉSULTATS GLOBAUX DU SEMESTRE</div>
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="cell-label">Total des Points</div>
                <div class="cell-val">${rc.total_points.toFixed(2)}</div>
              </div>
              <div class="kpi-cell">
                <div class="cell-label">Total Coefficients</div>
                <div class="cell-val">${rc.total_coefficients}</div>
              </div>
              <div class="kpi-cell highlight-avg">
                <div class="cell-label">MOYENNE GÉNÉRALE</div>
                <div class="cell-val-lg">${rc.general_average.toFixed(2)} / ${maxScale}</div>
              </div>
              <div class="kpi-cell highlight-rank">
                <div class="cell-label">RANG / CLASSEMENT</div>
                <div class="cell-val-lg">${rc.rank}${rc.rank === 1 ? 'er' : 'ème'} <span class="rank-total">/ ${rc.total_students}</span></div>
              </div>
            </div>

            <!-- Assiduity & Discipline -->
            <div class="assiduity-strip">
              <span><strong>Assiduité &amp; Présence :</strong> ${rc.total_absences_hours}h d'absence (${rc.unexcused_absences_hours}h non justifiées)</span>
              <span><strong>Conduite :</strong> ${rc.conduct_mention || 'Très Bonne'}</span>
            </div>
          </div>

          <div class="decision-box">
            <div class="decision-title">DÉCISION DU CONSEIL DE CLASSE</div>
            <div class="mention-pill ${mentionBadgeClass}">${mentionText}</div>
            <div class="council-text">
              ${rc.general_average >= goodThreshold
                ? 'Le Conseil de classe félicite l’élève pour son engagement, son travail exemplaire et son assiduité constante.'
                : rc.general_average >= passThreshold
                ? 'Résultats satisfaisants. Un effort supplémentaire dans les matières principales permettra de progresser.'
                : 'Niveau insuffisant. Un suivi rigoureux et un programme de soutien scolaire sont fortement recommandés.'}
            </div>
          </div>
        </div>

        <!-- Official Signatures Footer -->
        <div class="signatures-footer">
          <div class="sig-box">
            <div class="sig-title">Le Professeur Principal</div>
            <div class="stamp-space"></div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Signature des Parents / Tuteur</div>
            <div class="stamp-space"></div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Le Directeur Pédagogique &bull; Cachet</div>
            <div class="stamp-space">
              <div class="official-seal">VISA &bull; GM SCHOOL</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="fr" dir="ltr">
      <head>
        <meta charset="utf-8" />
        <title>Bulletins Scolaires - ${schoolName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm 7mm;
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            color: #0f172a;
            font-size: 10px;
            line-height: 1.2;
            background: #ffffff;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .bulletin-sheet {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 282mm;
            max-height: 282mm;
            padding: 2px;
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
            break-after: page;
          }
          /* Header */
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 4px;
            margin-bottom: 6px;
            flex-shrink: 0;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo-img {
            width: 48px;
            height: 48px;
            object-fit: contain;
            border-radius: 6px;
          }
          .gov-text {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
            letter-spacing: 0.2px;
          }
          .school-name {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.2px;
            margin: 1px 0;
          }
          .sub-text {
            font-size: 8.5px;
            color: #64748b;
            font-weight: 600;
          }
          .header-right {
            text-align: right;
          }
          .badge-bulletin {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 900;
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 4px;
            letter-spacing: 0.4px;
            margin-bottom: 3px;
          }
          .meta-row {
            font-size: 9.5px;
            color: #334155;
          }
          /* Student ID */
          .student-id-grid {
            display: grid;
            grid-template-columns: 2fr 1.2fr 1.2fr 1fr;
            gap: 6px;
            background-color: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 10px;
            margin-bottom: 6px;
            flex-shrink: 0;
          }
          .id-item {
            display: flex;
            flex-direction: column;
          }
          .id-label {
            font-size: 8px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
          }
          .id-value {
            font-size: 11.5px;
            font-weight: 800;
            color: #0f172a;
          }
          .text-highlight {
            color: #1e3a8a;
            font-size: 12.5px;
            font-weight: 900;
          }
          .massar-font {
            font-family: monospace;
            color: #0284c7;
            font-weight: 900;
          }
          /* Table: Stretched & Vertically Balanced */
          .table-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-bottom: 6px;
            overflow: hidden;
          }
          .grades-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
          }
          .grades-table th, .grades-table td {
            border: 1px solid #475569;
            padding: 4px 5px;
            font-size: 10px;
          }
          .grades-table th {
            background-color: #e2e8f0;
            color: #0f172a;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 9px;
            text-align: center;
            height: 26px;
            letter-spacing: 0.2px;
          }
          .even-row {
            background-color: #f8fafc;
          }
          .col-subj {
            text-align: left;
            width: 27%;
            padding-left: 8px !important;
          }
          .subj-name {
            font-weight: 900;
            color: #0f172a;
            font-size: 11.5px;
            letter-spacing: 0.1px;
            line-height: 1.15;
          }
          .subj-teacher {
            font-size: 8px;
            font-weight: 600;
            color: #475569;
          }
          .col-score {
            width: 6.5%;
            font-size: 10px;
            font-weight: 600;
          }
          .col-avg {
            width: 8.5%;
            font-size: 11px;
            font-weight: 900;
            background-color: #f1f5f9;
          }
          .col-coeff {
            width: 5%;
            font-size: 10.5px;
            font-weight: 900;
          }
          .col-pts {
            width: 7%;
            font-size: 10.5px;
            font-weight: 900;
          }
          .col-stat {
            width: 10%;
            font-size: 8px;
          }
          .col-apprec {
            text-align: left;
            font-size: 8px;
            color: #334155;
            width: 26%;
          }
          .score-danger {
            color: #dc2626 !important;
            font-weight: 900;
          }
          .score-success {
            color: #16a34a !important;
            font-weight: 900;
          }
          .text-muted {
            color: #64748b;
          }
          /* Summary */
          .summary-container {
            display: grid;
            grid-template-columns: 1.3fr 1fr;
            gap: 6px;
            margin-bottom: 6px;
            flex-shrink: 0;
          }
          .kpi-box, .decision-box {
            border: 1px solid #94a3b8;
            border-radius: 6px;
            padding: 5px 7px;
            background: #ffffff;
          }
          .kpi-title, .decision-title {
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
            margin-bottom: 4px;
            letter-spacing: 0.3px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1.3fr 1.3fr;
            gap: 3px;
            text-align: center;
          }
          .kpi-cell {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 3px 2px;
          }
          .cell-label {
            font-size: 7px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
          }
          .cell-val {
            font-size: 10.5px;
            font-weight: 800;
            color: #0f172a;
          }
          .cell-val-lg {
            font-size: 12px;
            font-weight: 900;
          }
          .highlight-avg {
            background-color: #eff6ff;
            border-color: #bfdbfe;
            color: #1d4ed8;
          }
          .highlight-avg .cell-val-lg {
            color: #1d4ed8;
          }
          .highlight-rank {
            background-color: #fefce8;
            border-color: #fef08a;
            color: #854d0e;
          }
          .highlight-rank .cell-val-lg {
            color: #854d0e;
          }
          .rank-total {
            font-size: 8.5px;
            color: #713f12;
            font-weight: bold;
          }
          .assiduity-strip {
            margin-top: 4px;
            padding-top: 3px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #475569;
          }
          /* Decision & Mentions */
          .mention-pill {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 9.5px;
            font-weight: 900;
            margin-bottom: 3px;
            text-transform: uppercase;
          }
          .mention-tb { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .mention-b { background-color: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
          .mention-ab { background-color: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
          .mention-p { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
          .mention-insuff { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .council-text {
            font-size: 8px;
            color: #334155;
            line-height: 1.25;
          }
          /* Signatures */
          .signatures-footer {
            display: grid;
            grid-template-columns: 1fr 1fr 1.2fr;
            gap: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
            flex-shrink: 0;
          }
          .sig-box {
            border: 1px dashed #94a3b8;
            border-radius: 6px;
            padding: 5px;
            text-align: center;
            height: 54px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 7.5px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
          }
          .sig-space {
            font-size: 7px;
            color: #94a3b8;
            font-style: italic;
          }
          .official-seal {
            font-size: 7px;
            color: #94a3b8;
            font-weight: 900;
            letter-spacing: 1px;
            border: 1px solid #cbd5e1;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        ${bulletinsHtml}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer le bulletin.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };
}
