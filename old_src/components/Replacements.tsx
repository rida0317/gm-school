// src/components/Replacements.tsx - Substitution management component

import React, { useState } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { t } from '../utils/translations'
import { ReplacementGenerator } from '../services/replacementGenerator'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Replacements.css'

// Helper function to save PDF - browser download
const savePDF = async (doc: jsPDF, filename: string) => {
  // Browser download
  doc.save(filename)
}

const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Translation function for days
const getDayTranslation = (day: string, lang: string) => {
  const translations: Record<string, Record<string, string>> = {
    'Monday': { en: 'Monday', fr: 'Lundi', ar: 'الإثنين' },
    'Tuesday': { en: 'Tuesday', fr: 'Mardi', ar: 'الثلاثاء' },
    'Wednesday': { en: 'Wednesday', fr: 'Mercredi', ar: 'الأربعاء' },
    'Thursday': { en: 'Thursday', fr: 'Jeudi', ar: 'الخميس' },
    'Friday': { en: 'Friday', fr: 'Vendredi', ar: 'الجمعة' }
  }
  return translations[day]?.[lang] || translations[day]?.en || day
}

const Replacements: React.FC = () => {
  const {
    replacements,
    teachers,
    classes,
    timetables,
    addReplacement,
    deleteReplacement,
    addAbsence,
    schoolName,
    logo,
    language = 'en'
  } = useSchoolStore()

  // State for replacement generation
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [selectedAbsentTeachers, setSelectedAbsentTeachers] = useState<string[]>([])
  const [generatedReplacements, setGeneratedReplacements] = useState<any[]>([])
  const [unscheduled, setUnscheduled] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [replacementDate, setReplacementDate] = useState<string>('')

  // State for manual replacement
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualFormData, setManualFormData] = useState({
    originalTeacherId: '',
    substituteTeacherId: '',
    classId: '',
    date: '',
    slotIndex: 0,
    subject: '',
  })

  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'Unknown'
  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || 'Unknown'
  const getSubstituteName = (repl: any) => getTeacherName(repl.substituteTeacherId)

  const formatSlotTime = (slotIndex: number) => {
    const times = ['08:30-09:25', '09:25-10:20', 'Break', '10:30-11:25', '11:25-12:20', 'Lunch', '13:00-13:55', '13:55-14:50', 'Break', '15:00-15:55']
    return times[slotIndex] || `Period ${slotIndex + 1}`
  }

  const handleExportPDF = async () => {
    if (replacements.length === 0) {
      showToast('No replacements to export!', 'warning')
      return
    }
    const doc = new jsPDF('l', 'mm', 'a4')
    if (logo) {
      try {
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logo, format, 15, 10, 20, 20)
      } catch (e) { console.error('Could not add logo:', e) }
    }
    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text(schoolName, logo ? 40 : 15, 20)
    doc.setFontSize(16)
    doc.setTextColor(100)
    doc.text('Replacements Report', logo ? 40 : 15, 28)
    doc.setFontSize(12)
    doc.text(`Total: ${replacements.length} replacement(s)`, logo ? 40 : 15, 35)
    const tableColumn = ['Date', 'Period', 'Class', 'Subject', 'Original Teacher', 'Substitute Teacher']
    const tableRows = [...replacements]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(repl => [repl.date, formatSlotTime(repl.slotIndex), getClassName(repl.classId), repl.subject, getTeacherName(repl.originalTeacherId), getTeacherName(repl.substituteTeacherId)])
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [13, 110, 253] } })
    await savePDF(doc, `Replacements_${new Date().toISOString().split('T')[0]}.pdf`)
    showToast(`Exported ${replacements.length} replacements!`, 'success')
  }

  const handleGenerateReplacements = async () => {
    if (!selectedDay || selectedAbsentTeachers.length === 0) {
      showToast('Select day and teachers!', 'warning')
      return
    }
    const today = new Date()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const daysUntil = (dayNames.indexOf(selectedDay) - today.getDay() + 7) % 7 || 7
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysUntil)
    setReplacementDate(nextDate.toISOString().split('T')[0])
    setIsGenerating(true)
    try {
      const generator = new ReplacementGenerator(teachers, classes, timetables, replacements)
      const result = generator.generateMultipleReplacements(selectedAbsentTeachers, selectedDay)
      setGeneratedReplacements(result.replacements)
      setUnscheduled(result.unscheduled)
      if (result.replacements.length > 0) {
        setTimeout(() => document.querySelector('.results-step')?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (error) {
      showToast('Failed: ' + (error as Error).message, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveReplacements = () => {
    if (!replacementDate) { showToast('Select date!', 'warning'); return }
    const generator = new ReplacementGenerator(teachers, classes, timetables, replacements)
    const newReplacements = generator.convertToReplacements(generatedReplacements, replacementDate)
    newReplacements.forEach(addReplacement)
    selectedAbsentTeachers.forEach(id => addAbsence({ teacherId: id, startDate: replacementDate, endDate: replacementDate, reason: 'Replacement' }))
    showToast(`Saved ${newReplacements.length} replacements!`, 'success')
    setShowGenerationModal(false)
    setGeneratedReplacements([])
  }

  const handleClearAllReplacements = () => {
    if (confirm('⚠️ Clear ALL replacements?')) {
      replacements.forEach(r => deleteReplacement(r.id))
      showToast('Cleared!', 'success')
    }
  }

  return (
    <div className="replacements-page">
      <div className="page-header">
        <div><h1>{t('nav.replacements', language)}</h1><p>{t('replacements.manageSubstitutions', language)}</p></div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowManualModal(true)}>{t('replacements.manual', language)}</button>
          <button className="btn btn-primary" onClick={() => { setSelectedDay(''); setSelectedAbsentTeachers([]); setGeneratedReplacements([]); setShowGenerationModal(true) }}>{t('replacements.generate', language)}</button>
          {replacements.length > 0 && <button className="btn btn-success" onClick={handleExportPDF}>{t('replacements.exportPDF', language)}</button>}
        </div>
      </div>
      {replacements.length > 0 && <button className="btn btn-danger" onClick={handleClearAllReplacements} style={{ width: '100%', marginBottom: '2rem' }}>{t('replacements.clearAll', language)}</button>}
      <div className="replacements-list-container">
        <h2 className="section-title">{t('replacements.list', language)} ({replacements.length})</h2>
        {replacements.length > 0 ? (
          <div className="replacements-list">
            {replacements.map(r => (
              <div key={r.id} className="replacement-card">
                <div className="replacement-info">
                  <div className="replacement-row"><span className="label">{t('replacements.class', language)}</span><span className="value">{getClassName(r.classId)}</span></div>
                  <div className="replacement-row"><span className="label">{t('replacements.subject', language)}</span><span className="value">{r.subject}</span></div>
                  <div className="replacement-row"><span className="label">{t('replacements.originalTeacher', language)}</span><span className="value original">{getTeacherName(r.originalTeacherId)}</span></div>
                  <div className="replacement-row"><span className="label">{t('replacements.substitute', language)}</span><span className="value substitute">{getSubstituteName(r)}</span></div>
                  <div className="replacement-row"><span className="label">{t('replacements.date', language)}</span><span className="value">{r.date}</span></div>
                  <div className="replacement-row"><span className="label">{t('replacements.period', language)}</span><span className="value">{formatSlotTime(r.slotIndex)}</span></div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => { if(confirm(t('replacements.removeConfirm', language))) deleteReplacement(r.id) }}>{t('replacements.removeBtn', language)}</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon">🔄</span><h3>{t('replacements.noReplacements', language)}</h3><p>{t('replacements.generateOrAdd', language)}</p></div>
        )}
      </div>
      {/* Generation Modal */}
      {showGenerationModal && (
        <div className="modal-overlay" onClick={() => setShowGenerationModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{t('replacements.generateTitle', language)}</h2><button className="modal-close" onClick={() => setShowGenerationModal(false)}>✕</button></div>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '30px', height: '30px', borderRadius: '50%', background: selectedDay ? 'var(--success-color)' : 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{t('replacements.step1', language)}</div><span style={{ fontSize: '0.875rem', color: selectedDay ? 'var(--success-color)' : 'var(--text-color)', fontWeight: '600' }}>{t('replacements.selectDay', language)}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '30px', height: '30px', borderRadius: '50%', background: selectedDay && selectedAbsentTeachers.length > 0 ? 'var(--success-color)' : 'var(--border-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{t('replacements.step2', language)}</div><span style={{ fontSize: '0.875rem', color: selectedDay && selectedAbsentTeachers.length > 0 ? 'var(--success-color)' : 'var(--text-muted)' }}>{t('replacements.selectTeachers', language)}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '30px', height: '30px', borderRadius: '50%', background: generatedReplacements.length > 0 ? 'var(--success-color)' : 'var(--border-color)', color: generatedReplacements.length > 0 ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{t('replacements.step3', language)}</div><span style={{ fontSize: '0.875rem', color: generatedReplacements.length > 0 ? 'var(--success-color)' : 'var(--text-muted)' }}>{t('replacements.review', language)}</span></div>
            </div>
            {!selectedDay && <div style={{ background: 'linear-gradient(135deg, var(--primary-color), #0d6efd)', color: 'white', padding: '1.5rem', textAlign: 'center', fontWeight: '600' }}>{t('replacements.selectDayToBegin', language)}</div>}
            <div className="generation-wizard">
              <div className="wizard-step" style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 10 }}>
                <h3>{selectedDay ? t('replacements.daySelected', language) : t('replacements.selectDay', language)}</h3>
                <div className="day-selector">{DAYS_LIST.map(day => (<button key={day} className={`day-btn ${selectedDay === day ? 'active' : ''}`} onClick={() => { setSelectedDay(day); setSelectedAbsentTeachers([]); setGeneratedReplacements([]) }}>{getDayTranslation(day, language)}</button>))}</div>
                {selectedDay && <p style={{ color: 'var(--text-muted)' }}>{t('replacements.selected', language)} <strong>{getDayTranslation(selectedDay, language)}</strong></p>}
              </div>
              {selectedDay && (
                <div className="wizard-step">
                  <h3>{selectedAbsentTeachers.length > 0 ? t('replacements.teachersSelected', language).replace('{count}', selectedAbsentTeachers.length.toString()) : t('replacements.selectAbsentTeachers', language)}</h3>
                  <div className="teachers-absent-list">
                    {teachers.map(t => {
                      const hasClasses = true
                      return (
                        <label key={t.id} className="teacher-checkbox">
                          <input type="checkbox" checked={selectedAbsentTeachers.includes(t.id)} onChange={e => setSelectedAbsentTeachers(e.target.checked ? [...selectedAbsentTeachers, t.id] : selectedAbsentTeachers.filter(id => id !== t.id))} disabled={!hasClasses} />
                          <div className="teacher-info"><span className="teacher-name">{t.name}</span><span className="teacher-classes">{t.subjects.join(', ')}</span></div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedAbsentTeachers.length > 0 && (
                <div className="wizard-step" style={{ borderTop: '2px solid var(--primary-color)' }}>
                  <h3>{t('replacements.generateStep', language)}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{t('replacements.foundTeachers', language).replace('{count}', selectedAbsentTeachers.length.toString()).replace('{day}', getDayTranslation(selectedDay, language))}</p>
                  <button className="btn btn-primary btn-block" onClick={handleGenerateReplacements} disabled={isGenerating}>{isGenerating ? '⏳' : '🚀'} {isGenerating ? t('replacements.generating', language) : t('replacements.generateNow', language)}</button>
                </div>
              )}
              {generatedReplacements.length > 0 && (
                <div className="wizard-step results-step" style={{ borderTop: '3px solid var(--success-color)' }}>
                  <h3 style={{ color: 'var(--success-color)' }}>✅ {t('replacements.generatedCount', language).replace('{count}', generatedReplacements.length.toString()) || `Generated ${generatedReplacements.length} Replacements`}</h3>
                  <div className="replacements-preview">{generatedReplacements.map((r, i) => (<div key={i} className="replacement-preview-card"><div><strong>{t('replacements.class', language)}</strong> {r.className}</div><div><strong>{t('replacements.subject', language)}</strong> {r.subject}</div><div><strong>{t('replacements.day', language)}</strong> {r.day}</div><div><strong>{t('replacements.substitute', language)}</strong> {r.teacherName}</div></div>))}</div>
                  {unscheduled.length > 0 && <div className="unscheduled-warning"><h4>⚠️ {t('replacements.cannotSchedule', language) || `Cannot Schedule (${unscheduled.length})`}</h4><ul>{unscheduled.map((u, i) => (<li key={i}>{u.subject} - {u.className}</li>))}</ul></div>}
                  <div className="save-section">
                    <label style={{ display: 'block', marginBottom: '1rem' }}><strong>📅 {t('replacements.replacementDate', language) || 'Replacement Date:'}</strong><input type="date" value={replacementDate} onChange={e => setReplacementDate(e.target.value)} className="input" style={{ marginLeft: '1rem' }} /></label>
                    <button className="btn btn-success btn-block" onClick={handleSaveReplacements}>{t('replacements.saveReplacements', language)}</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowGenerationModal(false)}>{t('replacements.close', language)}</button></div>
          </div>
        </div>
      )}
      {/* Manual Modal */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{t('replacements.addManualTitle', language)}</h2><button className="modal-close" onClick={() => setShowManualModal(false)}>✕</button></div>
            <form onSubmit={e => { e.preventDefault(); addReplacement(manualFormData); setShowManualModal(false) }} className="replacement-form">
              <div className="form-group"><label>{t('replacements.original', language)}</label><select className="input" value={manualFormData.originalTeacherId} onChange={e => setManualFormData({ ...manualFormData, originalTeacherId: e.target.value })} required>{teachers.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div className="form-group"><label>{t('replacements.substituteTeacher', language)}</label><select className="input" value={manualFormData.substituteTeacherId} onChange={e => setManualFormData({ ...manualFormData, substituteTeacherId: e.target.value })} required>{teachers.filter(t => t.id !== manualFormData.originalTeacherId).map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div className="form-group"><label>{t('replacements.selectClass', language)}</label><select className="input" value={manualFormData.classId} onChange={e => setManualFormData({ ...manualFormData, classId: e.target.value })} required>{classes.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
              <div className="form-group"><label>{t('replacements.subject', language)}</label><input type="text" className="input" value={manualFormData.subject} onChange={e => setManualFormData({ ...manualFormData, subject: e.target.value })} required /></div>
              <div className="form-row"><div className="form-group"><label>{t('replacements.date', language)}</label><input type="date" className="input" value={manualFormData.date} onChange={e => setManualFormData({ ...manualFormData, date: e.target.value })} required /></div><div className="form-group"><label>{t('replacements.period', language)}</label><select className="input" value={manualFormData.slotIndex} onChange={e => setManualFormData({ ...manualFormData, slotIndex: parseInt(e.target.value) })} required><option value="0">08:30-09:25</option><option value="1">09:25-10:20</option><option value="3">10:30-11:25</option><option value="4">11:25-12:20</option><option value="6">13:00-13:55</option><option value="7">13:55-14:50</option><option value="9">15:00-15:55</option></select></div></div>
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)}>{t('grades.cancel', language)}</button><button type="submit" className="btn btn-primary">{t('replacements.addReplacement', language)}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Replacements

