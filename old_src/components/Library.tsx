// src/components/Library.tsx - Library management component

import React, { useState, useEffect } from 'react'
import { useLibraryStore, useBooks, useLoans, useLibraryStats, addBook, borrowBook, returnBook } from '../store/libraryStore'
import { useStudents } from '../store/studentsStore'
import { useAuth } from '../store/AuthContext'
import { showToast } from '../hooks/useToast'
import './Library.css'

type BookCategory = 'fiction' | 'science' | 'history' | 'math' | 'literature' | 'other'

const Library: React.FC = () => {
  const { user } = useAuth()
  const students = useStudents()
  
  const books = useBooks()
  const loans = useLoans()
  const stats = useLibraryStats()
  
  const { addBook: add, borrowBook: borrow, returnBook: ret } = useLibraryStore()

  const [activeTab, setActiveTab] = useState<'books' | 'loans' | 'add'>('books')
  const [showBorrowModal, setShowBorrowModal] = useState(false)
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'fiction' as BookCategory,
    totalCopies: 1,
    location: '',
    description: '',
    publishedYear: '',
    publisher: '',
    language: 'Français'
  })

  const [borrowFormData, setBorrowFormData] = useState({
    studentId: '',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })

  const filteredBooks = books.filter(book => {
    const matchesSearch = searchQuery === '' || 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === '' || book.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!bookFormData.title || !bookFormData.author || !bookFormData.isbn) {
      showToast('Veuillez remplir les champs obligatoires', 'warning')
      return
    }

    try {
      await add({
        ...bookFormData,
        totalCopies: parseInt(bookFormData.totalCopies.toString()),
        publishedYear: bookFormData.publishedYear ? parseInt(bookFormData.publishedYear) : undefined
      })

      showToast('✅ Livre ajouté avec succès!', 'success')
      setBookFormData({
        title: '',
        author: '',
        isbn: '',
        category: 'fiction',
        totalCopies: 1,
        location: '',
        description: '',
        publishedYear: '',
        publisher: '',
        language: 'Français'
      })
      setActiveTab('books')
    } catch (error) {
      showToast('Erreur lors de l\'ajout', 'error')
      console.error(error)
    }
  }

  const handleBorrowBook = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBook || !borrowFormData.studentId) {
      showToast('Veuillez sélectionner un livre et un élève', 'warning')
      return
    }

    const student = students.find(s => s.id === borrowFormData.studentId)
    if (!student) return

    try {
      await borrow(
        selectedBook,
        student.id,
        student.name,
        student.classId,
        borrowFormData.dueDate,
        user?.id || '',
        user?.display_name || user?.email || 'Bibliothécaire'
      )

      showToast('✅ Livre emprunté avec succès!', 'success')
      setShowBorrowModal(false)
      setBorrowFormData({
        studentId: '',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })
      setSelectedBook(null)
    } catch (error) {
      showToast('Erreur lors de l\'emprunt', 'error')
      console.error(error)
    }
  }

  const handleReturnBook = async (loanId: string) => {
    if (confirm('Confirmer le retour du livre?')) {
      try {
        await ret(loanId)
        showToast('✅ Livre retourné avec succès!', 'success')
      } catch (error) {
        showToast('Erreur lors du retour', 'error')
        console.error(error)
      }
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      fiction: '📚 Fiction',
      science: '🔬 Sciences',
      history: '📜 Histoire',
      math: '📐 Mathématiques',
      literature: '📖 Littérature',
      other: '📌 Autre'
    }
    return labels[category] || category
  }

  const activeLoans = loans.filter(l => l.status === 'borrowed')
  const overdueLoans = loans.filter(l => l.status === 'borrowed' && new Date(l.dueDate) < new Date())

  return (
    <div className="library-container">
      <div className="library-header">
        <div className="header-content">
          <h1>📚 Bibliothèque</h1>
          <p>Gérez les livres et les emprunts</p>
        </div>
        <button 
          className="btn-add"
          onClick={() => setActiveTab('add')}
        >
          ➕ Nouveau livre
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="library-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalBooks}</div>
            <div className="stat-label">Livres</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalCopies}</div>
            <div className="stat-label">Exemplaires</div>
          </div>
          <div className="stat-card available">
            <div className="stat-value">{stats.availableCopies}</div>
            <div className="stat-label">Disponibles</div>
          </div>
          <div className="stat-card borrowed">
            <div className="stat-value">{activeLoans.length}</div>
            <div className="stat-label">Empruntés</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-value">{overdueLoans.length}</div>
            <div className="stat-label">En retard</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="library-tabs">
        <button
          className={`tab ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          📚 Livres ({filteredBooks.length})
        </button>
        <button
          className={`tab ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          📋 Emprunts ({activeLoans.length})
        </button>
        <button
          className={`tab ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          ➕ Ajouter
        </button>
      </div>

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="books-section">
          <div className="books-filters">
            <input
              type="text"
              placeholder="🔍 Rechercher un livre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              <option value="">Toutes les catégories</option>
              <option value="fiction">📚 Fiction</option>
              <option value="science">🔬 Sciences</option>
              <option value="history">📜 Histoire</option>
              <option value="math">📐 Mathématiques</option>
              <option value="literature">📖 Littérature</option>
              <option value="other">📌 Autre</option>
            </select>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <h3>Aucun livre trouvé</h3>
              <p>Ajoutez des livres à la bibliothèque</p>
            </div>
          ) : (
            <div className="books-grid">
              {filteredBooks.map(book => (
                <div key={book.id} className="book-card">
                  <div className="book-cover">
                    <span className="book-icon">📖</span>
                  </div>
                  <div className="book-info">
                    <h3 className="book-title">{book.title}</h3>
                    <p className="book-author">par {book.author}</p>
                    <div className="book-meta">
                      <span className="book-category">{getCategoryLabel(book.category)}</span>
                      <span className="book-location">📍 {book.location}</span>
                    </div>
                    <div className="book-copies">
                      <span className="available-copies">
                        ✅ {book.availableCopies}/{book.totalCopies} disponibles
                      </span>
                    </div>
                  </div>
                  <div className="book-actions">
                    <button
                      className="btn-borrow"
                      onClick={() => {
                        setSelectedBook(book.id)
                        setShowBorrowModal(true)
                      }}
                      disabled={book.availableCopies <= 0}
                    >
                      📖 Emprunter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <div className="loans-section">
          <h2>📋 Emprunts en cours ({activeLoans.length})</h2>
          {activeLoans.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✅</span>
              <h3>Aucun emprunt en cours</h3>
            </div>
          ) : (
            <table className="loans-table">
              <thead>
                <tr>
                  <th>Livre</th>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Date d'emprunt</th>
                  <th>Date de retour</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map(loan => {
                  const isOverdue = new Date(loan.dueDate) < new Date()
                  return (
                    <tr key={loan.id} className={isOverdue ? 'overdue' : ''}>
                      <td className="book-title">{loan.bookTitle}</td>
                      <td>{loan.studentName}</td>
                      <td>{loan.classId}</td>
                      <td>{new Date(loan.loanDate).toLocaleDateString('fr-FR')}</td>
                      <td className={isOverdue ? 'overdue-date' : ''}>
                        {new Date(loan.dueDate).toLocaleDateString('fr-FR')}
                        {isOverdue && <span className="overdue-badge">⚠️ En retard</span>}
                      </td>
                      <td>
                        <span className="status-badge borrowed">📖 Emprunté</span>
                      </td>
                      <td>
                        <button
                          className="btn-return"
                          onClick={() => handleReturnBook(loan.id)}
                        >
                          ✅ Retour
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Book Tab */}
      {activeTab === 'add' && (
        <div className="add-book-form">
          <div className="form-card">
            <h2>➕ Ajouter un nouveau livre</h2>
            <form onSubmit={handleAddBook}>
              <div className="form-row">
                <div className="form-group">
                  <label>Titre *</label>
                  <input
                    type="text"
                    value={bookFormData.title}
                    onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
                    placeholder="Ex: Les Misérables"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Auteur *</label>
                  <input
                    type="text"
                    value={bookFormData.author}
                    onChange={(e) => setBookFormData({ ...bookFormData, author: e.target.value })}
                    placeholder="Ex: Victor Hugo"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ISBN *</label>
                  <input
                    type="text"
                    value={bookFormData.isbn}
                    onChange={(e) => setBookFormData({ ...bookFormData, isbn: e.target.value })}
                    placeholder="Ex: 978-2-07-040900-0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Catégorie *</label>
                  <select
                    value={bookFormData.category}
                    onChange={(e) => setBookFormData({ ...bookFormData, category: e.target.value as BookCategory })}
                    required
                  >
                    <option value="fiction">📚 Fiction</option>
                    <option value="science">🔬 Sciences</option>
                    <option value="history">📜 Histoire</option>
                    <option value="math">📐 Mathématiques</option>
                    <option value="literature">📖 Littérature</option>
                    <option value="other">📌 Autre</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nombre d'exemplaires *</label>
                  <input
                    type="number"
                    value={bookFormData.totalCopies}
                    onChange={(e) => setBookFormData({ ...bookFormData, totalCopies: parseInt(e.target.value) || 1 })}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Emplacement *</label>
                  <input
                    type="text"
                    value={bookFormData.location}
                    onChange={(e) => setBookFormData({ ...bookFormData, location: e.target.value })}
                    placeholder="Ex: Étagère A-12"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={bookFormData.description}
                  onChange={(e) => setBookFormData({ ...bookFormData, description: e.target.value })}
                  placeholder="Description du livre..."
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Année de publication</label>
                  <input
                    type="number"
                    value={bookFormData.publishedYear}
                    onChange={(e) => setBookFormData({ ...bookFormData, publishedYear: e.target.value })}
                    placeholder="Ex: 2020"
                  />
                </div>
                <div className="form-group">
                  <label>Éditeur</label>
                  <input
                    type="text"
                    value={bookFormData.publisher}
                    onChange={(e) => setBookFormData({ ...bookFormData, publisher: e.target.value })}
                    placeholder="Ex: Gallimard"
                  />
                </div>
                <div className="form-group">
                  <label>Langue</label>
                  <input
                    type="text"
                    value={bookFormData.language}
                    onChange={(e) => setBookFormData({ ...bookFormData, language: e.target.value })}
                    placeholder="Ex: Français"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">
                  ✅ Ajouter le livre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {showBorrowModal && (
        <div className="modal-overlay" onClick={() => setShowBorrowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📖 Emprunter un livre</h2>
              <button className="close-btn" onClick={() => setShowBorrowModal(false)}>×</button>
            </div>

            <form onSubmit={handleBorrowBook}>
              <div className="form-group">
                <label>Élève *</label>
                <select
                  value={borrowFormData.studentId}
                  onChange={(e) => setBorrowFormData({ ...borrowFormData, studentId: e.target.value })}
                  required
                >
                  <option value="">-- Sélectionner un élève --</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.classId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Date de retour *</label>
                <input
                  type="date"
                  value={borrowFormData.dueDate}
                  onChange={(e) => setBorrowFormData({ ...borrowFormData, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowBorrowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit">
                  📖 Emprunter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Library

