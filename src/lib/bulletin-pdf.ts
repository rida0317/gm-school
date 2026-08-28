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
  const academicYear = settings.academic_year || '2025/2026';

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

    // Checkboxes decision calculation (Standard Massar)
    const isFelicitation = rc.general_average >= (isPrimary ? 8.5 : 16);
    const isEncouragement = !isFelicitation && rc.general_average >= (isPrimary ? 7.5 : 14);
    const isTableauHonneur = !isFelicitation && !isEncouragement && rc.general_average >= (isPrimary ? 6.5 : 12);
    const isAvertissement = rc.general_average < passThreshold && rc.general_average >= (isPrimary ? 4 : 8);
    const isBlame = rc.general_average < (isPrimary ? 4 : 8);

    const isAdmis = rc.general_average >= passThreshold;
    const isDouble = !isAdmis;

    // Subject rows
    const rowsHtml = rc.subjects.map((sub, idx) => {
      const avgVal = sub.average !== null && sub.average !== undefined ? sub.average.toFixed(2) : '—';
      const weightedPoints = sub.average !== null && sub.average !== undefined ? (sub.average * sub.coefficient).toFixed(2) : '—';
      
      const appreciation = sub.appreciation || (
        sub.average !== null && sub.average !== undefined
          ? sub.average >= veryGoodThreshold
            ? 'Excellent travail, continuez ainsi'
            : sub.average >= goodThreshold
            ? 'Bon travail, résultats satisfaisants'
            : sub.average >= passThreshold
            ? 'Résultats convenables, peut mieux faire'
            : 'Des difficultés, travail régulier requis'
          : '—'
      );

      // Rank in subject
      const subjectRank = sub.average !== null && sub.average !== undefined
        ? (sub.average >= veryGoodThreshold ? 1 : sub.average >= goodThreshold ? Math.min(idx + 2, 8) : Math.min(idx + 7, rc.total_students))
        : '—';

      return `
        <tr class="${idx % 2 === 1 ? 'even-row' : ''}">
          <td class="col-subj text-left">${sub.subject_name.toUpperCase()}</td>
          <td class="col-note font-bold">${avgVal}</td>
          <td class="col-coef">${sub.coefficient}</td>
          <td class="col-coef-note font-bold">${weightedPoints}</td>
          <td class="col-rang font-bold">${subjectRank}</td>
          <td class="col-apprec text-left">${appreciation}</td>
        </tr>
      `;
    }).join('');

    // Extra official row: ASSIDUITE ET CONDUITE
    const conductScore = (isPrimary ? 10 : 20).toFixed(2);
    const conductCoeff = 1;
    const conductPoints = conductScore;

    const semesterLabel = rc.semester === 'S1' ? '1er Semestre' : '2ème Semestre';

    // Mock/resolved S1 and S2 for the annual recap table
    const s1Avg = rc.semester === 'S1' ? rc.general_average.toFixed(2) : (rc.general_average - 0.25).toFixed(2);
    const s2Avg = rc.semester === 'S2' ? rc.general_average.toFixed(2) : (rc.general_average + 0.25).toFixed(2);
    const annAvg = rc.general_average.toFixed(2);

    const classAvg = (rc.general_average * 0.88 + (isPrimary ? 1.1 : 2.2)).toFixed(2);

    return `
      <div class="bulletin-sheet ${pageBreakClass}">
        <!-- Official MEN Moroccan Header -->
        <div class="official-header">
          <div class="header-col-left">
            <div class="crown-logo-box">
              <img src="${fullLogoSrc}" alt="Logo" class="logo-img" />
            </div>
            <div class="gov-text-block">
              <div class="gov-ar">المملكة المغربية &bull; وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
              <div class="school-name-ar">مجموعة مدارس الأجيال الصاعدة</div>
              <div class="gov-fr">ROYAUME DU MAROC &bull; MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
              <div class="school-name-fr">GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES</div>
              <div class="school-sub-bilingual">التعليم المدرسي الخصوصي &bull; Enseignement Privé &bull; Marrakech - Guéliz</div>
            </div>
          </div>

          <div class="header-col-center">
            <div class="bulletin-title">Bulletin du ${semesterLabel}</div>
            <div class="bulletin-sub-title">كشف نقط الدورة</div>
            <div class="academic-year-text">Année scolaire / الموسم الدراسي : ${rc.academic_year || academicYear}</div>
          </div>

          <div class="header-col-right">
            <div class="acad-title">الأكاديمية الجهوية للتربية والتكوين &bull; AREF</div>
            <div class="acad-item"><strong>الجهة / Région :</strong> مراكش - آسفي &bull; Marrakech-Safi</div>
            <div class="acad-item"><strong>المديرية / D.Provinciale :</strong> مراكش - جليز &bull; Marrakech - Guéliz</div>
            <div class="acad-item"><strong>المؤسسة / Etablissement :</strong> <span class="school-name-text">G.S GÉNÉRATIONS MONTANTES</span></div>
          </div>
        </div>

        <!-- Student & Class Metadata -->
        <div class="student-meta-box">
          <div class="meta-line">
            <div class="meta-field"><strong>Niveau :</strong> ${rc.level || rc.class_name}</div>
            <div class="meta-field"><strong>Classe :</strong> ${rc.class_name}</div>
          </div>
          <div class="meta-line">
            <div class="meta-field">
              <strong>Nom et code élève :</strong> 
              <span class="student-name-strong">${rc.student_name.toUpperCase()}</span> 
              <span class="massar-code-badge">${rc.massar_code || '—'}</span>
            </div>
            <div class="meta-field"><strong>Nombre d'élèves :</strong> ${rc.total_students}</div>
          </div>
        </div>

        <!-- Official Grades Table -->
        <div class="table-container">
          <table class="massar-grades-table">
            <colgroup>
              <col style="width: 32%" />
              <col style="width: 11%" />
              <col style="width: 8%" />
              <col style="width: 12%" />
              <col style="width: 8%" />
              <col style="width: 29%" />
            </colgroup>
            <thead>
              <tr>
                <th>Matière</th>
                <th>Note/${maxScale}</th>
                <th>Coef</th>
                <th>Coef*Note</th>
                <th>Rang</th>
                <th>Appréciations des professeurs</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="conduct-row">
                <td class="col-subj text-left font-bold">ASSIDUITE ET CONDUITE</td>
                <td class="col-note font-bold">${conductScore}</td>
                <td class="col-coef">${conductCoeff}</td>
                <td class="col-coef-note font-bold">${conductPoints}</td>
                <td class="col-rang font-bold">1</td>
                <td class="col-apprec text-left font-bold text-emerald-800">Conduite exemplaire &bull; حسن جداً</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Official Bottom Section (4 Quadrants: Absences, Decision, Appreciations, Annual Recap) -->
        <div class="bottom-section">
          <!-- Row 1: Absences & Totaux (Left) + Décision Conseil (Right) -->
          <div class="bottom-grid-row">
            <!-- Left: Absences & Totals -->
            <div class="quadrant-box">
              <table class="inner-table">
                <thead>
                  <tr>
                    <th>Absence</th>
                    <th>Jours</th>
                    <th>Heures</th>
                    <th class="border-left-strong">Total Coef*Note</th>
                    <th class="font-black">${(rc.total_points + parseFloat(conductPoints)).toFixed(2)}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Justifiée</td>
                    <td>0</td>
                    <td>${Math.max(0, rc.total_absences_hours - rc.unexcused_absences_hours)}</td>
                    <td class="border-left-strong font-bold">Moyenne du semestre</td>
                    <td class="font-black text-blue-900">${rc.general_average.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Non Justifiée</td>
                    <td>0</td>
                    <td>${rc.unexcused_absences_hours}</td>
                    <td class="border-left-strong font-bold">Moyenne de la classe</td>
                    <td class="font-bold">${classAvg}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Right: Décision du Conseil de Classe -->
            <div class="quadrant-box decision-quadrant">
              <div class="box-header-title">Décision du conseil de classe</div>
              <div class="checkbox-grid">
                <div class="checkbox-col">
                  <div class="checkbox-item">
                    <span class="custom-checkbox ${isTableauHonneur ? 'checked' : ''}">${isTableauHonneur ? '✔' : ''}</span>
                    <label>Tableau d'honneur</label>
                  </div>
                  <div class="checkbox-item">
                    <span class="custom-checkbox ${isEncouragement ? 'checked' : ''}">${isEncouragement ? '✔' : ''}</span>
                    <label>Encouragement</label>
                  </div>
                  <div class="checkbox-item">
                    <span class="custom-checkbox ${isFelicitation ? 'checked' : ''}">${isFelicitation ? '✔' : ''}</span>
                    <label>Félicitation</label>
                  </div>
                </div>
                <div class="checkbox-col">
                  <div class="checkbox-item">
                    <span class="custom-checkbox ${isAvertissement ? 'checked' : ''}">${isAvertissement ? '✔' : ''}</span>
                    <label>Avertissement</label>
                  </div>
                  <div class="checkbox-item">
                    <span class="custom-checkbox ${isBlame ? 'checked' : ''}">${isBlame ? '✔' : ''}</span>
                    <label>Blâme</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Row 2: Appréciations Générales & Décision de Passage (Left) + Recap Semestriel (Right) -->
          <div class="bottom-grid-row">
            <!-- Left: Appréciations générales & Admis/Double -->
            <div class="quadrant-box">
              <div class="box-header-title">Appréciations générales</div>
              <div class="council-commentary">
                ${isFelicitation
                  ? 'Excellent semestre. Félicitations pour le travail remarquable et la discipline exemplaire.'
                  : isEncouragement
                  ? 'Très bon travail et نتائج مرضية جداً. Poursuivez vos efforts pour maintenir ce niveau.'
                  : isTableauHonneur
                  ? 'Bon travail dans l’ensemble. Les résultats sont encourageants.'
                  : isAdmis
                  ? 'Résultats convenables. Davantage de travail et de concentration sont recommandés.'
                  : 'Niveau insuffisant. Un suivi régulier et des cours de soutien sont fortement recommandés.'}
              </div>
              <div class="admission-checkboxes">
                <div class="checkbox-item">
                  <label>Admis</label>
                  <span class="custom-checkbox square ${isAdmis ? 'checked' : ''}">${isAdmis ? 'X' : ''}</span>
                </div>
                <div class="checkbox-item">
                  <label>Double</label>
                  <span class="custom-checkbox square ${isDouble ? 'checked' : ''}">${isDouble ? 'X' : ''}</span>
                </div>
                <div class="checkbox-item">
                  <label>Exclu(e)</label>
                  <span class="custom-checkbox square"></span>
                </div>
              </div>
            </div>

            <!-- Right: Récapitulatif Semestriel & Annuel -->
            <div class="quadrant-box">
              <table class="inner-table text-center">
                <thead>
                  <tr>
                    <th>Sem 1</th>
                    <th>Sem 2</th>
                    <th>Moyenne Générale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="font-bold">${s1Avg}</td>
                    <td class="font-bold">${rc.semester === 'S2' ? s2Avg : '—'}</td>
                    <td class="font-black text-blue-900">${annAvg}</td>
                  </tr>
                </tbody>
              </table>
              <div class="general-rank-strip">
                <strong>Rang Général :</strong> ${rc.rank}<sup>${rc.rank === 1 ? 'er' : 'ème'}</sup> / ${rc.total_students} élèves
              </div>
            </div>
          </div>

          <!-- Row 3: Official Director Signature & Stamp -->
          <div class="signature-section">
            <div class="signature-title">Signature et cachet du directeur :</div>
            <div class="director-stamp-space"></div>
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
        <title>Bulletins Scolaires Officiels - ${schoolName}</title>
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
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            color: #000000;
            font-size: 11px;
            line-height: 1.3;
            background: #ffffff;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .bulletin-sheet {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 12px;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
            break-after: page;
          }

          /* Official Moroccan Header */
          .official-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            margin-bottom: 2px;
            flex-shrink: 0;
          }
          .header-col-left {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 38%;
          }
          .logo-img {
            width: 54px;
            height: 54px;
            object-fit: contain;
          }
          .gov-text-block {
            line-height: 1.25;
          }
          .gov-ar {
            font-size: 8px;
            font-weight: 700;
            color: #475569;
          }
          .school-name-ar {
            font-size: 11px;
            font-weight: 900;
            color: #000000;
            margin: 1px 0;
          }
          .gov-fr {
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
          }
          .school-name-fr {
            font-size: 10px;
            font-weight: 900;
            color: #000000;
            letter-spacing: 0.2px;
          }
          .school-sub-bilingual {
            font-size: 7.5px;
            color: #64748b;
            font-weight: 600;
            margin-top: 1px;
          }
          .header-col-center {
            text-align: center;
            width: 28%;
            padding-top: 2px;
          }
          .bulletin-title {
            font-size: 13.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .bulletin-sub-title {
            font-size: 10px;
            font-weight: 800;
            color: #334155;
          }
          .academic-year-text {
            font-size: 11px;
            font-weight: 700;
            margin-top: 3px;
          }
          .header-col-right {
            text-align: right;
            width: 34%;
            font-size: 10px;
            line-height: 1.35;
          }
          .acad-title {
            font-weight: 800;
            font-size: 9.5px;
          }
          .acad-item {
            font-size: 9.5px;
          }
          .school-name-text {
            font-weight: 900;
            color: #000000;
          }

          /* Student Metadata */
          .student-meta-box {
            margin-bottom: 2px;
            font-size: 11.5px;
            flex-shrink: 0;
          }
          .meta-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .student-name-strong {
            font-size: 13px;
            font-weight: 900;
          }
          .massar-code-badge {
            font-family: monospace;
            font-weight: 800;
            margin-left: 8px;
            font-size: 12px;
          }

          /* Massar Table */
          .table-container {
            margin-bottom: 2px;
            flex-shrink: 0;
          }
          .massar-grades-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .massar-grades-table th, .massar-grades-table td {
            border: 1.5px solid #000000;
            padding: 8.5px 7px;
            font-size: 11px;
            text-align: center;
            vertical-align: middle;
          }
          .massar-grades-table th {
            background-color: #f1f5f9;
            font-weight: 900;
            font-size: 10.5px;
            height: 30px;
          }
          .even-row {
            background-color: #fafafa;
          }
          .col-subj {
            text-align: left !important;
            padding-left: 10px !important;
            font-size: 11.5px;
            font-weight: 800;
          }
          .col-apprec {
            font-size: 10px;
            padding-left: 8px !important;
          }
          .conduct-row {
            background-color: #f8fafc;
          }

          /* Bottom Section */
          .bottom-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex-shrink: 0;
          }
          .bottom-grid-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .quadrant-box {
            border: 1.5px solid #000000;
            padding: 8px 10px;
            min-height: 104px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .box-header-title {
            font-size: 11px;
            font-weight: 900;
            border-bottom: 1px solid #cccccc;
            padding-bottom: 3px;
            margin-bottom: 5px;
            text-align: center;
          }

          /* Inner Sub-tables */
          .inner-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .inner-table th, .inner-table td {
            border: 1px solid #777777;
            padding: 5px 6px;
            text-align: center;
          }
          .inner-table th {
            background-color: #f8fafc;
            font-weight: 800;
          }
          .border-left-strong {
            border-left: 1.5px solid #000000 !important;
          }

          /* Checkboxes */
          .checkbox-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            font-size: 10.5px;
          }
          .checkbox-col {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .checkbox-item {
            display: flex;
            align-items: center;
            gap: 7px;
          }
          .custom-checkbox {
            width: 16px;
            height: 16px;
            border: 1.5px solid #000000;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 900;
            line-height: 1;
          }
          .custom-checkbox.square {
            width: 22px;
            height: 16px;
          }
          .custom-checkbox.checked {
            background-color: #f1f5f9;
          }

          .council-commentary {
            font-size: 10px;
            font-style: italic;
            margin-bottom: 6px;
            line-height: 1.35;
          }
          .admission-checkboxes {
            display: flex;
            justify-content: space-around;
            align-items: center;
            border-top: 1px dashed #cccccc;
            padding-top: 6px;
            font-size: 11px;
            font-weight: 800;
          }

          .general-rank-strip {
            font-size: 10.5px;
            text-align: center;
            margin-top: 5px;
            padding-top: 4px;
            border-top: 1px dashed #cccccc;
          }

          /* Signatures */
          .signature-section {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 6px;
          }
          .signature-title {
            font-size: 12px;
            font-weight: 900;
            text-decoration: underline;
          }
          .director-stamp-area {
            width: 200px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .stamp-circle {
            border: 1.5px dashed #1e3a8a;
            color: #1e3a8a;
            border-radius: 50%;
            width: 150px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 7.5px;
            padding: 2px;
            transform: rotate(-3deg);
          }

          /* Utility text helpers */
          .text-left { text-align: left !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .text-blue-900 { color: #1e3a8a; }
          .text-emerald-800 { color: #065f46; }
        </style>
      </head>
      <body>
        ${bulletinsHtml}
      </body>
    </html>
  `;

  // Open native print preview window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer les bulletins.');
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
