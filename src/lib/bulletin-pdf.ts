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

    // Format Moroccan Primary Subject Names with official components
    const formatSubjectDisplayName = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('arabe') || lower.includes('عربية')) {
        return `
          <div class="subj-main-title">اللغة العربية (8 مكونات رسمية)</div>
          <div class="subj-components-list">الاستماع والتحدث &bull; القراءة &bull; التراكيب &bull; الصرف والتحويل &bull; الإملاء &bull; التطبيقات الكتابية &bull; التعبير الكتابي والإنشاء &bull; مشروع الوحدة</div>
        `;
      }
      if (lower.includes('français') || lower.includes('francais')) {
        return `
          <div class="subj-main-title">Langue Française (Composantes officielles)</div>
          <div class="subj-components-list">Compréhension de l'écrit &bull; Activités de langue &bull; Production écrite &bull; Communication orale &bull; Écriture</div>
        `;
      }
      if (lower.includes('math') || lower.includes('رياضيات')) {
        return `
          <div class="subj-main-title">الرياضيات / Mathématiques</div>
          <div class="subj-components-list">الأعداد والحساب &bull; الهندسة والقياس &bull; تنظيم ومعالجة البيانات</div>
        `;
      }
      if (lower.includes('éveil') || lower.includes('eveil') || lower.includes('scientifique') || lower.includes('نشاط')) {
        return `
          <div class="subj-main-title">النشاط العلمي / Éveil Scientifique</div>
          <div class="subj-components-list">العلوم الفيزيائية والبيولوجية والتكنولوجية</div>
        `;
      }
      if (lower.includes('islam') || lower.includes('إسلامية') || lower.includes('اسلامية')) {
        return `
          <div class="subj-main-title">التربية الإسلامية / Éducation Islamique</div>
          <div class="subj-components-list">التزكية (القرآن والعقيدة) &bull; الاقتداء &bull; الاستجابة &bull; القسط &bull; الحكمة</div>
        `;
      }
      if (lower.includes('art') || lower.includes('فنية') || lower.includes('تشكيل')) {
        return `
          <div class="subj-main-title">التربية الفنية / Éducation Artistique</div>
          <div class="subj-components-list">الفنون التشكيلية والرسم &bull; الموسيقى والأناشيد &bull; المسرح</div>
        `;
      }
      if (lower.includes('physique') || lower.includes('sport') || lower.includes('بدنية')) {
        return `
          <div class="subj-main-title">التربية البدنية / Éducation Physique</div>
          <div class="subj-components-list">الأنشطة الحركية والرياضية المدرسية</div>
        `;
      }
      if (lower.includes('anglais') || lower.includes('إنجليزية') || lower.includes('انجليزية')) {
        return `
          <div class="subj-main-title">Langue Anglaise / اللغة الإنجليزية</div>
          <div class="subj-components-list">Oral communication &bull; Reading &bull; Writing activities</div>
        `;
      }
      if (lower.includes('amazigh') || lower.includes('أمازيغية')) {
        return `
          <div class="subj-main-title">اللغة الأمازيغية / Langue Amazighe</div>
          <div class="subj-components-list">تيفيناغ &bull; التواصل الشفهي &bull; القراءة والكتابة</div>
        `;
      }
      return `<div class="subj-main-title">${name}</div>`;
    };

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
            ? (isPrimary ? 'ممتاز، واصل تألقك 🌟 / Excellent' : 'Excellent travail, continuez ainsi')
            : sub.average >= goodThreshold
            ? (isPrimary ? 'عمل جيد جداً 🎖️ / Très Bon' : 'Bon travail, résultats satisfaisants')
            : sub.average >= passThreshold
            ? (isPrimary ? 'مستحسن، يمكن تحسين الأداء 👏 / Convenable' : 'Résultats convenables, peut mieux faire')
            : (isPrimary ? 'تعثر في بعض المكونات، يحتاج لدعم ⚠️ / Soutien requis' : 'Des difficultés, un travail régulier est nécessaire')
          : '—'
      );

      return `
        <tr class="${idx % 2 === 1 ? 'even-row' : ''}">
          <td class="col-subj">
            ${formatSubjectDisplayName(sub.subject_name)}
            ${sub.teacher_name ? `<div class="subj-teacher">الأستاذ(ة): ${sub.teacher_name}</div>` : ''}
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
              <div class="gov-text">المملكة المغربية &bull; وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
              <div class="school-name">${schoolName}</div>
              <div class="sub-text">${isPrimary ? 'سلك التعليم الابتدائي المعتمد &bull; Cycle Primaire MEN' : 'Enseignement Privé &bull; Maternelle - Primaire - Collège - Lycée'}</div>
            </div>
          </div>
          <div class="header-right">
            <div class="badge-bulletin">${isPrimary ? 'كشف نقط سلك الابتدائي (10/10)' : 'BULLETIN SCOLAIRE OFFICIEL'}</div>
            <div class="meta-row"><strong>الدورة / Semestre :</strong> ${rc.semester === 'S1' ? 'الدورة الأولى (S1)' : 'الدورة الثانية (S2)'}</div>
            <div class="meta-row"><strong>الموسم الدراسي :</strong> ${rc.academic_year || academicYear}</div>
          </div>
        </div>

        <!-- Student ID Card -->
        <div class="student-id-grid">
          <div class="id-item">
            <span class="id-label">${isPrimary ? 'اسم التلميذ(ة) / Nom & Prénom :' : 'Nom & Prénom :'}</span>
            <span class="id-value text-highlight">${rc.student_name}</span>
          </div>
          <div class="id-item">
            <span class="id-label">${isPrimary ? 'رمز مسار / Code Massar :' : 'Code Massar :'}</span>
            <span class="id-value massar-font">${rc.massar_code || '—'}</span>
          </div>
          <div class="id-item">
            <span class="id-label">${isPrimary ? 'المستوى والقسم / Classe :' : 'Classe :'}</span>
            <span class="id-value">${rc.class_name} (${rc.level})</span>
          </div>
          <div class="id-item">
            <span class="id-label">${isPrimary ? 'العدد الإجمالي / Effectif :' : 'Effectif :'}</span>
            <span class="id-value">${rc.total_students} تلميذاً</span>
          </div>
        </div>

        <!-- Grades Table -->
        <div class="table-wrapper">
          <table class="grades-table">
            <colgroup>
              <col style="width: 25%" />
              <col style="width: 7%" />
              <col style="width: 7%" />
              <col style="width: 7%" />
              <col style="width: 7%" />
              <col style="width: 8%" />
              <col style="width: 5%" />
              <col style="width: 7%" />
              <col style="width: 8%" />
              <col style="width: 19%" />
            </colgroup>
            <thead>
              <tr>
                <th class="col-subj">${isPrimary ? 'المواد الدراسية والمكونات (Discipline & Composantes)' : 'Matière / Discipline'}</th>
                <th class="col-score">${isPrimary ? 'الفرض 1' : 'C.C 1'}</th>
                <th class="col-score">${isPrimary ? 'الفرض 2' : 'C.C 2'}</th>
                <th class="col-score">${isPrimary ? 'الفرض 3' : 'C.C 3'}</th>
                <th class="col-score">${isPrimary ? 'الأنشطة' : 'Activités'}</th>
                <th class="col-avg">${isPrimary ? 'معدل المادة' : 'Moyenne'}</th>
                <th class="col-coeff">المعامل</th>
                <th class="col-pts">النقطة</th>
                <th class="col-stat">أدنى / أعلى</th>
                <th class="col-apprec">${isPrimary ? 'ملاحظات الأستاذ(ة) والتقويم' : 'Appréciations des Enseignants'}</th>
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
            <div class="kpi-title">${isPrimary ? 'النتائج الإجمالية للدورة / RÉSULTATS DU SEMESTRE' : 'RÉSULTATS GLOBAUX DU SEMESTRE'}</div>
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="cell-label">مجموع النقط</div>
                <div class="cell-val">${rc.total_points.toFixed(2)}</div>
              </div>
              <div class="kpi-cell">
                <div class="cell-label">مجموع المعاملات</div>
                <div class="cell-val">${rc.total_coefficients}</div>
              </div>
              <div class="kpi-cell highlight-avg">
                <div class="cell-label">المعدل العام</div>
                <div class="cell-val-lg">${rc.general_average.toFixed(2)} / ${maxScale}</div>
              </div>
              <div class="kpi-cell highlight-rank">
                <div class="cell-label">الرتبة في القسم</div>
                <div class="cell-val-lg">${rc.rank}${rc.rank === 1 ? 'er' : 'e'} <span class="rank-total">/ ${rc.total_students}</span></div>
              </div>
            </div>

            <!-- Assiduity & Discipline -->
            <div class="assiduity-strip">
              <span><strong>${isPrimary ? 'المواظبة والغياب :' : 'Assiduité :'}</strong> ${rc.total_absences_hours}h (${rc.unexcused_absences_hours}h غير مبررة)</span>
              <span><strong>${isPrimary ? 'السلوك والانضباط :' : 'Conduite :'}</strong> ${rc.conduct_mention || (isPrimary ? 'حسن جداً / Exemplaire' : 'Très Bonne')}</span>
            </div>
          </div>

          <div class="decision-box">
            <div class="decision-title">${isPrimary ? 'قرار وملاحظة مجلس القسم / CONSEIL DE CLASSE' : 'DÉCISION DU CONSEIL DE CLASSE'}</div>
            <div class="mention-pill ${mentionBadgeClass}">${mentionText}</div>
            <div class="council-text">
              ${isPrimary
                ? rc.general_average >= goodThreshold
                  ? 'يُشيد مجلس القسم بالنتائج الممتازة والانضباط النموذجي للتلميذ(ة) ويهنئه على هذا التألق والاجتهاد المستمر.'
                  : rc.general_average >= passThreshold
                  ? 'نتائج طيبة ومجهود مشجع، مع دعوة التلميذ(ة) لمزيد من التركيز ومراجعة بعض المكونات لتحقيق نتائج أعلى.'
                  : 'مستوى دون العتبة، يُوصى بمواكبة مستمرة وانخراط فعال في حصص الدعم والتقوية لتجاوز الصعوبات.'
                : rc.general_average >= goodThreshold
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
            <div class="sig-title">${isPrimary ? 'أستاذ(ة) القسم / Professeur' : 'Le Professeur Principal'}</div>
            <div class="sig-space">توقيع وملاحظة الأستاذ</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">${isPrimary ? 'توقيع ولي الأمر / Signature Parents' : 'Signature des Parents / Tuteur'}</div>
            <div class="sig-space">توقيع واطلاع الولي</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">${isPrimary ? 'مدير المؤسسة والخاتم / Direction' : 'Le Directeur Pédagogique &bull; Cachet'}</div>
            <div class="sig-space">
              <div class="official-seal">خاتم وتأشيرة الإدارة</div>
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
            margin-bottom: 6px;
            overflow: hidden;
          }
          .grades-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .grades-table th, .grades-table td {
            border: 1px solid #475569;
            padding: 4.5px 5px;
            font-size: 9.5px;
            vertical-align: middle;
            text-align: center;
          }
          .grades-table th {
            background-color: #e2e8f0;
            color: #0f172a;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 8.5px;
            text-align: center;
            height: 24px;
            letter-spacing: 0.2px;
          }
          .even-row {
            background-color: #f8fafc;
          }
          .col-subj {
            text-align: left !important;
            padding-left: 8px !important;
          }
          .subj-main-title {
            font-weight: 900;
            color: #0f172a;
            font-size: 10.5px;
            letter-spacing: 0.1px;
            line-height: 1.15;
          }
          .subj-components-list {
            font-size: 7px;
            font-weight: 600;
            color: #475569;
            margin-top: 1px;
            line-height: 1.15;
          }
          .subj-teacher {
            font-size: 7px;
            font-weight: 600;
            color: #64748b;
            margin-top: 1px;
          }
          .col-score {
            font-size: 9.5px;
            font-weight: 600;
            text-align: center;
          }
          .col-avg {
            font-size: 10.5px;
            font-weight: 900;
            background-color: #f1f5f9;
            text-align: center;
          }
          .col-coeff {
            font-size: 9.5px;
            font-weight: 800;
            text-align: center;
          }
          .col-pts {
            font-size: 9.5px;
            font-weight: 900;
            text-align: center;
          }
          .col-stat {
            font-size: 7.5px;
            text-align: center;
          }
          .col-apprec {
            text-align: left !important;
            font-size: 7.5px;
            color: #334155;
            padding-left: 6px !important;
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
