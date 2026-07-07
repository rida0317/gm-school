// src/components/PaymentReceipt.tsx - Printable payment receipt

import React from 'react'
import { createPortal } from 'react-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './PaymentReceipt.css'

interface ReceiptProps {
  receipt: {
    receiptNumber: string
    studentName: string
    className: string
    month: string
    amount: number
    paymentMethod: string
    paymentDate: string
    academicYear: string
  }
  schoolName: string
  logo?: string | null
  onClose: () => void
}

const PaymentReceipt: React.FC<ReceiptProps> = ({ receipt, schoolName, logo, onClose }) => {
  // 🛠️ Professional PDF Generation with Logo
  const generateReceiptPDF = (autoPrint = false) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Premium Header with Gradient Background
      doc.setFillColor(30, 58, 138)
      doc.rect(0, 0, 210, 40, 'F')

      // Add Logo if available
      if (logo) {
        try {
          const imgData = logo
          doc.addImage(imgData, 'PNG', 15, 8, 24, 24)
        } catch (e) {

        }
      }

      // School Name in White
      doc.setFontSize(22)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(schoolName, 105, 20, { align: 'center' })

      doc.setFontSize(16)
      doc.setTextColor(251, 191, 36)
      doc.text('REÇU DE PAIEMENT', 105, 30, { align: 'center' })

      // Receipt Number Badge
      doc.setFillColor(251, 191, 36)
      doc.roundedRect(140, 45, 55, 12, 2, 2, 'F')
      doc.setFontSize(10)
      doc.setTextColor(30, 58, 138)
      doc.setFont('helvetica', 'bold')
      doc.text(`N° ${receipt.receiptNumber}`, 167, 52.5, { align: 'center' })

      // Info Section
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${receipt.paymentDate}`, 15, 65)
      doc.text(`Année: ${receipt.academicYear}`, 15, 72)

      // Student Info Box
      doc.setFillColor(245, 247, 250)
      doc.roundedRect(15, 80, 180, 25, 3, 3, 'F')
      
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 138)
      doc.setFont('helvetica', 'bold')
      doc.text('INFORMATIONS ÉLÈVE', 20, 88)
      
      doc.setFontSize(10)
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
      doc.text(`Élève: ${receipt.studentName}`, 20, 96)
      doc.text(`Classe: ${receipt.className}`, 110, 96)

      // Payment Details Table
      const tableData = [
        ['Mois', receipt.month],
        ['Mode de paiement', receipt.paymentMethod.toUpperCase()],
      ]

      autoTable(doc, {
        startY: 115,
        head: [['DÉTAIL DU PAIEMENT', '']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 90 }
        }
      })

      // Amount Section with Premium Styling
      const finalY = (doc as any).lastAutoTable?.finalY || 130
      
      // Total Amount Box
      doc.setFillColor(30, 58, 138)
      doc.roundedRect(100, finalY + 10, 95, 20, 3, 3, 'F')
      
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('MONTANT PAYÉ', 147, finalY + 18, { align: 'center' })
      
      doc.setFontSize(16)
      doc.setTextColor(251, 191, 36)
      doc.text(`${receipt.amount.toFixed(2)} DH`, 147, finalY + 26, { align: 'center' })

      // Payment Status Badge
      doc.setFillColor(16, 185, 129)
      doc.circle(185, finalY + 15, 8, 'F')
      doc.setFontSize(14)
      doc.text('✓', 185, finalY + 18, { align: 'center' })

      // Signature Section
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'normal')
      doc.text('Signature & Cachet:', 15, finalY + 45)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(15, finalY + 55, 70, finalY + 55)

      // Thank You Message with Icon
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'italic')
      doc.text('Merci pour votre confiance', 105, finalY + 65, { align: 'center' })

      // Footer with School Info
      doc.setFillColor(245, 247, 250)
      doc.rect(0, 270, 210, 20, 'F')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 105, 278, { align: 'center' })
      doc.text(`${schoolName} - Tous droits réservés © ${new Date().getFullYear()}`, 105, 284, { align: 'center' })

      // Download the file
      doc.save(`Recu_${receipt.receiptNumber}.pdf`)

      if (autoPrint) {
        alert("✅ Le PDF a été généré. Veuillez l'ouvrir et l'imprimer.");
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('❌ Erreur lors de la génération du PDF')
    }
  }

  const handlePrint = () => generateReceiptPDF(true)
  const handleDownloadPDF = () => generateReceiptPDF(false)

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, string> = {
      especes: '💵',
      cheque: '📝',
      virement: '🏦'
    }
    return icons[method] || '💳'
  }

  return createPortal(
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-header-actions" style={{ background: '#fff', borderBottom: '2px solid #e0e0e0' }}>
          <div className="action-buttons">
            <button 
              className="btn-print" 
              onClick={handlePrint}
              style={{ 
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(30, 58, 138, 0.3)'
              }}
            >
              🖨️ Imprimer
            </button>
            <button 
              className="btn-download" 
              onClick={handleDownloadPDF}
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              📥 Télécharger PDF
            </button>
          </div>
          <button 
            className="btn-close" 
            onClick={onClose}
            style={{ 
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '8px 12px',
              borderRadius: '8px'
            }}
          >
            ✕
          </button>
        </div>

        <div className="receipt-container" id="receipt-to-print">
          {/* Receipt Header */}
          <div className="receipt-header">
            <div className="school-logo">🏫</div>
            <h1 className="school-name">{schoolName}</h1>
            <h2 className="receipt-title">REÇU DE PAIEMENT</h2>
            <p className="receipt-subtitle">Frais de Scolarité</p>
          </div>

          {/* Receipt Info */}
          <div className="receipt-info">
            <div className="info-row">
              <span className="info-label">Reçu N°:</span>
              <span className="info-value receipt-number">{receipt.receiptNumber}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Date:</span>
              <span className="info-value">{receipt.paymentDate}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Année scolaire:</span>
              <span className="info-value">{receipt.academicYear}</span>
            </div>
          </div>

          {/* Student Info */}
          <div className="student-section">
            <h3>Informations Élève</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Élève:</span>
                <span className="value">{receipt.studentName}</span>
              </div>
              <div className="info-item">
                <span className="label">Classe:</span>
                <span className="value">{receipt.className}</span>
              </div>
              <div className="info-item">
                <span className="label">Payé par:</span>
                <span className="value">{receipt.payerName}</span>
              </div>
              <div className="info-item">
                <span className="label">Reçu par:</span>
                <span className="value">{receipt.receiverName}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="payment-section">
            <h3>Détail du Paiement</h3>
            <div className="payment-details">
              <div className="detail-row">
                <span className="detail-label">Mois:</span>
                <span className="detail-value">{receipt.month}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Mode de paiement:</span>
                <span className="detail-value">
                  {getPaymentMethodIcon(receipt.paymentMethod)} {receipt.paymentMethod.charAt(0).toUpperCase() + receipt.paymentMethod.slice(1)}
                </span>
              </div>
              <div className="detail-row total">
                <span className="detail-label">MONTANT PAYÉ:</span>
                <span className="detail-value amount">{receipt.amount.toFixed(0)} DH</span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="payment-status">
            <div className="status-badge paid">
              ✅ PAYÉ
            </div>
          </div>

          {/* Footer */}
          <div className="receipt-footer">
            <div className="signature-section">
              <p className="signature-label">Signature & Cachet:</p>
              <div className="signature-line"></div>
            </div>
            <div className="thank-you">
              Merci pour votre confiance
            </div>
          </div>

           {/* Print-only footer */}
           <div className="print-footer">
             <p>{schoolName}</p>
             <p>Document généré le {new Date().toLocaleString('fr-FR')}</p>
           </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PaymentReceipt

