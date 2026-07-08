// Absence Justification Form Component
// src/components/attendance/AbsenceJustificationForm.tsx

import React, { useState } from 'react';
import { useStudentsStore } from '../../store/studentsStore';
import './AbsenceJustification.css';

interface AbsenceJustificationFormProps {
  studentId: string;
  absenceDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AbsenceJustificationForm: React.FC<AbsenceJustificationFormProps> = ({
  studentId,
  absenceDate,
  onSuccess,
  onCancel
}) => {
  const students = useStudentsStore((state) => state.students);
  const student = students.find(s => s.id === studentId);

  const [formData, setFormData] = useState({
    reason: '',
    justificationDocument: null as File | null,
    justifiedBy: '',
    justificationDate: new Date().toISOString().split('T')[0]
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement Supabase save
      // For now, just call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit justification');
    } finally {
      setLoading(false);
    }
  };

  if (!student) {
    return <div className="justification-error">Student not found</div>;
  }

  return (
    <div className="justification-form-container">
      <div className="justification-form-header">
        <h3>Justify Absence - {student.name}</h3>
        {absenceDate && <p className="justification-date">Date: {absenceDate}</p>}
      </div>

      <form onSubmit={handleSubmit} className="justification-form">
        {error && <div className="justification-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="justifiedBy">Justified By</label>
          <select
            id="justifiedBy"
            value={formData.justifiedBy}
            onChange={(e) => setFormData({ ...formData, justifiedBy: e.target.value })}
            required
          >
            <option value="">Select...</option>
            <option value="parent">Parent/Guardian</option>
            <option value="student">Student</option>
            <option value="admin">Administrator</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="reason">Reason for Absence</label>
          <textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            required
            rows={4}
            placeholder="Enter reason for absence..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="justificationDate">Justification Date</label>
          <input
            type="date"
            id="justificationDate"
            value={formData.justificationDate}
            onChange={(e) => setFormData({ ...formData, justificationDate: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="document">Supporting Document (Optional)</label>
          <input
            type="file"
            id="document"
            onChange={(e) => setFormData({ ...formData, justificationDocument: e.target.files?.[0] || null })}
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <small>Accepted formats: PDF, JPG, PNG (Max 5MB)</small>
        </div>

        <div className="justification-form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Justification'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AbsenceJustificationForm;

