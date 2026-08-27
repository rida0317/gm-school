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

    // Format mentions
    let mentionBadgeClass = 'bg-slate-100 text-slate-800';
    let mentionText = 'Passable';
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

    const rowsHtml = rc.subjects.map((sub, idx) => {
      const cc1Val = sub.scores.cc1 !== null && sub.scores.cc1 !== undefined ? sub.scores.cc1.toFixed(2) : '—';
      const cc2Val = sub.scores.cc2 !== null && sub.scores.cc2 !== undefined ? sub.scores.cc2.toFixed(2) : '—';
      const cc3Val = sub.scores.cc3 !== null && sub.scores.cc3 !== undefined ? sub.scores.cc3.toFixed(2) : '—';
      const actVal = sub.scores.activities !== null && sub.scores.activities !== undefined ? sub.scores.activities.toFixed(2) : '—';
      const avgVal = sub.average !== null && sub.average !== undefined ? sub.average.toFixed(2) : '—';
      
      const weightedPoints = sub.average !== null && sub.average !== undefined ? (sub.average * sub.coefficient).toFixed(2) : '—';
      const scoreColorClass = sub.average !== null && sub.average !== undefined
        ? sub.average < 10
          ? 'score-danger'
          : sub.average >= 16
          ? 'score-success'
          : ''
        : '';

      const appreciation = sub.appreciation || (
        sub.average !== null && sub.average !== undefined
          ? sub.average >= 16
            ? 'Excellent travail, continuez ainsi'
            : sub.average >= 14
            ? 'Bon trimestre, résultats satisfaisants'
            : sub.average >= 10
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
                <div class="cell-val-lg">${rc.general_average.toFixed(2)} / 20</div>
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
              ${rc.general_average >= 14
                ? 'Le Conseil de classe félicite l’élève pour son engagement, son travail exemplaire et son assiduité constante.'
                : rc.general_average >= 10
                ? 'Résultats satisfaisants. Un effort supplémentaire dans les matières à fort coefficient permettra de progresser.'
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
            margin: 6mm 8mm;
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
            font-size: 10.5px;
            line-height: 1.25;
            background: #ffffff;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .bulletin-sheet {
            display: flex;
            flex-direction: column;
            height: 284mm;
            max-height: 284mm;
            padding: 4px;
            box-sizing: border-box;
            justify-content: flex-start;
          }
          /* Header */
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 6px;
            margin-bottom: 8px;
            flex-shrink: 0;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-img {
            width: 56px;
            height: 56px;
            object-fit: contain;
            border-radius: 6px;
          }
          .gov-text {
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
            letter-spacing: 0.2px;
          }
          .school-name {
            font-size: 15px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.3px;
            margin: 2px 0;
          }
          .sub-text {
            font-size: 9px;
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
            font-size: 11.5px;
            padding: 4px 12px;
            border-radius: 5px;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .meta-row {
            font-size: 10px;
            color: #334155;
          }
          /* Student ID */
          .student-id-grid {
            display: grid;
            grid-template-columns: 2fr 1.2fr 1.2fr 1fr;
            gap: 8px;
            background-color: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 10px;
            flex-shrink: 0;
          }
          .id-item {
            display: flex;
            flex-direction: column;
          }
          .id-label {
            font-size: 8.5px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
          }
          .id-value {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
          }
          .text-highlight {
            color: #1e3a8a;
            font-size: 13px;
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
            margin-bottom: 10px;
          }
          .grades-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
          }
          .grades-table th, .grades-table td {
            border: 1.5px solid #475569;
            padding: 7px 6px;
            font-size: 11px;
          }
          .grades-table th {
            background-color: #e2e8f0;
            color: #0f172a;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 10.5px;
            text-align: center;
            height: 32px;
            letter-spacing: 0.3px;
          }
          .even-row {
            background-color: #f8fafc;
          }
          .col-subj {
            text-align: left;
            width: 27%;
            padding-left: 10px !important;
          }
          .subj-name {
            font-weight: 900;
            color: #0f172a;
            font-size: 13px;
            letter-spacing: 0.1px;
            line-height: 1.2;
          }
          .subj-teacher {
            font-size: 9px;
            font-weight: 600;
            color: #475569;
            margin-top: 1px;
          }
          .col-score {
            width: 6.5%;
            font-size: 11px;
            font-weight: 600;
          }
          .col-avg {
            width: 8.5%;
            font-size: 12px;
            font-weight: 900;
            background-color: #f1f5f9;
          }
          .col-coeff {
            width: 5%;
            font-size: 11.5px;
            font-weight: 900;
          }
          .col-pts {
            width: 7%;
            font-size: 11.5px;
            font-weight: 900;
          }
          .col-stat {
            width: 10%;
            font-size: 8px;
          }
          .col-apprec {
            text-align: left;
            font-size: 8.5px;
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
            gap: 8px;
            margin-bottom: 8px;
          }
          .kpi-box, .decision-box {
            border: 1px solid #94a3b8;
            border-radius: 6px;
            padding: 6px 8px;
            background: #ffffff;
          }
          .kpi-title, .decision-title {
            font-size: 8.5px;
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 3px;
            margin-bottom: 5px;
            letter-spacing: 0.3px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1.3fr 1.3fr;
            gap: 4px;
            text-align: center;
          }
          .kpi-cell {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 4px 2px;
          }
          .cell-label {
            font-size: 7.5px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
          }
          .cell-val {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
          }
          .cell-val-lg {
            font-size: 13px;
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
            font-size: 9px;
            color: #713f12;
            font-weight: bold;
          }
          .assiduity-strip {
            margin-top: 5px;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #475569;
          }
          /* Decision & Mentions */
          .mention-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 900;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .mention-tb { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .mention-b { background-color: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
          .mention-ab { background-color: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
          .mention-p { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
          .mention-insuff { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .council-text {
            font-size: 8.5px;
            color: #334155;
            line-height: 1.3;
          }
          /* Signatures */
          .signatures-footer {
            display: grid;
            grid-template-columns: 1fr 1fr 1.2fr;
            gap: 10px;
            page-break-inside: avoid;
          }
          .sig-box {
            border: 1px dashed #94a3b8;
            border-radius: 6px;
            padding: 6px;
            text-align: center;
            height: 68px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
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
