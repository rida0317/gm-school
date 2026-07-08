// src/store/libraryStore.ts - Zustand store for library management

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import libraryService, { type Book, type BookLoan, type LibraryStats } from '../services/library.service'

interface LibraryState {
  // Data
  books: Book[]
  loans: BookLoan[]
  stats: LibraryStats | null
  
  // UI State
  selectedBookId: string | null
  selectedLoanId: string | null
  searchQuery: string
  selectedCategory: string
  isLoading: boolean
  error: string | null
}

interface LibraryActions {
  // Books CRUD
  addBook: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'availableCopies'>) => Promise<Book>
  updateBook: (bookId: string, updates: Partial<Book>) => Promise<Book | null>
  deleteBook: (bookId: string) => Promise<boolean>
  
  // Loans
  borrowBook: (
    bookId: string,
    studentId: string,
    studentName: string,
    classId: string,
    dueDate: string,
    borrowedBy: string,
    borrowedByName: string,
    notes?: string
  ) => Promise<BookLoan | null>
  returnBook: (loanId: string) => Promise<BookLoan | null>
  markBookAsLost: (loanId: string) => Promise<BookLoan | null>
  
  // Get
  getBooksByCategory: (category: string) => Book[]
  searchBooks: (query: string) => Book[]
  getLoansByStudent: (studentId: string) => BookLoan[]
  getOverdueLoans: () => BookLoan[]
  
  // Filters
  setSelectedBookId: (bookId: string | null) => void
  setSelectedLoanId: (loanId: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  
  // State
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  refreshStats: () => void
  subscribeToBooks: () => void
  subscribeToLoans: () => void
}

export type LibraryStore = LibraryState & LibraryActions

const initialState: LibraryState = {
  books: [],
  loans: [],
  stats: null,
  selectedBookId: null,
  selectedLoanId: null,
  searchQuery: '',
  selectedCategory: '',
  isLoading: false,
  error: null
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== BOOKS CRUD ==========

      addBook: async (book) => {
        set({ isLoading: true, error: null })
        try {
          const newBook = await libraryService.addBook(book)
          set((state) => ({
            books: [newBook, ...state.books],
            isLoading: false
          }))
          get().refreshStats()
          return newBook
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to add book',
            isLoading: false
          })
          throw error
        }
      },

      updateBook: async (bookId, updates) => {
        set({ isLoading: true, error: null })
        try {
          const updatedBook = await libraryService.updateBook(bookId, updates)
          if (updatedBook) {
            set((state) => ({
              books: state.books.map(b => b.id === bookId ? updatedBook : b),
              isLoading: false
            }))
            get().refreshStats()
          }
          return updatedBook
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update book',
            isLoading: false
          })
          throw error
        }
      },

      deleteBook: async (bookId) => {
        set({ isLoading: true, error: null })
        try {
          const success = await libraryService.deleteBook(bookId)
          if (success) {
            set((state) => ({
              books: state.books.filter(b => b.id !== bookId),
              selectedBookId: state.selectedBookId === bookId ? null : state.selectedBookId,
              isLoading: false
            }))
            get().refreshStats()
          }
          return success
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete book',
            isLoading: false
          })
          throw error
        }
      },

      // ========== LOANS ==========

      borrowBook: async (bookId, studentId, studentName, classId, dueDate, borrowedBy, borrowedByName, notes) => {
        set({ isLoading: true, error: null })
        try {
          const loan = await libraryService.borrowBook(
            bookId,
            studentId,
            studentName,
            classId,
            dueDate,
            borrowedBy,
            borrowedByName,
            notes
          )
          if (loan) {
            set((state) => ({
              loans: [loan, ...state.loans],
              isLoading: false
            }))
            get().refreshStats()
          }
          return loan
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to borrow book',
            isLoading: false
          })
          throw error
        }
      },

      returnBook: async (loanId) => {
        set({ isLoading: true, error: null })
        try {
          const loan = await libraryService.returnBook(loanId)
          if (loan) {
            set((state) => ({
              loans: state.loans.map(l => l.id === loanId ? loan : l),
              isLoading: false
            }))
            get().refreshStats()
          }
          return loan
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to return book',
            isLoading: false
          })
          throw error
        }
      },

      markBookAsLost: async (loanId) => {
        set({ isLoading: true, error: null })
        try {
          const loan = await libraryService.markBookAsLost(loanId)
          if (loan) {
            set((state) => ({
              loans: state.loans.map(l => l.id === loanId ? loan : l),
              isLoading: false
            }))
            get().refreshStats()
          }
          return loan
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to mark book as lost',
            isLoading: false
          })
          throw error
        }
      },

      // ========== GET ==========

      getBooksByCategory: (category) => {
        return libraryService.getBooksByCategory(category)
      },

      searchBooks: (query) => {
        return libraryService.searchBooks(query)
      },

      getLoansByStudent: (studentId) => {
        return libraryService.getLoansByStudent(studentId)
      },

      getOverdueLoans: () => {
        return libraryService.getOverdueLoans()
      },

      // ========== FILTERS ==========

      setSelectedBookId: (bookId) => {
        set({ selectedBookId: bookId })
      },

      setSelectedLoanId: (loanId) => {
        set({ selectedLoanId: loanId })
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      setSelectedCategory: (category) => {
        set({ selectedCategory: category })
      },

      // ========== STATE ==========

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      refreshStats: () => {
        const stats = libraryService.getStats()
        set({ stats })
      },

      subscribeToBooks: () => {
        const unsubscribe = libraryService.subscribeToBooks()
        get().refreshStats()
        return unsubscribe
      },

      subscribeToLoans: () => {
        const unsubscribe = libraryService.subscribeToLoans()
        return unsubscribe
      }
    }),
    {
      name: 'library-store',
      partialize: (state) => ({
        books: state.books.slice(0, 50),
        loans: state.loans.slice(0, 100)
      })
    }
  )
)

// ========== SELECTOR HOOKS ==========

export const useBooks = () => useLibraryStore((state) => state.books)
export const useLoans = () => useLibraryStore((state) => state.loans)
export const useLibraryStats = () => useLibraryStore((state) => state.stats)
export const useSelectedBook = () => useLibraryStore((state) => state.selectedBookId)
export const useSelectedLoan = () => useLibraryStore((state) => state.selectedLoanId)
export const useLibrarySearch = () => useLibraryStore((state) => state.searchQuery)
export const useLibraryCategory = () => useLibraryStore((state) => state.selectedCategory)
export const useLibraryLoading = () => useLibraryStore((state) => state.isLoading)
export const useLibraryError = () => useLibraryStore((state) => state.error)

// ========== UTILITY FUNCTIONS ==========

export const addBook = async (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'availableCopies'>): Promise<Book> => {
  const { addBook: add } = useLibraryStore.getState()
  return add(book)
}

export const borrowBook = async (
  bookId: string,
  studentId: string,
  studentName: string,
  classId: string,
  dueDate: string,
  borrowedBy: string,
  borrowedByName: string,
  notes?: string
): Promise<BookLoan | null> => {
  const { borrowBook: borrow } = useLibraryStore.getState()
  return borrow(bookId, studentId, studentName, classId, dueDate, borrowedBy, borrowedByName, notes)
}

export const returnBook = async (loanId: string): Promise<BookLoan | null> => {
  const { returnBook: ret } = useLibraryStore.getState()
  return ret(loanId)
}


