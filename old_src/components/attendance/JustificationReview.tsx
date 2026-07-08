// Justification Review Component
// src/components/attendance/JustificationReview.tsx

import React, { useState } from 'react';
import './AbsenceJustification.css';

interface JustificationReviewProps {
  justificationId: string;
  onSuccess?: () => void;
}

interface JustificationData {
  id: string;
  studentId: string;
  studentName: string;
  absenceDate: string;
  reason: string;
  justifiedBy: string;
  justificationDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewDate?: string;
  documentUrl?: string;
}

// Mock data - will be replaced with Supabase fetch
const mockJustifications: JustificationData[] = [
  {
    id: '1',
    studentId: 'student1',
    studentName: 'Ahmed Ben Ali',
    absenceDate: '2024-04-01',
    reason: 'Medical appointment',
    justifiedBy: 'parent',
    justificationDate: '2024-04-02',
    status: 'pending'
  }
];

const JustificationReview: React.FC<JustificationReviewProps> = ({
  justificationId,
  onSuccess
}) => {
  const [justification, setJustification] = useState<JustificationData | null>(
    mockJustifications.find(j => j.id === justificationId) || null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async (action: 'approved' | 'rejected') => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement Supabase update
      if (justification) {
        setJustification({
          ...justification,
          status: action,
          reviewedBy: 'current-user',
          reviewDate: new Date().toISOString()
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to review justification');
    } finally {
      setLoading(false);
    }
  };

  if (!justification) {
    return <div className="justification-error">Justification not found</div>;
  }

  const getJustifiedByLabel = (value: string) => {
    const labels: Record<string, string> = {
      parent: 'Parent/Guardian',
      student: 'Student',
      admin: 'Administrator',
      teacher: 'Teacher'
    };
    return labels[value] || value;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return labels[status] || status;
  };

  return (
    <div className="justification-review-container">
      <div className="justification-review-header">
        <h3>Absence Justification</h3>
        <span className={`justification-status ${justification.status}`}>
          {getStatusLabel(justification.status)}
        </span>
      </div>

      {error && <div className="justification-error">{error}</div>}

      <div className="justification-review-content">
        <div className="justification-detail">
          <label>Student</label>
          <div className="value">{justification.studentName}</div>
        </div>

        <div className="justification-detail">
          <label>Absence Date</label>
          <div className="value">{justification.absenceDate}</div>
        </div>

        <div className="justification-detail">
          <label>Justified By</label>
          <div className="value">{getJustifiedByLabel(justification.justifiedBy)}</div>
        </div>

        <div className="justification-detail">
          <label>Justification Date</label>
          <div className="value">{justification.justificationDate}</div>
        </div>

        <div className="justification-detail">
          <label>Reason</label>
          <div className="value">{justification.reason}</div>
        </div>

        {justification.documentUrl && (
          <div className="justification-document">
            <p>Supporting Document:</p>
            <a href={justification.documentUrl} target="_blank" rel="noopener noreferrer">
              View Document
            </a>
          </div>
        )}

        {justification.status === 'pending' && (
          <div className="justification-review-actions">
            <button
              className="btn-approve"
              onClick={() => handleReview('approved')}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
            <button
              className="btn-reject"
              onClick={() => handleReview('rejected')}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Reject'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JustificationReview;

