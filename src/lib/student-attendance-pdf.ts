import { Student, StudentAttendance } from '@/types/database';
import { SchoolSettings } from '@/lib/settings';
import { formatDelayDuration } from '@/app/attendance/students/page';

export interface PrintIndividualReportOptions {
  student: Student;
  attendanceRecords: StudentAttendance[];
  settings: Partial<SchoolSettings>;
  periodLabel?: string;
  isTeacher?: boolean;
}

export function printIndividualStudentAttendanceReport({
  student,
  attendanceRecords,
  settings,
  periodLabel,
  isTeacher = false,
}: PrintIndividualReportOptions) {
  const studentRecords = (attendanceRecords || []).filter(
    (r) => r.student_id === student.id
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let presentCount = 0;
  let lateCount = 0;
  let totalLateMins = 0;
  let lateJustifiedCount = 0;
  let absentCount = 0;
  let absentJustifiedCount = 0;

  studentRecords.forEach((r) => {
    if (r.status === 'PRESENT') {
      presentCount++;
    } else if (r.status === 'LATE') {
      lateCount++;
      totalLateMins += r.late_minutes || 0;
      if (r.is_justified) lateJustifiedCount++;
    } else if (r.status === 'ABSENT' || r.status === 'EXCUSED') {
      absentCount++;
      if (r.is_justified || r.status === 'EXCUSED') absentJustifiedCount++;
    }
  });

  const totalRecordedDays = presentCount + lateCount + absentCount;
  const assiduityRate =
    totalRecordedDays > 0
      ? Math.round(((presentCount + lateCount) / totalRecordedDays) * 100)
      : 100;

  const incidents = studentRecords.filter(
    (r) => r.status === 'ABSENT' || r.status === 'EXCUSED' || r.status === 'LATE'
  );

  const logoUrl = settings.logo_url || '/logo.png';
  const fullLogoSrc = logoUrl.startsWith('http')
    ? logoUrl
    : typeof window !== 'undefined'
    ? `${window.location.origin}${logoUrl}`
    : logoUrl;

  const phones = [student.phone, student.guardian_phone].filter(Boolean).join(' / ');

  const html = `
    <!DOCTYPE html>
    <html lang="fr" dir="ltr">
      <head>
        <meta charset="utf-8" />
        <title>Fiche d'Assiduité - ${student.first_name} ${student.last_name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.35;
          }
          .header-container {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-img {
            width: 52px;
            height: 52px;
            object-fit: contain;
            border-radius: 8px;
          }
          .gov {
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            color: #475569;
          }
          .school {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
            letter-spacing: 0.3px;
          }
          .doc-badge {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 900;
            font-size: 11px;
            padding: 5px 12px;
            border-radius: 4px;
            text-transform: uppercase;
            text-align: center;
          }
          .meta-info {
            font-size: 9.5px;
            font-weight: bold;
            color: #475569;
            margin-top: 4px;
            text-align: right;
          }

          /* Student Profile Box */
          .profile-box {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            font-size: 10.5px;
          }
          .profile-item {
            display: flex;
            align-items: center;
          }
          .profile-label {
            font-weight: bold;
            color: #475569;
            width: 120px;
            shrink: 0;
          }
          .profile-val {
            font-weight: 800;
            color: #0f172a;
          }

          /* KPI Summary Bar */
          .kpi-container {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 10px;
            text-align: center;
            background: #ffffff;
          }
          .kpi-card.highlight {
            background: #f0fdf4;
            border-color: #86efac;
          }
          .kpi-card.alert {
            background: #fef2f2;
            border-color: #fca5a5;
          }
          .kpi-title {
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            color: #64748b;
          }
          .kpi-val {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
          }
          .kpi-sub {
            font-size: 8px;
            color: #64748b;
            font-weight: 600;
            margin-top: 1px;
          }

          /* Section Title */
          .section-title {
            font-size: 11px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 14px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
          }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 5px 7px;
            text-align: left;
          }
          th {
            background-color: #e2e8f0;
            color: #0f172a;
            font-weight: 800;
            font-size: 9px;
            text-transform: uppercase;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .col-num { width: 24px; text-align: center; font-weight: bold; }
          .col-date { width: 75px; font-weight: bold; font-family: monospace; }
          .col-type { width: 80px; font-weight: 800; text-align: center; }
          .col-dur { width: 65px; text-align: center; font-weight: bold; }
          .col-just { width: 100px; text-align: center; font-weight: 800; }
          .badge-present { color: #15803d; font-weight: bold; }
          .badge-absent { color: #b91c1c; font-weight: bold; }
          .badge-late { color: #b45309; font-weight: bold; }
          .badge-just-yes { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; }
          .badge-just-no { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; }

          /* Empty State */
          .empty-box {
            background: #f0fdf4;
            border: 1.5px dashed #86efac;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            color: #166534;
            font-weight: bold;
            font-size: 11px;
            margin-top: 6px;
          }

          /* Footer Signatures */
          .footer-container {
            margin-top: 25px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            page-break-inside: avoid;
          }
          .sign-box {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px;
            height: 75px;
            text-align: center;
            font-size: 9.5px;
            font-weight: bold;
            color: #334155;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sign-placeholder {
            height: 45px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="header-left">
            <img src="${fullLogoSrc}" alt="Logo" class="logo-img" />
            <div>
              <div class="gov">Royaume du Maroc &bull; Ministère de l'Éducation Nationale</div>
              <div class="school">${settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}</div>
            </div>
          </div>
          <div>
            <div class="doc-badge">Fiche d'Assiduité Individuelle</div>
            <div class="meta-info">Année Scolaire : ${settings.academic_year || '2025-2026'}</div>
          </div>
        </div>

        <!-- Student Information Card -->
        <div class="profile-box">
          <div class="profile-item">
            <span class="profile-label">Nom &amp; Prénom :</span>
            <span class="profile-val" style="font-size: 12px; color: #1d4ed8;">${student.first_name} ${student.last_name}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Code Massar :</span>
            <span class="profile-val" style="font-family: monospace;">${student.student_code || '-'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Classe / Niveau :</span>
            <span class="profile-val">${student.class?.name || '-'} (${student.class?.level || '-'})</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Genre :</span>
            <span class="profile-val">${student.gender === 'F' ? 'Féminin (Fille)' : 'Masculin (Garçon)'}</span>
          </div>
          ${
            !isTeacher && student.guardian_name
              ? `
          <div class="profile-item">
            <span class="profile-label">Parent / Tuteur :</span>
            <span class="profile-val">${student.guardian_name}</span>
          </div>
          `
              : ''
          }
          ${
            !isTeacher && phones
              ? `
          <div class="profile-item">
            <span class="profile-label">Contact Parent :</span>
            <span class="profile-val" style="font-family: monospace;">${phones}</span>
          </div>
          `
              : ''
          }
          <div class="profile-item">
            <span class="profile-label">Période du Bilan :</span>
            <span class="profile-val">${periodLabel || "Année Scolaire en cours"}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Date d'édition :</span>
            <span class="profile-val">${new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="kpi-container">
          <div class="kpi-card highlight">
            <div class="kpi-title">Taux d'Assiduité</div>
            <div class="kpi-val" style="color: ${assiduityRate >= 90 ? '#15803d' : '#b91c1c'};">${assiduityRate}%</div>
            <div class="kpi-sub">${presentCount + lateCount} présences / ${totalRecordedDays} jours</div>
          </div>

          <div class="kpi-card ${absentCount > 0 ? 'alert' : ''}">
            <div class="kpi-title">Total Absences</div>
            <div class="kpi-val" style="color: #b91c1c;">${absentCount}</div>
            <div class="kpi-sub">${absentJustifiedCount} justifiée(s) &bull; ${absentCount - absentJustifiedCount} non-justifiée(s)</div>
          </div>

          <div class="kpi-card ${lateCount > 0 ? 'alert' : ''}">
            <div class="kpi-title">Total Retards</div>
            <div class="kpi-val" style="color: #b45309;">${lateCount}</div>
            <div class="kpi-sub">${totalLateMins > 0 ? `${totalLateMins} min cumulées` : '0 min'} &bull; ${lateJustifiedCount} justifié(s)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Jours Enregistrés</div>
            <div class="kpi-val">${totalRecordedDays}</div>
            <div class="kpi-sub">Total pointages effectués</div>
          </div>
        </div>

        <!-- Absence & Delay Chronological Log -->
        <div class="section-title">
          <span>Historique Détaillé des Absences et Retards</span>
          <span style="font-size: 9.5px; font-weight: bold; color: #64748b;">${incidents.length} incident(s) répertorié(s)</span>
        </div>

        ${
          incidents.length === 0
            ? `
          <div class="empty-box">
            ✅ <strong>Félicitations !</strong> Aucun retard ni absence n'a été enregistré pour cet élève sur cette période.<br />
            <span style="font-size: 9.5px; opacity: 0.85;">Comportement et assiduité exemplaires.</span>
          </div>
        `
            : `
          <table>
            <thead>
              <tr>
                <th class="col-num">N°</th>
                <th class="col-date">Date</th>
                <th class="col-type">Nature</th>
                <th class="col-dur">Durée</th>
                <th class="col-just">Justification</th>
                <th>Motif &amp; Observations</th>
              </tr>
            </thead>
            <tbody>
              ${incidents
                .map((r, idx) => {
                  const isLate = r.status === 'LATE';
                  const isJust = r.is_justified || r.status === 'EXCUSED';
                  return `
                  <tr>
                    <td class="col-num">${idx + 1}</td>
                    <td class="col-date">${r.date}</td>
                    <td class="col-type">
                      <span class="${isLate ? 'badge-late' : 'badge-absent'}">
                        ${isLate ? 'RETARD' : 'ABSENCE'}
                      </span>
                    </td>
                    <td class="col-dur">${isLate ? `${r.late_minutes || 15} min` : 'Journée'}</td>
                    <td class="col-just">
                      <span class="${isJust ? 'badge-just-yes' : 'badge-just-no'}">
                        ${isJust ? 'JUSTIFIÉ' : 'NON JUSTIFIÉ'}
                      </span>
                    </td>
                    <td>${r.justification_reason || r.notes || '-'}</td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        `
        }

        <!-- Signatures Box -->
        <div class="footer-container">
          <div class="sign-box">
            <div>Émargement du Parent / Tuteur</div>
            <div class="sign-placeholder"></div>
          </div>
          <div class="sign-box">
            <div>Signature du Professeur / Enseignant</div>
            <div class="sign-placeholder"></div>
          </div>
          <div class="sign-box">
            <div>Cachet et Signature de la Direction</div>
            <div class="sign-placeholder"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 200);
          };
        </script>
      </body>
    </html>
  `;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }
}
