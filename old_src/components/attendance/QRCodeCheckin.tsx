// QR Code Check-in Component
// src/components/attendance/QRCodeCheckin.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useSchoolStore } from '../../store/schoolStore';
import { t } from '../../utils/translations';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import './QRCodeCheckin.css';

interface QRCodeCheckinProps {
  classId: string;
  onCheckIn?: (studentId: string, timestamp: string) => void;
}

export const QRCodeCheckin: React.FC<QRCodeCheckinProps> = ({
  classId,
  onCheckIn
}) => {
  const { language } = useSchoolStore();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const [checkInHistory, setCheckInHistory] = useState<any[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setIsScanning(true);
      
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanError
      );
    } catch (error) {
      console.error('Failed to start scanner:', error);
      alert('Failed to start camera. Please check permissions.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (error) {
        console.error('Failed to stop scanner:', error);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    try {
      // Parse QR code data (format: STUDENT:{id}:{timestamp})
      const [prefix, studentId, timestamp] = decodedText.split(':');
      
      if (prefix !== 'STUDENT') {
        alert('Invalid QR code format');
        return;
      }

      setScanResult(studentId);
      
      // Stop scanner after successful scan
      await stopScanner();

      // Process check-in
      const checkInData = {
        studentId,
        timestamp: timestamp || new Date().toISOString(),
        className: classId,
        status: 'present'
      };

      // Call API to record check-in
      // await attendanceService.recordCheckIn(checkInData);
      
      // Mock success
      setLastCheckIn({
        student_name: 'Ahmed Ali',
        student_id: studentId,
        time: new Date().toLocaleTimeString(),
        status: 'success'
      });

      // Add to history
      setCheckInHistory(prev => [checkInData, ...prev.slice(0, 9)]);

      if (onCheckIn) {
        onCheckIn(studentId, checkInData.timestamp);
      }

      // Play success sound
      playSuccessSound();

      // Auto-restart scanner after 2 seconds
      setTimeout(() => {
        if (isScanning) {
          startScanner();
        }
      }, 2000);

    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Check-in failed. Please try again.');
    }
  };

  const onScanError = (error: any) => {
    // Ignore scan errors (too noisy)
    // console.warn('Scan error:', error);
  };

  const playSuccessSound = () => {
    const audio = new Audio('/sounds/checkin-success.mp3');
    audio.play().catch(() => {}); // Ignore if file not found
  };

  const generateStudentQRCode = (studentId: string) => {
    const data = `STUDENT:${studentId}:${new Date().toISOString()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  return (
    <div className="qr-checkin">
      <div className="qr-header">
        <h3>📱 {t('attendance.qrCheckin', language) || 'QR Code Check-in'}</h3>
        <button
          className={`btn ${isScanning ? 'btn-danger' : 'btn-primary'}`}
          onClick={isScanning ? stopScanner : startScanner}
        >
          {isScanning ? '⏹️ Stop Scanner' : '📷 Start Scanner'}
        </button>
      </div>

      {/* QR Scanner */}
      {isScanning && (
        <div className="scanner-container">
          <div id="qr-reader" className="qr-reader"></div>
          <div className="scanner-overlay">
            <div className="scan-frame"></div>
            <p className="scan-instruction">
              {t('attendance.scanInstruction', language) || 'Position QR code within the frame'}
            </p>
          </div>
        </div>
      )}

      {/* Last Check-in */}
      {lastCheckIn && (
        <div className={`last-checkin ${lastCheckIn.status === 'success' ? 'success' : 'error'}`}>
          <div className="checkin-icon">
            {lastCheckIn.status === 'success' ? '✅' : '❌'}
          </div>
          <div className="checkin-info">
            <div className="student-name">{lastCheckIn.student_name}</div>
            <div className="checkin-time">{lastCheckIn.time}</div>
          </div>
        </div>
      )}

      {/* Recent Check-ins */}
      {checkInHistory.length > 0 && (
        <div className="checkin-history">
          <h4>Recent Check-ins</h4>
          <ul className="history-list">
            {checkInHistory.map((checkin, index) => (
              <li key={index}>
                <span className="student-id">{checkin.studentId}</span>
                <span className="time">
                  {new Date(checkin.timestamp).toLocaleTimeString()}
                </span>
                <span className="status present">✓</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate QR Codes */}
      <div className="generate-qr-section">
        <h4>Generate Student QR Codes</h4>
        <p className="help-text">
          Print and distribute QR codes to students for quick check-in
        </p>
        <button className="btn btn-secondary">
          📄 Download All QR Codes
        </button>
      </div>

      {/* Manual Check-in */}
      <div className="manual-checkin">
        <h4>Manual Check-in</h4>
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter Student ID or Code Massar"
            className="input"
          />
          <button className="btn btn-primary">
            Check In
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeCheckin;

