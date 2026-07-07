import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  parseMassarFile,
  Student as MassarStudent,
  ParseError,
} from "../utils/massarParser";
import "./MassarImport.css";

interface MassarImportProps {
  onImport?: (students: MassarStudent[]) => Promise<void>;
  onClose?: () => void;
}

export default function MassarImport({
  onImport,
  onClose,
}: MassarImportProps) {
  const [students, setStudents] = useState<MassarStudent[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [warnings, setWarnings] = useState<ParseError[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsParsing(true);
    setStudents([]);
    setErrors([]);
    setWarnings([]);
    setImportSuccess(false);

    try {
      const result = await parseMassarFile(file);
      setStudents(result.students);
      setErrors(result.errors);
      setWarnings(result.warnings);
    } catch (error) {
      setErrors([
        {
          row: 0,
          field: "file",
          value: undefined,
          message: "Failed to parse file. Make sure it's a valid Excel file.",
        },
      ]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleImport = async () => {
    if (!onImport || students.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(students);
      setImportSuccess(true);
    } catch (error) {
      setErrors([
        {
          row: 0,
          field: "import",
          value: undefined,
          message: "Failed to import students. Please try again.",
        },
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setStudents([]);
    setErrors([]);
    setWarnings([]);
    setImportSuccess(false);
  };

  const hasCriticalErrors = errors.length > 0;

  return (
    <div className="massar-import">
      <div className="massar-import-header">
        <h2>📥 Import Massar</h2>
        <p className="massar-import-subtitle">
          Import students from Massar Excel file
        </p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? "dropzone-active" : ""} ${
          students.length > 0 ? "dropzone-hidden" : ""
        }`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <div className="dropzone-icon">📁</div>
          {isDragActive ? (
            <p>Drop the file here...</p>
          ) : (
            <>
              <p className="dropzone-text">
                Drag & Drop Massar Excel file here
              </p>
              <p className="dropzone-hint">or click to select file</p>
              <p className="dropzone-formats">Supported: .xlsx, .xls</p>
            </>
          )}
        </div>
      </div>

      {/* Parsing State */}
      {isParsing && (
        <div className="parsing-state">
          <div className="spinner"></div>
          <p>Parsing file...</p>
        </div>
      )}

      {/* Results */}
      {students.length > 0 && !isParsing && (
        <div className="results-section">
          {/* Summary */}
          <div className="import-summary">
            <div className="summary-card success">
              <span className="summary-icon">✅</span>
              <div className="summary-info">
                <span className="summary-count">{students.length}</span>
                <span className="summary-label">Students Valid</span>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="summary-card warning">
                <span className="summary-icon">⚠️</span>
                <div className="summary-info">
                  <span className="summary-count">{warnings.length}</span>
                  <span className="summary-label">Warnings</span>
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="summary-card error">
                <span className="summary-icon">❌</span>
                <div className="summary-info">
                  <span className="summary-count">{errors.length}</span>
                  <span className="summary-label">Errors</span>
                </div>
              </div>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="errors-section">
              <h3>❌ Errors</h3>
              <div className="errors-list">
                {errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-row">Row {error.row}:</span>
                    <span className="error-message">{error.message}</span>
                  </div>
                ))}
                {errors.length > 10 && (
                  <p className="more-errors">
                    +{errors.length - 10} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="warnings-section">
              <h3>⚠️ Warnings</h3>
              <div className="warnings-list">
                {warnings.slice(0, 5).map((warning, index) => (
                  <div key={index} className="warning-item">
                    <span className="warning-row">Row {warning.row}:</span>
                    <span className="warning-message">{warning.message}</span>
                  </div>
                ))}
                {warnings.length > 5 && (
                  <p className="more-warnings">
                    +{warnings.length - 5} more warnings
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="preview-section">
            <h3>📋 Preview ({students.length} students)</h3>
            <div className="table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Code Massar</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Genre</th>
                    <th>Date Naissance</th>
                    <th>Lieu Naissance</th>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(0, 10).map((student, index) => (
                    <tr key={index}>
                      <td className="code-cell">{student.codeMassar}</td>
                      <td>{student.nom}</td>
                      <td>{student.prenom}</td>
                      <td>{student.genre}</td>
                      <td>{student.dateNaissance || "-"}</td>
                      <td>{student.lieuNaissance || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length > 10 && (
                <p className="more-rows">
                  +{students.length - 10} more students (scroll to see all)
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="actions-section">
            {!importSuccess ? (
              <>
                <button
                  className="btn-import"
                  onClick={handleImport}
                  disabled={hasCriticalErrors || isImporting}
                >
                  {isImporting ? (
                    <>
                      <span className="spinner-small"></span>
                      Importing...
                    </>
                  ) : (
                    <>
                      📥 Import {students.length} Students
                    </>
                  )}
                </button>
                <button className="btn-reset" onClick={handleReset}>
                  🔄 Reset
                </button>
              </>
            ) : (
              <div className="success-message">
                <span className="success-icon">✅</span>
                <p>Successfully imported {students.length} students!</p>
                <button className="btn-reset" onClick={handleReset}>
                  🔄 Import Another File
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No errors, no students */}
      {!isParsing && students.length === 0 && errors.length === 0 && (
        <div className="empty-state">
          <p>No file uploaded yet</p>
        </div>
      )}

      {/* Close button */}
      {onClose && (
        <button className="btn-close" onClick={onClose}>
          ✕ Close
        </button>
      )}
    </div>
  );
}

