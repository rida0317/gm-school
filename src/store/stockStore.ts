// src/store/stockStore.ts - Zustand store pour la gestion de stock

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  StockItem,
  StockTransaction,
  StockMovement,
  Supplier,
  StockAlert,
  StockReturn,
  StockLoan,
  StockCategory,
  StockUnit,
  TransactionType,
  StockSettings,
} from '../types/stock'
import { smartSave, smartLoad } from '../utils/storage'

const STORE_KEY = 'school_stock_v1'

// Données par défaut pour une école marocaine
const getDefaultCategories = (): StockCategory[] => [
  'Hygiène',
  'Produit de ménage',
  'Fournitures scolaires',
  'Sport',
  'Pédagogique',
  'Informatique',
  'Autre',
]

const getDefaultUnits = (): StockUnit[] => [
  'unité',
  'boîte',
  'ramette',
  'paquet',
  'litre',
  'kg',
  'mètre',
  'feuille',
  'cahier',
  'stylo',
  'autre',
]

const getDefaultSettings = (): StockSettings => ({
  enableAlerts: true,
  alertThreshold: 25,
  criticalThreshold: 10,
  enableExpirationTracking: true,
  enableBarcodeScanning: false,
  defaultCurrency: 'MAD',
  requireApprovalForExit: false,
  approverIds: [],
})

// Items de stock initiaux (exemple pour école marocaine)
const getInitialStockItems = (): StockItem[] => [
  {
    id: 'stock-1',
    name: 'Papier A4 (80g)',
    description: 'Ramette de papier blanc 500 feuilles',
    category: 'Fournitures scolaires',
    type: 'Consommable',
    quantity: 50,
    minQuantity: 10,
    unit: 'ramette',
    price: 45,
    location: 'Magasin Principal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'stock-2',
    name: 'Stylos bleus',
    description: 'Boîte de 50 stylos bille bleus',
    category: 'Fournitures scolaires',
    type: 'Consommable',
    quantity: 20,
    minQuantity: 5,
    unit: 'boîte',
    price: 30,
    location: 'Magasin Principal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'stock-5',
    name: 'Savon liquide',
    description: 'Bidon 5L pour sanitaires',
    category: 'Hygiène',
    type: 'Consommable',
    quantity: 8,
    minQuantity: 3,
    unit: 'litre',
    price: 80,
    location: 'Local Ménage',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'stock-6',
    name: 'Eau de Javel',
    description: 'Bidon 5L pour désinfection',
    category: 'Produit de ménage',
    type: 'Consommable',
    quantity: 12,
    minQuantity: 4,
    unit: 'litre',
    price: 35,
    location: 'Local Ménage',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'stock-7',
    name: 'Cahiers 96 pages',
    description: 'Cahiers Seyès pour élèves',
    category: 'Fournitures scolaires',
    type: 'Consommable',
    quantity: 100,
    minQuantity: 20,
    unit: 'cahier',
    price: 8,
    location: 'Magasin Principal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'stock-9',
    name: 'Balai à brosse',
    description: 'Balai pour nettoyage des sols',
    category: 'Produit de ménage',
    type: 'Retourable',
    quantity: 6,
    minQuantity: 2,
    unit: 'unité',
    price: 25,
    location: 'Local Ménage',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

interface StockStore {
  // Données
  items: StockItem[]
  transactions: StockTransaction[]
  suppliers: Supplier[]
  returns: StockReturn[]
  loans: StockLoan[]  // Student loans
  settings: StockSettings
  categories: StockCategory[]
  units: StockUnit[]

  // Actions - Items
  addItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateItem: (id: string, item: Partial<StockItem>) => void
  deleteItem: (id: string) => void
  updateQuantity: (id: string, quantity: number, reason: string) => void
  getItem: (id: string) => StockItem | undefined

  // Actions - Transactions
  addTransaction: (transaction: Omit<StockTransaction, 'id' | 'previousQuantity' | 'newQuantity'>) => void
  getTransactions: (itemId?: string, type?: TransactionType, limit?: number) => StockTransaction[]
  getMovements: (limit?: number) => StockMovement[]

  // Actions - Retours
  addReturn: (ret: Omit<StockReturn, 'id'>) => void
  getReturns: (itemId?: string) => StockReturn[]

  // Actions - Student Loans
  addLoan: (loan: Omit<StockLoan, 'id'>) => void
  updateLoan: (id: string, loan: Partial<StockLoan>) => void
  returnLoan: (id: string, condition?: 'excellent' | 'good' | 'damaged', notes?: string) => void
  getLoans: (studentId?: string, status?: StockLoan['returnStatus']) => StockLoan[]
  getLoansByStudent: (studentId: string) => StockLoan[]
  getOverdueLoans: () => StockLoan[]

  // Actions - Suppliers
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  getSupplier: (id: string) => Supplier | undefined

  // Actions - Alerts
  getAlerts: () => StockAlert[]
  getLowStockItems: () => StockItem[]

  // Actions - Settings
  updateSettings: (settings: Partial<StockSettings>) => void

  // Actions - Utils
  exportStockReport: (startDate: string, endDate: string) => any
  forceSave: () => void
}

// Générer un ID unique
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const useStockStore = create<StockStore>()(
  persist(
    (set, get) => ({
      // État initial
      items: [],
      transactions: [],
      suppliers: [],
      returns: [],
      loans: [],  // Student loans
      settings: getDefaultSettings(),
      categories: getDefaultCategories(),
      units: getDefaultUnits(),

      // === ACTIONS ITEMS ===
      addItem: (itemData) => {
        const newItem: StockItem = {
          ...itemData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalValue: itemData.price ? itemData.quantity * itemData.price : 0,
        }

        set((state) => ({
          items: [...state.items, newItem],
        }))

        // Enregistrer la transaction d'entrée initiale
        if (itemData.quantity > 0) {
          get().addTransaction({
            itemId: newItem.id,
            type: 'entrée',
            quantity: itemData.quantity,
            userId: 'system',
            userName: 'Initialisation',
            date: new Date().toISOString(),
            reason: 'Stock initial',
          })
        }
      },

      updateItem: (id, itemData) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...itemData,
                  updatedAt: new Date().toISOString(),
                  totalValue: itemData.price
                    ? (itemData.quantity ?? item.quantity) * itemData.price
                    : item.totalValue,
                }
              : item
          ),
        }))
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }))
      },

      updateQuantity: (id, newQuantity, reason) => {
        const item = get().items.find((i) => i.id === id)
        if (!item) return

        const difference = newQuantity - item.quantity
        const type: TransactionType =
          difference > 0 ? 'entrée' : difference < 0 ? 'sortie' : 'ajustement'

        get().addTransaction({
          itemId: id,
          type,
          quantity: Math.abs(difference),
          userId: 'system',
          userName: 'Ajustement',
          date: new Date().toISOString(),
          reason: reason || 'Ajustement de stock',
        })

        get().updateItem(id, { quantity: newQuantity })
      },

      getItem: (id) => {
        return get().items.find((item) => item.id === id)
      },

      // === ACTIONS TRANSACTIONS ===
      addTransaction: (transactionData) => {
        const item = get().items.find((i) => i.id === transactionData.itemId)
        if (!item) return

        const previousQuantity = item.quantity
        let newQuantity = previousQuantity

        // Calculer la nouvelle quantité selon le type
        switch (transactionData.type) {
          case 'entrée':
          case 'retour':
            newQuantity = previousQuantity + transactionData.quantity
            break
          case 'sortie':
          case 'perte':
            newQuantity = previousQuantity - transactionData.quantity
            break
          case 'ajustement':
            newQuantity = transactionData.quantity
            break
        }

        const newTransaction: StockTransaction = {
          ...transactionData,
          id: generateId(),
          previousQuantity,
          newQuantity,
        }

        set((state) => ({
          transactions: [...state.transactions, newTransaction],
        }))

        // Mettre à jour la quantité de l'article
        get().updateItem(transactionData.itemId, { quantity: newQuantity })
      },

      getTransactions: (itemId, type, limit = 100) => {
        let transactions = get().transactions

        if (itemId) {
          transactions = transactions.filter((t) => t.itemId === itemId)
        }

        if (type) {
          transactions = transactions.filter((t) => t.type === type)
        }

        // Trier par date décroissante
        transactions = transactions.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        return transactions.slice(0, limit)
      },

      getMovements: (limit = 50) => {
        const transactions = get().transactions
        const items = get().items

        const movements: StockMovement[] = transactions.map((t) => {
          const item = items.find((i) => i.id === t.itemId)
          return {
            id: t.id,
            itemId: t.itemId,
            itemName: item?.name || 'Inconnu',
            category: (item?.category as StockCategory) || 'Autre',
            type: t.type,
            quantity: t.quantity,
            unit: (item?.unit as StockUnit) || 'unité',
            userId: t.userId,
            userName: t.userName || 'Inconnu',
            date: t.date,
            reason: t.reason,
            reference: t.reference,
          }
        })

        return movements
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit)
      },

      // === ACTIONS RETOURS ===
      addReturn: (returnData) => {
        const newReturn: StockReturn = {
          ...returnData,
          id: generateId(),
        }

        set((state) => ({
          returns: [...state.returns, newReturn],
        }))

        // Réintégrer le stock
        if (returnData.condition !== 'damaged') {
          get().addTransaction({
            itemId: returnData.itemId,
            type: 'retour',
            quantity: returnData.quantity,
            userId: 'system',
            userName: returnData.returnedByName || 'Retour',
            date: new Date().toISOString(),
            reason: `Retour: ${returnData.returnReason}`,
          })
        }
      },

      getReturns: (itemId) => {
        const returns = get().returns
        if (itemId) {
          return returns.filter((r) => r.itemId === itemId)
        }
        return returns
      },

      // === ACTIONS STUDENT LOANS ===
      addLoan: (loanData) => {
        const newLoan: StockLoan = {
          ...loanData,
          id: generateId(),
        }

        set((state) => ({
          loans: [...state.loans, newLoan],
        }))

        // For consumable items, deduct from stock
        if (loanData.loanType === 'consumable') {
          get().addTransaction({
            itemId: loanData.itemId,
            type: 'sortie',
            quantity: loanData.quantity,
            userId: 'student',
            userName: loanData.studentName,
            date: new Date().toISOString(),
            reason: `Prêt consommable: ${loanData.studentName}`,
            recipientId: loanData.studentId,
            recipientType: 'student',
          })
        }
        // For returnable items, track but don't deduct
      },

      updateLoan: (id, loanData) => {
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, ...loanData } : loan
          ),
        }))
      },

      returnLoan: (id, condition = 'good', notes) => {
        const loan = get().loans.find((l) => l.id === id)
        if (!loan) return

        // Update loan status
        get().updateLoan(id, {
          actualReturnDate: new Date().toISOString(),
          returnStatus: 'returned',
          condition: condition,
          notes: notes || loan.notes,
        })

        // For returnable items, create return transaction
        if (loan.loanType === 'returnable') {
          get().addTransaction({
            itemId: loan.itemId,
            type: 'retour',
            quantity: loan.quantity,
            userId: 'student',
            userName: loan.studentName,
            date: new Date().toISOString(),
            reason: `Retour prêt: ${loan.studentName}`,
            recipientId: loan.studentId,
            recipientType: 'student',
          })
        }
      },

      getLoans: (studentId, status) => {
        let loans = get().loans
        
        if (studentId) {
          loans = loans.filter((l) => l.studentId === studentId)
        }
        
        if (status) {
          loans = loans.filter((l) => l.returnStatus === status)
        }
        
        return loans.sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
      },

      getLoansByStudent: (studentId) => {
        return get().loans
          .filter((l) => l.studentId === studentId)
          .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
      },

      getOverdueLoans: () => {
        const now = new Date()
        return get().loans.filter((loan) => {
          if (loan.returnStatus !== 'pending') return false
          if (!loan.expectedReturnDate) return false
          return new Date(loan.expectedReturnDate) < now
        })
      },

      // === ACTIONS SUPPLIERS ===
      addSupplier: (supplierData) => {
        const newSupplier: Supplier = {
          ...supplierData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          suppliers: [...state.suppliers, newSupplier],
        }))
      },

      updateSupplier: (id, supplierData) => {
        set((state) => ({
          suppliers: state.suppliers.map((s) =>
            s.id === id ? { ...s, ...supplierData } : s
          ),
        }))
      },

      deleteSupplier: (id) => {
        set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id),
        }))
      },

      getSupplier: (id) => {
        return get().suppliers.find((s) => s.id === id)
      },

      // === ACTIONS ALERTS ===
      getAlerts: () => {
        const { items, settings } = get()
        const alerts: StockAlert[] = []

        items.forEach((item) => {
          if (!item.isActive || item.minQuantity === 0) return

          const ratio = (item.quantity / item.minQuantity) * 100

          if (ratio <= settings.criticalThreshold) {
            alerts.push({
              id: generateId(),
              itemId: item.id,
              itemName: item.name,
              category: item.category,
              currentQuantity: item.quantity,
              minQuantity: item.minQuantity,
              alertLevel: 'critical',
              message: `Stock critique: ${item.quantity} ${item.unit} restants`,
              createdAt: new Date().toISOString(),
            })
          } else if (ratio <= settings.alertThreshold) {
            alerts.push({
              id: generateId(),
              itemId: item.id,
              itemName: item.name,
              category: item.category,
              currentQuantity: item.quantity,
              minQuantity: item.minQuantity,
              alertLevel: 'warning',
              message: `Stock bas: ${item.quantity} ${item.unit} restants`,
              createdAt: new Date().toISOString(),
            })
          }
        })

        return alerts
      },

      getLowStockItems: () => {
        const { items, settings } = get()
        return items.filter((item) => {
          if (!item.isActive || item.minQuantity === 0) return false
          const ratio = (item.quantity / item.minQuantity) * 100
          return ratio <= settings.alertThreshold
        })
      },

      // === ACTIONS SETTINGS ===
      updateSettings: (settingsData) => {
        set((state) => ({
          settings: { ...state.settings, ...settingsData },
        }))
      },

      // === ACTIONS UTILS ===
      exportStockReport: (startDate, endDate) => {
        const { items, transactions } = get()
        const start = new Date(startDate)
        const end = new Date(endDate)

        const filteredTransactions = transactions.filter(
          (t) => new Date(t.date) >= start && new Date(t.date) <= end
        )

        const totalValue = items.reduce(
          (sum, item) => sum + (item.totalValue || 0),
          0
        )

        const totalEntries = filteredTransactions
          .filter((t) => t.type === 'entrée' || t.type === 'retour')
          .reduce((sum, t) => sum + t.quantity, 0)

        const totalExits = filteredTransactions
          .filter((t) => t.type === 'sortie' || t.type === 'perte')
          .reduce((sum, t) => sum + t.quantity, 0)

        const totalReturns = filteredTransactions
          .filter((t) => t.type === 'retour')
          .reduce((sum, t) => sum + t.quantity, 0)

        const lowStockItems = get().getLowStockItems()

        const transactionsByType: Record<TransactionType, number> = {
          'entrée': filteredTransactions.filter((t) => t.type === 'entrée').length,
          'sortie': filteredTransactions.filter((t) => t.type === 'sortie').length,
          'retour': filteredTransactions.filter((t) => t.type === 'retour').length,
          'perte': filteredTransactions.filter((t) => t.type === 'perte').length,
          'ajustement': filteredTransactions.filter((t) => t.type === 'ajustement').length,
        }

        return {
          period: { start: startDate, end: endDate },
          totalItems: items.filter((i) => i.isActive).length,
          totalValue,
          totalEntries,
          totalExits,
          totalReturns,
          lowStockItems: lowStockItems.length,
          expiredItems: 0, // TODO: Implement expiration tracking
          topConsumedItems: [], // TODO: Calculate from transactions
          transactionsByType,
          generatedAt: new Date().toISOString(),
          generatedBy: 'System',
        }
      },

      forceSave: () => {
        // Force la sauvegarde dans le localStorage
        const state = get()
        smartSave(STORE_KEY, { state, version: 1 })
      },
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        items: state.items,
        transactions: state.transactions,
        suppliers: state.suppliers,
        returns: state.returns,
        loans: state.loans,  // Save student loans
        settings: state.settings,
      }),
    }
  )
)


