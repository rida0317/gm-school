// src/components/QRCodeGenerator.tsx - Generate QR codes for students (for attendance)

import React, { useState } from 'react'
import { useStudents } from '../store/studentsStore'
import { useSchoolStore } from '../store/schoolStore'
import './QRCodeGenerator.css'

// Using QRCode.js library via CDN or npm
// npm install qrcode
import QRCode from 'qrcode'

const QRCodeGenerator: React.FC = () => {
  const students = useStudents()
  const { schoolName, classes } = useSchoolStore()

  const [selectedClassId, setSelectedClassId] = useState('')
  const [generatedQR, setGeneratedQR] = useState<{studentId: string; qrDataUrl: string}[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const filteredStudents = selectedClassId
    ? students.filter(s => s.classId === selectedClassId)
    : students

  const generateAllQRCodes = async () => {
    setIsGenerating(true)
    const qrcodes: {studentId: string; qrDataUrl: string}[] = []

    for (const student of filteredStudents) {
      try {
        // QR data contains student info in JSON format
        const qrData = JSON.stringify({
          id: student.id,
          name: student.name,
          classId: student.classId,
          codeMassar: student.codeMassar || '',
          school: schoolName || 'School',
          generatedAt: new Date().toISOString()
        })

        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        })

        qrcodes.push({
          studentId: student.id,
          qrDataUrl
        })
      } catch (error) {
        console.error('Error generating QR for', student.name, error)
      }
    }

    setGeneratedQR(qrcodes)
    setIsGenerating(false)
  }

  const downloadQR = (qrDataUrl: string, studentName: string) => {
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `QR_${studentName.replace(/\s+/g, '_')}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAllQRs = async () => {
    for (const qr of generatedQR) {
      const student = students.find(s => s.id === qr.studentId)
      if (student) {
        downloadQR(qr.qrDataUrl, student.name)
        await new Promise(resolve => setTimeout(resolve, 200)) // Delay between downloads
      }
    }
  }

  const printAllQRs = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - ${schoolName || 'School'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .qr-card { border: 1px solid #ddd; padding: 15px; text-align: center; break-inside: avoid; }
          .qr-card img { width: 150px; height: 150px; }
          .qr-card h3 { font-size: 14px; margin: 10px 0 5px; }
          .qr-card p { font-size: 12px; color: #666; margin: 0; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>QR Codes - ${schoolName || 'School'}</h1>
        <div class="qr-grid">
    `

    generatedQR.forEach(qr => {
      const student = students.find(s => s.id === qr.studentId)
      if (student) {
        html += `
          <div class="qr-card">
            <img src="${qr.qrDataUrl}" alt="QR ${student.name}" />
            <h3>${student.name}</h3>
            <p>${student.classId}</p>
            ${student.codeMassar ? `<p>Massar: ${student.codeMassar}</p>` : ''}
          </div>
        `
      }
    })

    html += `
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="qr-generator-container">
      <div className="qr-header">
        <div className="header-content">
          <h1>📸 QR Codes Élèves</h1>
          <p>Générez les QR codes pour la présence des élèves</p>
        </div>
      </div>

      {/* Controls */}
      <div className="qr-controls">
        <div className="control-group">
          <label>Classe:</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value)
              setGeneratedQR([])
            }}
          >
            <option value="">Toutes les classes</option>
            {classes.map(classObj => (
              <option key={classObj.id} value={classObj.id}>{classObj.name}</option>
            ))}
          </select>
        </div>

        <div className="control-actions">
          <button
            className="btn-generate"
            onClick={generateAllQRCodes}
            disabled={isGenerating || filteredStudents.length === 0}
          >
            {isGenerating ? '⏳ Génération...' : `📱 Générer ${filteredStudents.length} QR codes`}
          </button>
          {generatedQR.length > 0 && (
            <>
              <button className="btn-download" onClick={downloadAllQRs}>
                📥 Tout télécharger
              </button>
              <button className="btn-print" onClick={printAllQRs}>
                🖨️ Imprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* QR Codes Grid */}
      {generatedQR.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📱</div>
          <h3>Aucun QR code généré</h3>
          <p>Sélectionnez une classe et cliquez sur "Générer" pour créer les QR codes</p>
          <div className="info-cards">
            <div className="info-card">
              <h4>📋 Comment ça marche?</h4>
              <ol>
                <li>Sélectionnez une classe</li>
                <li>Cliquez sur "Générer"</li>
                <li>Téléchargez ou imprimez les QR codes</li>
                <li>Les élèves scannent leur QR pour la présence</li>
              </ol>
            </div>
            <div className="info-card">
              <h4>💡 Utilisations</h4>
              <ul>
                <li>Marquer la présence rapidement</li>
                <li>Éviter les erreurs de saisie</li>
                <li>Suivi en temps réel</li>
                <li>Export vers Excel/PDF</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="qr-grid">
          {generatedQR.map((qr, index) => {
            const student = students.find(s => s.id === qr.studentId)
            return (
              <div key={qr.studentId} className="qr-card">
                <div className="qr-image">
                  <img src={qr.qrDataUrl} alt={`QR ${student?.name}`} />
                </div>
                <div className="qr-info">
                  <h3>{student?.name}</h3>
                  <p className="class-name">
                    {classes.find(c => c.id === student?.classId)?.name || student?.classId}
                  </p>
                  {student?.codeMassar && (
                    <p className="massar-code">Massar: {student.codeMassar}</p>
                  )}
                </div>
                <div className="qr-actions">
                  <button
                    className="btn-download-single"
                    onClick={() => downloadQR(qr.qrDataUrl, student?.name || 'Student')}
                  >
                    📥 Télécharger
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Scanner Link */}
      <div className="scanner-link">
        <h3>📸 Besoin de scanner des QR codes?</h3>
        <p>Utilisez le scanner pour marquer la présence des élèves</p>
        <a href="/attendance/scan" className="btn-link">
          Aller au Scanner →
        </a>
      </div>
    </div>
  )
}

export default QRCodeGenerator

