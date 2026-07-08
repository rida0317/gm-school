// src/components/QRCodeScanner.tsx - Scan QR codes for student attendance

import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode'
import { useStudents } from '../store/studentsStore'
import { useSchoolStore } from '../store/schoolStore'
import { useAttendanceStore } from '../store/attendanceStore'
import './QRCodeScanner.css'

interface ScannedStudent {
  id: string
  name: string
  classId: string
  codeMassar?: string
  scannedAt: string
  status: 'present' | 'late' | 'already-scanned'
}

const QRCodeScanner: React.FC = () => {
  const students = useStudents()
  const { schoolName } = useSchoolStore()
  const { markPresent } = useAttendanceStore()
  
  const [isScanning, setIsScanning] = useState(false)
  const [scannedStudents, setScannedStudents] = useState<ScannedStudent[]>([])
  const [lastScan, setLastScan] = useState<ScannedStudent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [scanDate, setScanDate] = useState(new Date().toISOString().split('T')[0])
  
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const startScanner = async () => {
    try {
      setError(null)
      const html5QrCode = new Html5Qrcode('qr-reader')
      scannerRef.current = html5QrCode

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      )

      setIsScanning(true)
    } catch (err) {
      console.error('Error starting scanner:', err)
      setError('❌ Impossible de démarrer le scanner. Vérifiez les permissions de la caméra.')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
        setIsScanning(false)
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
  }

  const onScanSuccess = (decodedText: string) => {
    try {
      // Parse QR data
      const qrData = JSON.parse(decodedText)
      
      // Find student in database
      const student = students.find(s => s.id === qrData.id)
      
      if (!student) {
        setError('⚠️ Élève non trouvé dans la base de données')
        playSound('error')
        return
      }

      // Check if already scanned today
      const alreadyScanned = scannedStudents.find(s => s.id === student.id)
      const status: ScannedStudent['status'] = alreadyScanned ? 'already-scanned' : 'present'

      const scannedStudent: ScannedStudent = {
        id: student.id,
        name: student.name,
        classId: student.classId,
        codeMassar: student.codeMassar,
        scannedAt: new Date().toISOString(),
        status
      }

      setLastScan(scannedStudent)
      
      if (!alreadyScanned) {
        setScannedStudents(prev => [scannedStudent, ...prev])
        
        // Mark attendance
        markPresent(student.id, scanDate)
        
        playSound('success')
        
        // Show success message
        setTimeout(() => {
          setLastScan(null)
        }, 3000)
      } else {
        playSound('warning')
        setTimeout(() => {
          setLastScan(null)
        }, 3000)
      }
    } catch (err) {
      console.error('Error parsing QR code:', err)
      setError('⚠️ QR code invalide')
      playSound('error')
    }
  }

  const onScanError = (error: any) => {
    // Ignore scanning errors (too noisy)
    // console.warn('Scan error:', error)
  }

  const playSound = (type: 'success' | 'error' | 'warning') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    switch (type) {
      case 'success':
        oscillator.frequency.value = 800
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
        break
      case 'error':
        oscillator.frequency.value = 300
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
        break
      case 'warning':
        oscillator.frequency.value = 500
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
        break
    }
  }

  const exportToExcel = () => {
    // Create CSV content
    const headers = ['Date', 'Heure', 'Nom', 'Classe', 'Code Massar', 'Statut']
    const rows = scannedStudents.map(s => [
      scanDate,
      new Date(s.scannedAt).toLocaleTimeString('fr-FR'),
      s.name,
      s.classId,
      s.codeMassar || '',
      s.status === 'present' ? 'Présent' : 'Déjà scanné'
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Presence_${scanDate}_${selectedClassId || 'All'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearScans = () => {
    if (confirm('Voulez-vous vraiment effacer tous les scans?')) {
      setScannedStudents([])
      setLastScan(null)
    }
  }

  const filteredStudents = selectedClassId
    ? scannedStudents.filter(s => s.classId === selectedClassId)
    : scannedStudents

  return (
    <div className="qr-scanner-container">
      <div className="scanner-header">
        <div className="header-content">
          <h1>📸 Scanner QR - Présence</h1>
          <p>Scannez les QR codes des élèves pour marquer la présence</p>
        </div>
      </div>

      {/* Controls */}
      <div className="scanner-controls">
        <div className="control-group">
          <label>Date:</label>
          <input
            type="date"
            value={scanDate}
            onChange={(e) => setScanDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>Filtrer par classe:</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {[...new Set(students.map(s => s.classId))].map(classId => (
              <option key={classId} value={classId}>{classId}</option>
            ))}
          </select>
        </div>

        <div className="control-actions">
          {!isScanning ? (
            <button className="btn-start" onClick={startScanner}>
              📸 Démarrer le scanner
            </button>
          ) : (
            <button className="btn-stop" onClick={stopScanner}>
              ⏹️ Arrêter le scanner
            </button>
          )}
          {scannedStudents.length > 0 && (
            <>
              <button className="btn-export" onClick={exportToExcel}>
                📊 Exporter Excel
              </button>
              <button className="btn-clear" onClick={clearScans}>
                🗑️ Effacer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scanner */}
      <div className="scanner-section">
        <div className="scanner-card">
          <h2>📷 Camera</h2>
          <div ref={scannerContainerRef} id="qr-reader" className="qr-reader"></div>
          
          {error && (
            <div className="error-message">{error}</div>
          )}

          {!isScanning && (
            <div className="scanner-instructions">
              <p>👆 Cliquez sur "Démarrer le scanner" pour commencer</p>
              <ul>
                <li>Assurez-vous que la caméra est accessible</li>
                <li>Présentez le QR code de l'élève devant la caméra</li>
                <li>Le scan est automatique et rapide</li>
              </ul>
            </div>
          )}
        </div>

        {/* Last Scan */}
        {lastScan && (
          <div className={`last-scan ${lastScan.status}`}>
            <div className="scan-icon">
              {lastScan.status === 'present' && '✅'}
              {lastScan.status === 'already-scanned' && '⚠️'}
            </div>
            <div className="scan-info">
              <h3>{lastScan.name}</h3>
              <p>{lastScan.classId}</p>
              <p className="scan-time">{new Date(lastScan.scannedAt).toLocaleTimeString('fr-FR')}</p>
              {lastScan.status === 'present' && (
                <span className="status-badge">Présent</span>
              )}
              {lastScan.status === 'already-scanned' && (
                <span className="status-badge duplicate">Déjà scanné</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scanned Students List */}
      <div className="scanned-list">
        <div className="list-header">
          <h2>📋 Élèves scannés ({filteredStudents.length})</h2>
          <span className="scan-count">
            Total: {scannedStudents.length} élèves
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="empty-list">
            <span className="empty-icon">📭</span>
            <p>Aucun élève scanné pour le moment</p>
          </div>
        ) : (
          <table className="scanned-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nom</th>
                <th>Classe</th>
                <th>Code Massar</th>
                <th>Heure</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr key={student.id}>
                  <td>{index + 1}</td>
                  <td className="student-name">{student.name}</td>
                  <td>{student.classId}</td>
                  <td>{student.codeMassar || '-'}</td>
                  <td>{new Date(student.scannedAt).toLocaleTimeString('fr-FR')}</td>
                  <td>
                    <span className={`status-badge status-${student.status}`}>
                      {student.status === 'present' ? '✅ Présent' : '⚠️ Déjà scanné'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Link to Generator */}
      <div className="generator-link">
        <p>📱 Besoin de générer des QR codes?</p>
        <a href="/qr-generate" className="btn-link">
          Aller au générateur QR →
        </a>
      </div>
    </div>
  )
}

export default QRCodeScanner

