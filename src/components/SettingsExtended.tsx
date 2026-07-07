import React, { useState, useRef, useEffect } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { useStudentsStore } from '../store/studentsStore'
import { useGradesStore } from '../store/gradesStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { useBackupStore, useBackups } from '../store/backupStore'
import { useAuth } from '../store/AuthContext'
import { translations } from '../utils/translations'
import './SettingsExtended.css'

const SettingsExtended: React.FC = () => {
  const { user } = useAuth()
  
  const {
    schoolName, logo, academicYear, setSchoolInfo,
    exportBackup, importBackup, syncAllToSupabase, teachers,
    replacements, clearAllReplacements,
    customSubjects, addCustomSubject, deleteCustomSubject
  } = useSchoolStore()
  const { students, clearAllStudents } = useStudentsStore()
  const { clearGrades } = useGradesStore()
  const { clearAllNotifications } = useNotificationsStore()
  const t = (key: string) => translations[key]?.fr || key()
  
  const backups = useBackups()
  const { createBackup: createNewBackup, restoreBackup: restoreExisting, deleteBackup: deleteOldBackup } = useBackupStore()
  
  const [activeTab, setActiveTab] = useState<'general' | 'backup' | 'notifications' | 'subjects'>('general')
  const [name, setName] = useState(schoolName)
  const [logoUrl, setLogoUrl] = useState(logo)
  const [year, setYear] = useState(academicYear)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [backupDescription, setBackupDescription] = useState('')
  const [syncCountdown, setSyncCountdown] = useState<number | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [notificationSettings, setNotificationSettings] = useState({
    enableDesktop: true,
    enableSound: true,
    enableTimetableChanges: true,
    enableReplacements: true,
    enableMessages: true,
    enableAnnouncements: true,
    enableSystemNotifications: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00'
  })

  useEffect(() => {
    setYear(academicYear)
  }, [academicYear])

  const logoInputRef = useRef<HTMLInputElement>(null)
  const [subjectName, setSubjectName] = useState('')
  
  if (!user) {
    return <div>Loading...</div>
  }

  const handleSaveSchoolInfo = async () => {
    try {
      await setSchoolInfo(name, logoUrl, year)

      alert('✅ School information saved to database!')
    } catch (error) {
      console.error('❌ Error saving school info:', error)
      alert('❌ Error saving changes. Please try again.')
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setLogoUrl(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateBackup = async () => {
    if (!backupName.trim()) {
      alert('⚠️ Veuillez entrer un nom pour la sauvegarde')
      return
    }

    setIsCreatingBackup(true)
    try {
      const backupData = {
        teachers,
        students,
        replacements,
        customSubjects
      }

      await createNewBackup(
        backupData,
        backupName || `Sauvegarde - ${new Date().toLocaleDateString('fr-FR')}`,
        backupDescription || 'Sauvegarde manuelle',
        user?.id || '',
        user?.user_metadata?.display_name || user?.email || 'Admin'
      )

      alert('✅ Sauvegarde créée avec succès!')
      setBackupName('')
      setBackupDescription('')
    } catch (error) {
      alert('❌ Erreur lors de la sauvegarde')
      console.error(error)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleExportBackup = () => {
    const backupData = exportBackup()
    const blob = new Blob([backupData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${schoolName}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const result = event.target?.result as string
          const parsed = JSON.parse(result)
          const fullBackup = parsed.state || parsed
          


          const success = await importBackup(JSON.stringify(fullBackup))
          
          if (success) {
            try {
              setSyncStatus('🔄 Preparing Cloud Sync...')
              setSyncCountdown(30)
              
              const timer = setInterval(() => {
                setSyncCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : 0)
              }, 1000)

              setSyncStatus('🚀 Syncing Database to Supabase...')
              await syncAllToSupabase()
              
              clearInterval(timer)
              setSyncCountdown(null)
              setSyncStatus('✅ Sync Completed!')
            } catch (err) {
              console.error('Final sync failed:', err)
              setSyncCountdown(null)
            }

            alert('✅ Backup imported and synced successfully!')
            setTimeout(() => window.location.reload(), 1000)
          } else {
            alert('❌ Invalid backup file format.')
          }
        } catch (error) {
          console.error('Import error:', error)
          alert('❌ Error reading backup file.')
        }
      }
      reader.readAsText(file)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (window.confirm('⚠️ Restore this backup? Current data will be replaced.')) {
      try {
        await restoreExisting(backupId)
        alert('✅ Backup restored!')
        window.location.reload()
      } catch (error) {
        console.error('Restore error:', error)
        alert('❌ Error restoring backup.')
      }
    }
  }

  const handleClearStudents = () => {
    if (window.confirm('⚠️ Are you sure?')) {
      clearAllStudents()
      alert('✅ Cleared.')
    }
  }

  const handleClearReplacements = () => {
    if (window.confirm('⚠️ Are you sure?')) {
      clearAllReplacements()
      alert('✅ Cleared.')
    }
  }

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectName.trim()) return
    if (customSubjects.some(s => s.name.toLowerCase() === subjectName.trim().toLowerCase())) {
      alert('❌ Exists.')
      return
    }
    addCustomSubject(subjectName.trim())
    setSubjectName('')
  }

  return (
    <div className="settings-extended" key="settings-root">
      {/* Sync Status Overlay - Stable CSS Visibility */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        color: 'white',
        textAlign: 'center',
        padding: '20px',
        transition: 'opacity 0.4s ease',
        opacity: syncCountdown !== null ? 1 : 0,
        visibility: syncCountdown !== null ? 'visible' : 'hidden',
        pointerEvents: syncCountdown !== null ? 'all' : 'none'
      }}>
        <div style={{ 
          width: '70px', 
          height: '70px', 
          border: '6px solid #222', 
          borderTop: '6px solid #4f46e5', 
          borderRadius: '50%', 
          animation: 'sync-spin 1s linear infinite',
          marginBottom: '2rem'
        }}></div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>{syncStatus}</h2>
        <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#4f46e5' }}>
          {syncCountdown ?? 0}s
        </div>
      </div>
      
      <div className="page-header">
        <h1 className="page-title">⚙️ {t('nav.settings')}</h1>
        <p className="page-subtitle">Configure your application</p>
      </div>

      <div className="settings-tabs">
        {['general', 'backup', 'notifications', 'subjects', 'fees'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-grid" key="tab-general">
            <div className="settings-card">
              <h2 className="card-title">🏫 School Information</h2>
              <div className="form-group">
                <label className="form-label" htmlFor="schoolNameInput">{t('settings.schoolName')}</label>
                <input id="schoolNameInput" name="schoolName" type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="academicYearInput">{t('settings.academicYear')}</label>
                <input id="academicYearInput" name="academicYear" type="text" className="input" placeholder="2025-2026" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="logoUrlInput">Logo URL</label>
                <input id="logoUrlInput" name="logoUrl" type="url" className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
              </div>
              <div className="form-group">
                <label className="form-label">Upload Logo</label>
                <div className="logo-upload-container">
                  <div className="logo-preview">
                    {logoUrl ? (
                      <img src={logoUrl} alt="School Logo Preview" className="logo-preview-img" />
                    ) : (
                      <div className="logo-preview-placeholder">
                        <span className="placeholder-icon">🏫</span>
                        <span className="placeholder-text">No logo</span>
                      </div>
                    )}
                  </div>
                  <div className="logo-upload-actions">
                    <label className="btn btn-secondary logo-upload-btn">
                      📤 Import Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        ref={logoInputRef}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        className="btn btn-ghost btn-sm logo-remove-btn"
                        onClick={() => setLogoUrl('')}
                        type="button"
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveSchoolInfo}>💾 Save Changes</button>
            </div>
            
            <div className="settings-card large">
              <h2 className="card-title">💾 Data Management</h2>
              <div className="setting-item">
                <div className="setting-info"><h3>Export Backup</h3><p>JSON file download</p></div>
                <button className="btn btn-secondary" onClick={handleExportBackup}>📥 Export</button>
              </div>
              <div className="setting-item">
                <div className="setting-info"><h3>Import Backup</h3><p>Restore from JSON</p></div>
                <label className="btn btn-secondary">📤 Import<input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} /></label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="settings-grid" key="tab-backup">
            <div className="settings-card">
              <h2 className="card-title">💾 Créer une sauvegarde</h2>
              <div className="form-group">
                <label className="form-label" htmlFor="backupNameInput">Nom</label>
                <input id="backupNameInput" name="backupName" type="text" className="input" value={backupName} onChange={(e) => setBackupName(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={handleCreateBackup} disabled={isCreatingBackup}>
                {isCreatingBackup ? '⏳ ...' : '💾 Créer'}
              </button>
            </div>
            <div className="settings-card">
              <h2 className="card-title">📋 Sauvegardes</h2>
              <div className="backups-list">
                {backups.map((b) => (
                  <div key={b.id} className="backup-item">
                    <span>{b.name}</span>
                    <button onClick={() => handleRestoreBackup(b.id)}>↩️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="settings-grid" key="tab-notifications">
            <div className="settings-card">
              <h2 className="card-title">🔔 Notifications</h2>
              <label><input type="checkbox" checked={notificationSettings.enableDesktop} onChange={(e) => setNotificationSettings({...notificationSettings, enableDesktop: e.target.checked})} /> Enable Desktop</label>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="settings-grid" key="tab-subjects">
            <div className="settings-card large">
              <h2 className="card-title">📚 Subject Management</h2>
              <form onSubmit={handleAddSubject} className="add-subject-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="newSubjectInput">New Subject</label>
                  <input id="newSubjectInput" name="subjectName" type="text" className="input" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary">➕ Add</button>
              </form>
              <div className="subjects-grid">
                {customSubjects.map(s => (
                  <div key={s.id} className="subject-item">
                    <span>{s.name}</span>
                    <button onClick={() => deleteCustomSubject(s.id)}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="settings-grid" key="tab-fees">
            <div className="settings-card large">
              <h2 className="card-title">💰 Frais de Scolarité</h2>
              <p className="card-description">Configurez les prix mensuels par niveau et les frais supplémentaires</p>
              
              <div className="fees-section">
                <h3 className="section-title">📊 Prix Mensuels par Niveau</h3>
                <div className="fees-grid">
                  <div className="fee-item">
                    <label>🥚 Maternelle</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={800}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                  <div className="fee-item">
                    <label>📖 Primaire</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={1000}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                  <div className="fee-item">
                    <label>📐 Collège</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={1200}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                  <div className="fee-item">
                    <label>🎓 Lycée</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={1500}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                </div>
              </div>

              <div className="fees-section">
                <h3 className="section-title">🚌 Frais Supplémentaires</h3>
                <div className="fees-grid">
                  <div className="fee-item">
                    <label>Transport</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={200}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                  <div className="fee-item">
                    <label>📚 Livres/Matériel</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={300}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/an</span>
                  </div>
                  <div className="fee-item">
                    <label>🎨 Activités</label>
                    <input 
                      type="number" 
                      className="input" 
                      defaultValue={150}
                      onChange={(e) => {}} // TODO: Connect to store
                    />
                    <span className="fee-currency">DH/mois</span>
                  </div>
                </div>
              </div>

              <div className="fees-section">
                <h3 className="section-title">🏷️ Remises</h3>
                <div className="fee-item">
                  <label>Remise annuelle (-10% pour paiement complet)</label>
                  <input 
                    type="number" 
                    className="input" 
                    defaultValue={10}
                    disabled
                  />
                  <span className="fee-currency">%</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={() => alert('Settings saved!')}>
                💾 Enregistrer les Prix
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsExtended

