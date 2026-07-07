// src/services/library.service.ts - Library Management Service with Supabase Sync

import { supabase } from '../lib/supabaseClient'
import { Book, BookLoan } from '../types'

export interface Book {
  id: string
  title: string
  author: string
  isbn: string
  category: string
  totalCopies: number
  availableCopies: number
  location: string
  description?: string
  coverImage?: string
  publishedYear?: number
  publisher?: string
  language?: string
  pages?: number
  createdAt: string
  updatedAt: string
}

export interface BookLoan {
  id: string
  bookId: string
  bookTitle: string
  studentId: string
  studentName: string
  classId?: string
  loanDate: string
  dueDate: string
  returnDate?: string
  status: 'borrowed' | 'returned' | 'overdue' | 'lost'
  notes?: string
  borrowedBy: string
  borrowedByName: string
  createdAt: string
  updatedAt: string
}

export interface LibraryStats {
  totalBooks: number
  totalCopies: number
  availableCopies: number
  borrowedBooks: number
  overdueBooks: number
  lostBooks: number
  byCategory: Record<string, number>
  topBorrowedBooks: { bookId: string; title: string; borrowCount: number }[]
}

class LibraryService {
  private books: Book[] = []
  private loans: BookLoan[] = []

  constructor() {
    this.loadFromLocalStorage()
    this.syncFromSupabase()
  }

  /**
   * Add new book to library
   */
  async addBook(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'availableCopies'>): Promise<Book> {
    const newBook: Book = {
      ...book,
      id: this.generateId(),
      availableCopies: book.totalCopies,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to Supabase
    try {
      const { data, error } = await supabase
        .from('library_books')
        .insert({
          id: newBook.id,
          title: newBook.title,
          author: newBook.author,
          isbn: newBook.isbn,
          category: newBook.category,
          totalCopies: newBook.totalCopies,
          availableCopies: newBook.availableCopies,
          location: newBook.location,
          description: newBook.description,
          coverImage: newBook.coverImage,
          publishedYear: newBook.publishedYear,
          publisher: newBook.publisher,
          language: newBook.language,
          pages: newBook.pages,
          created_at: newBook.createdAt,
          updated_at: newBook.updatedAt
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving book to Supabase:', error)
      }
    } catch (error) {
      console.error('Error saving book to Supabase:', error)
    }

    this.books.unshift(newBook)
    this.saveToLocalStorage()

    return newBook
  }

  /**
   * Update book
   */
  async updateBook(bookId: string, updates: Partial<Book>): Promise<Book | null> {
    const index = this.books.findIndex(b => b.id === bookId)
    if (index === -1) return null

    const updatedBook = {
      ...this.books[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    // Update in Supabase
    try {
      const { error } = await supabase
        .from('library_books')
        .update({
          ...(updates.title && { title: updates.title }),
          ...(updates.author && { author: updates.author }),
          ...(updates.isbn && { isbn: updates.isbn }),
          ...(updates.category && { category: updates.category }),
          ...(updates.totalCopies !== undefined && { total_copies: updates.totalCopies }),
          ...(updates.availableCopies !== undefined && { available_copies: updates.availableCopies }),
          ...(updates.location && { location: updates.location }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.coverImage !== undefined && { cover_image: updates.coverImage }),
          ...(updates.publishedYear !== undefined && { published_year: updates.publishedYear }),
          ...(updates.publisher !== undefined && { publisher: updates.publisher }),
          ...(updates.language !== undefined && { language: updates.language }),
          ...(updates.pages !== undefined && { pages: updates.pages }),
          updated_at: updatedBook.updatedAt
        })
        .eq('id', bookId)

      if (error) {
        console.error('Error updating book in Supabase:', error)
      }
    } catch (error) {
      console.error('Error updating book in Supabase:', error)
    }

    this.books[index] = updatedBook
    this.saveToLocalStorage()

    return updatedBook
  }

  /**
   * Delete book
   */
  async deleteBook(bookId: string): Promise<boolean> {
    const index = this.books.findIndex(b => b.id === bookId)
    if (index === -1) return false

    // Check if book has active loans
    const hasActiveLoans = this.loans.some(l => l.bookId === bookId && l.status === 'borrowed')
    if (hasActiveLoans) {
      throw new Error('Cannot delete book with active loans')
    }

    // Delete from Supabase
    try {
      const { error } = await supabase
        .from('library_books')
        .delete()
        .eq('id', bookId)

      if (error) {
        console.error('Error deleting book from Supabase:', error)
      }
    } catch (error) {
      console.error('Error deleting book from Supabase:', error)
    }

    this.books = this.books.filter(b => b.id !== bookId)
    this.saveToLocalStorage()

    return true
  }

  /**
   * Borrow a book
   */
  async borrowBook(loan: Omit<BookLoan, 'id' | 'createdAt' | 'updatedAt' | 'returnDate' | 'status'>): Promise<BookLoan> {
    const book = this.books.find(b => b.id === loan.bookId)
    if (!book || book.availableCopies <= 0) {
      throw new Error('Book not available for borrowing')
    }

    const newLoan: BookLoan = {
      ...loan,
      id: this.generateId(),
      status: 'borrowed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to Supabase
    try {
      const { error: loanError } = await supabase
        .from('library_loans')
        .insert({
          id: newLoan.id,
          book_id: newLoan.bookId,
          book_title: newLoan.bookTitle,
          student_id: newLoan.studentId,
          student_name: newLoan.studentName,
          class_id: newLoan.classId,
          loan_date: newLoan.loanDate,
          due_date: newLoan.dueDate,
          status: newLoan.status,
          notes: newLoan.notes,
          borrowed_by: newLoan.borrowedBy,
          borrowed_by_name: newLoan.borrowedByName,
          created_at: newLoan.createdAt,
          updated_at: newLoan.updatedAt
        })

      if (loanError) {
        console.error('Error saving loan to Supabase:', loanError)
      }

      // Update book copies
      const { error: bookError } = await supabase
        .from('library_books')
        .update({
          available_copies: book.availableCopies - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', book.id)

      if (bookError) {
        console.error('Error updating book copies in Supabase:', bookError)
      }
    } catch (error) {
      console.error('Error processing loan in Supabase:', error)
    }

    // Update local state
    book.availableCopies -= 1
    this.loans.unshift(newLoan)
    this.saveToLocalStorage()

    return newLoan
  }

  /**
   * Return a book
   */
  async returnBook(loanId: string, notes?: string): Promise<BookLoan | null> {
    const index = this.loans.findIndex(l => l.id === loanId)
    if (index === -1) return null

    const loan = this.loans[index]
    const book = this.books.find(b => b.id === loan.bookId)

    const updatedLoan: BookLoan = {
      ...loan,
      status: 'returned',
      returnDate: new Date().toISOString(),
      notes: notes || loan.notes,
      updatedAt: new Date().toISOString()
    }

    // Update in Supabase
    try {
      const { error: loanError } = await supabase
        .from('library_loans')
        .update({
          status: updatedLoan.status,
          return_date: updatedLoan.returnDate,
          notes: updatedLoan.notes,
          updated_at: updatedLoan.updatedAt
        })
        .eq('id', loanId)

      if (loanError) {
        console.error('Error updating loan in Supabase:', loanError)
      }

      if (book) {
        const { error: bookError } = await supabase
          .from('library_books')
          .update({
            available_copies: book.availableCopies + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id)

        if (bookError) {
          console.error('Error updating book copies in Supabase:', bookError)
        }
      }
    } catch (error) {
      console.error('Error processing return in Supabase:', error)
    }

    // Update local state
    if (book) book.availableCopies += 1
    this.loans[index] = updatedLoan
    this.saveToLocalStorage()

    return updatedLoan
  }

  /**
   * Get all books
   */
  getBooks(): Book[] {
    return this.books
  }

  /**
   * Get all loans
   */
  getLoans(): BookLoan[] {
    return this.loans
  }

  /**
   * Get library statistics
   */
  getStats(): LibraryStats {
    const totalBooks = this.books.length
    const totalCopies = this.books.reduce((acc, b) => acc + b.totalCopies, 0)
    const availableCopies = this.books.reduce((acc, b) => acc + b.availableCopies, 0)
    const borrowedBooks = this.loans.filter(l => l.status === 'borrowed').length
    const overdueBooks = this.loans.filter(l => {
      return l.status === 'borrowed' && new Date(l.dueDate) < new Date()
    }).length
    const lostBooks = this.loans.filter(l => l.status === 'lost').length

    const byCategory: Record<string, number> = {}
    this.books.forEach(b => {
      byCategory[b.category] = (byCategory[b.category] || 0) + 1
    })

    const bookLoanCounts: Record<string, { title: string; count: number }> = {}
    this.loans.forEach(l => {
      if (!bookLoanCounts[l.bookId]) {
        bookLoanCounts[l.bookId] = { title: l.bookTitle, count: 0 }
      }
      bookLoanCounts[l.bookId].count++
    })

    const topBorrowedBooks = Object.entries(bookLoanCounts)
      .map(([bookId, data]) => ({
        bookId,
        title: data.title,
        borrowCount: data.count
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 5)

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      borrowedBooks,
      overdueBooks,
      lostBooks,
      byCategory,
      topBorrowedBooks
    }
  }

  /**
   * Subscribe to library updates
   */
  subscribeToBooks(): () => void {
    const channel = supabase
      .channel('library_books_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'library_books'
        },
        async (payload) => {

          await this.syncFromSupabase()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * Subscribe to loans
   */
  subscribeToLoans(): () => void {
    const channel = supabase
      .channel('library_loans_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'library_loans'
        },
        async (payload) => {

          await this.syncLoansFromSupabase()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * Sync all books from Supabase
   */
  private async syncFromSupabase(): Promise<void> {
    try {
      const { data: books, error } = await supabase
        .from('library_books')
        .select('*')
        .order('title', { ascending: true })

      if (error) {
        if (error.code === '42P01') {
          console.warn('⚠️ library_books table does not exist. Please create it in Supabase.')
          // Ensure we have local data as fallback
          if (this.books.length === 0) {
            this.loadFromLocalStorage()
          }
        } else {
          console.error('Error fetching books from Supabase:', error)
        }
        return
      }

      if (books && Array.isArray(books)) {
        this.books = books.map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          category: book.category,
          totalCopies: book.total_copies || book.totalCopies || 1,
          availableCopies: book.available_copies || book.availableCopies || 1,
          location: book.location,
          description: book.description,
          coverImage: book.cover_image || book.coverImage,
          publishedYear: book.published_year || book.publishedYear,
          publisher: book.publisher,
          language: book.language,
          pages: book.pages,
          createdAt: book.created_at || book.createdAt || new Date().toISOString(),
          updatedAt: book.updated_at || book.updatedAt || new Date().toISOString()
        }))
        this.saveToLocalStorage()
      }
    } catch (err: any) {
      console.warn('⚠️ library_books table does not exist or network error. Using local storage.', err.message)
      this.loadFromLocalStorage()
    }
  }

  /**
   * Sync all loans from Supabase
   */
  private async syncLoansFromSupabase(): Promise<void> {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select('*')
        .order('loan_date', { ascending: false })

      if (error) {
        if (error.code === '42P01') {
          console.warn('⚠️ library_loans table does not exist. Please create it in Supabase.')
        } else {
          console.error('Error fetching loans from Supabase:', error)
        }
        return
      }

      if (loans && Array.isArray(loans)) {
        this.loans = loans.map(loan => ({
          id: loan.id,
          bookId: loan.book_id,
          bookTitle: loan.book_title,
          studentId: loan.student_id,
          studentName: loan.student_name,
          classId: loan.class_id,
          loanDate: loan.loan_date,
          dueDate: loan.due_date,
          returnDate: loan.return_date,
          status: loan.status as any,
          notes: loan.notes,
          borrowedBy: loan.borrowed_by,
          borrowedByName: loan.borrowed_by_name,
          createdAt: loan.created_at,
          updatedAt: loan.updated_at
        }))
        this.saveToLocalStorage()
      }
    } catch (err) {
      console.error('Unexpected error in syncLoansFromSupabase:', err)
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): void {
    const savedBooks = localStorage.getItem('library_books')
    const savedLoans = localStorage.getItem('library_loans')
    
    if (savedBooks) {
      try {
        this.books = JSON.parse(savedBooks)
      } catch (e) {
        console.error('Error parsing local books:', e)
        this.books = []
      }
    }
    if (savedLoans) {
      try {
        this.loans = JSON.parse(savedLoans)
      } catch (e) {
        console.error('Error parsing local loans:', e)
        this.loans = []
      }
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(): void {
    localStorage.setItem('library_books', JSON.stringify(this.books.slice(0, 100)))
    localStorage.setItem('library_loans', JSON.stringify(this.loans.slice(0, 200)))
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const libraryService = new LibraryService()

// Export factory function
export const createLibraryService = (): LibraryService => new LibraryService()

export default libraryService

