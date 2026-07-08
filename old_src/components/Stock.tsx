// src/components/Stock.tsx - Moroccan School Stock Management System
// Complete rewrite with Supabase, Categories, and Consommable/Retourable logic

import React, { useState, useMemo } from 'react'
import { useStockStore } from '../store/stockStore'
import { useStudentsStore } from '../store/studentsStore'
import { useSchoolStore } from '../store/schoolStore'
import type { StockItem, StockCategory, StockUnit, ProductType, ReturnCondition } from '../types/stock'
import { translations } from '../utils/translations'
import './Stock.css'

const Stock: React.FC = () => {
  const { t, language } = useTranslation()
  const lang = language as 'fr' | 'ar' | 'en'

  const {
    items,
    transactions,
    suppliers,
    loans,
    addItem,
    updateItem,
    deleteItem,
    addTransaction,
    addLoan,
    returnLoan,
    getAlerts,
    getLowStockItems,
  } = useStockStore()

  const { students } = useStudentsStore()
  const { teachers } = useSchoolStore()

  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'movements' | 'suppliers'>('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'item' | 'movement' | 'supplier'>('item')
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Form States
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: 'Fournitures scolaires' as StockCategory,
    type: 'Consommable' as ProductType,
    quantity: 0,
    minQuantity: 5,
    unit: 'unité' as StockUnit,
    price: 0,
    location: '',
    supplierId: '',
    isActive: true,
  })

  const [movementForm, setMovementForm] = useState({
    itemId: '',
    teacherId: '',
    quantity: 1,
    type: 'Consommable' as ProductType,
    expectedReturnDate: '',
    condition: 'new' as 'new' | 'good' | 'damaged',
    notes: '',
  })

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    phone: '',
    email: '',
    city: 'Casablanca',
    isActive: true,
  })

  // Categories - Principales pour école marocaine
  const categories: StockCategory[] = [
    'Hygiène',
    'Produit de ménage',
    'Fournitures scolaires',
    'Sport',
    'Pédagogique',
    'Informatique',
    'Autre',
  ]

  const units: StockUnit[] = [
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

  // Statistics - Dashboard avec Vue Globale
  const stats = useMemo(() => {
    const activeItems = items.filter(i => i.isActive)
    const lowStock = items.filter(i => i.quantity <= i.minQuantity && i.isActive).length
    const pendingReturns = loans.filter(l => l.returnStatus === 'pending' || l.returnStatus === 'overdue').length
    const totalSuppliers = suppliers.filter(s => s.isActive).length

    // Valeur Totale du Stock
    const totalStockValue = activeItems.reduce((sum, item) => {
      return sum + ((item.price || 0) * item.quantity)
    }, 0)

    // Répartition par catégorie
    const byCategory = categories.reduce((acc, cat) => {
      const catItems = activeItems.filter(i => i.category === cat)
      acc[cat] = {
        count: catItems.length,
        quantity: catItems.reduce((sum, i) => sum + i.quantity, 0),
        value: catItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0),
      }
      return acc
    }, {} as Record<string, { count: number; quantity: number; value: number }>)

    // Répartition par type
    const consommableItems = activeItems.filter(i => i.type === 'Consommable')
    const retourableItems = activeItems.filter(i => i.type === 'Retourable')
    
    const byType = {
      Consommable: {
        count: consommableItems.length,
        quantity: consommableItems.reduce((sum, i) => sum + i.quantity, 0),
        value: consommableItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0),
      },
      Retourable: {
        count: retourableItems.length,
        quantity: retourableItems.reduce((sum, i) => sum + i.quantity, 0),
        value: retourableItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0),
      },
    }

    // Monthly Outflow Report (This Month)
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    
    const monthlyMovements = transactions.filter(t => {
      const date = new Date(t.date)
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear
    })

    const monthlyOutflow = monthlyMovements
      .filter(t => t.type === 'sortie' || t.type === 'perte')
      .reduce((sum, t) => {
        const item = items.find(i => i.id === t.itemId)
        return sum + ((item?.price || 0) * t.quantity)
      }, 0)

    // Consumption Analytics - Total consumed this month by product
    const consumptionByProduct: Record<string, { name: string; category: string; quantity: number; value: number }> = {}
    
    monthlyMovements
      .filter(t => (t.type === 'sortie' || t.type === 'perte') && t.recipientType === 'teacher')
      .forEach(t => {
        const item = items.find(i => i.id === t.itemId)
        if (!item) return
        
        if (!consumptionByProduct[t.itemId]) {
          consumptionByProduct[t.itemId] = {
            name: item.name,
            category: item.category,
            quantity: 0,
            value: 0
          }
        }
        consumptionByProduct[t.itemId].quantity += t.quantity
        consumptionByProduct[t.itemId].value += (item.price || 0) * t.quantity
      })

    // Overdue Items (RED LIST)
    const today = new Date().toISOString().split('T')[0]
    const overdueItems = loans.filter(l => 
      l.loanType === 'returnable' && 
      l.returnStatus !== 'returned' && 
      l.expectedReturnDate && 
      l.expectedReturnDate < today
    )

    return {
      totalItems: activeItems.length,
      lowStockAlerts: lowStock,
      pendingReturns,
      totalSuppliers,
      totalStockValue,
      byCategory,
      byType,
      monthlyOutflow,
      consumptionByProduct,
      overdueItems,
      overdueCount: overdueItems.length,
    }
  }, [items, loans, suppliers, transactions])

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
      const matchesType = selectedType === 'all' || item.type === selectedType
      const matchesActive = item.isActive
      return matchesSearch && matchesCategory && matchesType && matchesActive
    })
  }, [items, searchTerm, selectedCategory, selectedType])

  // Handlers
  const handleAddItem = () => {
    if (!itemForm.name) return
    addItem({
      ...itemForm,
      totalValue: itemForm.price ? itemForm.quantity * itemForm.price : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setShowModal(false)
    resetForms()
  }

  const handleAddMovement = () => {
    if (!movementForm.itemId || !movementForm.teacherId) return

    const teacher = teachers.find(t => t.id === movementForm.teacherId)
    const item = items.find(i => i.id === movementForm.itemId)

    if (!item) return

    // Create transaction
    addTransaction({
      itemId: movementForm.itemId,
      type: 'sortie',
      quantity: movementForm.quantity,
      userId: movementForm.teacherId,
      userName: teacher?.name || 'Professeur',
      recipientId: movementForm.teacherId,
      recipientType: 'teacher',
      productType: movementForm.type,
      date: new Date().toISOString(),
      reason: movementForm.type === 'Consommable' ? 'Consommation' : 'Prêt matériel',
      dueDate: movementForm.type === 'Retourable' ? movementForm.expectedReturnDate : undefined,
      notes: movementForm.notes,
    })

    // Create loan if retourable
    if (movementForm.type === 'Retourable') {
      addLoan({
        itemId: movementForm.itemId,
        itemName: item.name,
        category: item.category,
        productType: item.type,
        quantity: movementForm.quantity,
        unit: item.unit,
        studentId: movementForm.teacherId,
        studentName: teacher?.name || '',
        loanType: 'returnable',
        loanDate: new Date().toISOString(),
        expectedReturnDate: movementForm.expectedReturnDate,
        returnStatus: 'pending',
        condition: 'new',
        notes: movementForm.notes,
      })
    }

    setShowModal(false)
    resetForms()
  }

  const handleAddSupplier = () => {
    if (!supplierForm.name) return
    addSupplier({
      ...supplierForm,
      createdAt: new Date().toISOString(),
    })
    setShowModal(false)
    resetForms()
  }

  const handleReturnItem = (loan: any) => {
    returnLoan(loan.id)
    
    const item = items.find(i => i.id === loan.itemId)
    if (item) {
      addTransaction({
        itemId: loan.itemId,
        type: 'retour',
        quantity: loan.quantity,
        userId: loan.studentId,
        userName: loan.studentName,
        recipientId: loan.studentId,
        recipientType: 'teacher',
        productType: item.type,
        date: new Date().toISOString(),
        returnDate: new Date().toISOString(),
        conditionOnReturn: loan.conditionOnReturn || 'Good',
        reason: `Retour: ${loan.notes || 'Matériel retourné'}`,
      })
    }
  }

  const resetForms = () => {
    setItemForm({
      name: '',
      description: '',
      category: 'Fournitures Scolaires',
      type: 'Consommable',
      quantity: 0,
      minQuantity: 5,
      unit: 'unité',
      price: 0,
      location: '',
      supplierId: '',
      isActive: true,
    })
    setMovementForm({
      itemId: '',
      teacherId: '',
      quantity: 1,
      type: 'Consommable',
      expectedReturnDate: '',
      condition: 'new',
      notes: '',
    })
    setSupplierForm({
      name: '',
      contact: '',
      phone: '',
      email: '',
      city: 'Casablanca',
      isActive: true,
    })
    setEditingItem(null)
  }

  const openAddItem = () => {
    resetForms()
    setModalType('item')
    setShowModal(true)
  }

  const openEditItem = (item: StockItem) => {
    setItemForm({
      name: item.name,
      description: item.description || '',
      category: item.category,
      type: item.type,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unit: item.unit,
      price: item.price || 0,
      location: item.location || '',
      supplierId: item.supplierId || '',
      isActive: item.isActive,
    })
    setEditingItem(item)
    setModalType('item')
    setShowModal(true)
  }

  const handleDeleteItem = (item: StockItem) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${item.name}"?`)) {
      deleteItem(item.id)
    }
  }

  const getStatusClass = (item: StockItem) => {
    if (item.quantity === 0) return 'status-critical'
    if (item.quantity <= item.minQuantity) return 'status-low'
    return 'status-ok'
  }

  const getStatusLabel = (item: StockItem) => {
    if (item.quantity === 0) return 'stock.status.critical'
    if (item.quantity <= item.minQuantity) return 'stock.status.low'
    return 'stock.status.ok'
  }

  // Translation helper
  const stockT = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      fr: {
        'stock.title': 'Gestion de Stock',
        'stock.subtitle': 'Gérez les consommables et le matériel de l\'école',
        'stock.dashboard': 'Tableau de Bord',
        'stock.inventory': 'Inventaire',
        'stock.movements': 'Mouvements',
        'stock.suppliers': 'Fournisseurs',
        'stock.totalItems': 'Total Articles',
        'stock.totalValue': 'Valeur du Stock',
        'stock.lowStock': 'Alertes Stock Bas',
        'stock.pendingReturns': 'Retours en Attente',
        'stock.totalSuppliers': 'Fournisseurs',
        'stock.addItem': 'Ajouter Article',
        'stock.addMovement': 'Ajouter Mouvement',
        'stock.addSupplier': 'Ajouter Fournisseur',
        'stock.search': 'Rechercher...',
        'stock.allCategories': 'Toutes catégories',
        'stock.allTypes': 'Tous types',
        'stock.consumable': 'Consommable',
        'stock.returnable': 'Retourable',
        'stock.itemName': 'Nom',
        'stock.category': 'Catégorie',
        'stock.type': 'Type',
        'stock.stockLevel': 'Niveau',
        'stock.price': 'Prix',
        'stock.actions': 'Actions',
        'stock.teacher': 'Professeur',
        'stock.item': 'Article',
        'stock.returnDate': 'Date Retour',
        'stock.status': 'Statut',
        'stock.overdue': 'En Retard',
        'stock.description': 'Description',
        'stock.quantity': 'Quantité',
        'stock.minQuantity': 'Seuil Minimum',
        'stock.location': 'Emplacement',
        'stock.supplier': 'Fournisseur',
        'stock.form.itemName': 'Nom de l\'article',
        'stock.form.selectCategory': 'Catégorie',
        'stock.form.selectType': 'Type',
        'stock.form.selectUnit': 'Unité',
        'stock.form.initialQuantity': 'Quantité',
        'stock.form.alertThreshold': 'Seuil d\'alerte',
        'stock.form.selectSupplier': 'Fournisseur',
        'stock.form.enterReason': 'Motif',
        'stock.form.transactionType': 'Type',
        'stock.form.quantityMoved': 'Quantité',
        'stock.form.selectItem': 'Article',
        'stock.status.ok': 'OK',
        'stock.status.low': 'Stock Bas',
        'stock.status.critical': 'Critique',
      },
      ar: {
        'stock.title': 'إدارة المخزون',
        'stock.subtitle': 'إدارة المواد الاستهلاكية ومعدات المدرسة',
        'stock.dashboard': 'لوحة التحكم',
        'stock.inventory': 'المخزون',
        'stock.movements': 'الحركات',
        'stock.suppliers': 'الموردون',
        'stock.totalItems': 'إجمالي المقالات',
        'stock.totalValue': 'قيمة المخزون',
        'stock.lowStock': 'تنبيهات المخزون المنخفض',
        'stock.pendingReturns': 'الإرجاعات المعلقة',
        'stock.totalSuppliers': 'الموردون',
        'stock.addItem': 'إضافة مقال',
        'stock.addMovement': 'إضافة حركة',
        'stock.addSupplier': 'إضافة مورد',
        'stock.search': 'بحث...',
        'stock.allCategories': 'جميع الفئات',
        'stock.allTypes': 'جميع الأنواع',
        'stock.consumable': 'للاستهلاك',
        'stock.returnable': 'للإرجاع',
        'stock.itemName': 'الاسم',
        'stock.category': 'الفئة',
        'stock.type': 'النوع',
        'stock.stockLevel': 'المستوى',
        'stock.price': 'السعر',
        'stock.actions': 'الإجراءات',
        'stock.teacher': 'الأستاذ',
        'stock.item': 'المقال',
        'stock.returnDate': 'تاريخ الإرجاع',
        'stock.status': 'الحالة',
        'stock.overdue': 'متأخر',
        'stock.description': 'الوصف',
        'stock.quantity': 'الكمية',
        'stock.minQuantity': 'الحد الأدنى',
        'stock.location': 'الموقع',
        'stock.supplier': 'المورد',
        'stock.form.itemName': 'اسم المقال',
        'stock.form.selectCategory': 'الفئة',
        'stock.form.selectType': 'النوع',
        'stock.form.selectUnit': 'الوحدة',
        'stock.form.initialQuantity': 'الكمية',
        'stock.form.alertThreshold': 'عتبة التنبيه',
        'stock.form.selectSupplier': 'المورد',
        'stock.form.enterReason': 'السبب',
        'stock.form.transactionType': 'النوع',
        'stock.form.quantityMoved': 'الكمية',
        'stock.form.selectItem': 'المقال',
        'stock.status.ok': 'جيد',
        'stock.status.low': 'منخفض',
        'stock.status.critical': 'حرج',
      },
      en: {
        'stock.title': 'Stock Management',
        'stock.subtitle': 'Manage school consumables and equipment',
        'stock.dashboard': 'Dashboard',
        'stock.inventory': 'Inventory',
        'stock.movements': 'Movements',
        'stock.suppliers': 'Suppliers',
        'stock.totalItems': 'Total Items',
        'stock.totalValue': 'Stock Value',
        'stock.lowStock': 'Low Stock Alerts',
        'stock.pendingReturns': 'Pending Returns',
        'stock.totalSuppliers': 'Suppliers',
        'stock.addItem': 'Add Item',
        'stock.addMovement': 'Add Movement',
        'stock.addSupplier': 'Add Supplier',
        'stock.search': 'Search...',
        'stock.allCategories': 'All categories',
        'stock.allTypes': 'All types',
        'stock.consumable': 'Consumable',
        'stock.returnable': 'Returnable',
        'stock.itemName': 'Name',
        'stock.category': 'Category',
        'stock.type': 'Type',
        'stock.stockLevel': 'Level',
        'stock.price': 'Price',
        'stock.actions': 'Actions',
        'stock.teacher': 'Teacher',
        'stock.item': 'Item',
        'stock.returnDate': 'Return Date',
        'stock.status': 'Status',
        'stock.overdue': 'Overdue',
        'stock.description': 'Description',
        'stock.quantity': 'Quantity',
        'stock.minQuantity': 'Min Quantity',
        'stock.location': 'Location',
        'stock.supplier': 'Supplier',
        'stock.form.itemName': 'Item Name',
        'stock.form.selectCategory': 'Category',
        'stock.form.selectType': 'Type',
        'stock.form.selectUnit': 'Unit',
        'stock.form.initialQuantity': 'Quantity',
        'stock.form.alertThreshold': 'Alert Threshold',
        'stock.form.selectSupplier': 'Supplier',
        'stock.form.enterReason': 'Reason',
        'stock.form.transactionType': 'Type',
        'stock.form.quantityMoved': 'Quantity',
        'stock.form.selectItem': 'Item',
        'stock.status.ok': 'OK',
        'stock.status.low': 'Low',
        'stock.status.critical': 'Critical',
      },
    }
    return translations[lang]?.[key] || translations.fr[key] || key
  }

  return (
    <div className="stock-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{stockT('stock.title')}</h1>
          <p className="page-subtitle">{stockT('stock.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => { setModalType('movement'); setShowModal(true) }}>
            {stockT('stock.addMovement')}
          </button>
          <button className="btn btn-primary" onClick={openAddItem}>
            {stockT('stock.addItem')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalStockValue.toLocaleString()} DH</div>
            <div className="stat-label">{stockT('stock.totalValue')}</div>
          </div>
        </div>

        <div className="stat-card stat-primary">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalItems}</div>
            <div className="stat-label">{stockT('stock.totalItems')}</div>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.lowStockAlerts}</div>
            <div className="stat-label">{stockT('stock.lowStock')}</div>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingReturns}</div>
            <div className="stat-label">{stockT('stock.pendingReturns')}</div>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">🚚</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSuppliers}</div>
            <div className="stat-label">{stockT('stock.totalSuppliers')}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 {stockT('stock.dashboard')}
        </button>
        <button
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 {stockT('stock.inventory')}
        </button>
        <button
          className={`tab ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          📊 {stockT('stock.movements')}
        </button>
        <button
          className={`tab ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          🚚 {stockT('stock.suppliers')}
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-section">
          {/* RED LIST - Overdue Items Alert */}
          {stats.overdueCount > 0 && (
            <div className="alert-box alert-danger">
              <div className="alert-icon">🚨</div>
              <div className="alert-content">
                <h4 className="alert-title">🚨 RED LIST - Retards - متأخرات ({stats.overdueCount})</h4>
                <div className="red-list">
                  {stats.overdueItems.map(item => {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(item.expectedReturnDate!).getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={item.id} className="red-list-item critical">
                        <div className="red-list-info">
                          <span className="red-list-name">{item.itemName}</span>
                          <span className="red-list-teacher">👨‍🏫 {item.studentName}</span>
                        </div>
                        <div className="red-list-details">
                          <span className="red-list-date">📅 {new Date(item.expectedReturnDate!).toLocaleDateString()}</span>
                          <span className="red-list-days">⚠️ {daysOverdue} jours de retard</span>
                        </div>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleReturnItem(item)}
                        >
                          ✓ Retourner
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Répartition par Catégorie */}
          <div className="card">
            <h3 className="section-title">📦 Répartition par Catégorie - التفاصيل حسب الفئة</h3>
            
            <div className="category-grid">
              {categories.map(category => {
                const catData = stats.byCategory[category]
                if (!catData || catData.count === 0) return null
                
                return (
                  <div key={category} className="category-card">
                    <div className="category-header">
                      <span className="category-icon">
                        {category === 'Ménage' ? '🧹' : category === 'Hygiène' ? '🧼' : '✏️'}
                      </span>
                      <h4 className="category-name">{category}</h4>
                    </div>
                    <div className="category-stats">
                      <div className="category-stat">
                        <span className="stat-label-small">Articles:</span>
                        <span className="stat-value-small">{catData.count}</span>
                      </div>
                      <div className="category-stat">
                        <span className="stat-label-small">Quantité:</span>
                        <span className="stat-value-small">{catData.quantity}</span>
                      </div>
                      <div className="category-stat">
                        <span className="stat-label-small">Valeur:</span>
                        <span className="stat-value-small">{catData.value.toLocaleString()} DH</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Répartition par Type */}
          <div className="card">
            <h3 className="section-title">🏷️ Types de Produits - أنواع المنتجات</h3>
            
            <div className="type-comparison">
              <div className="type-card consommable">
                <h4>🏷️ Consommable (لا يرتجع)</h4>
                <div className="type-stats">
                  <div className="type-stat">
                    <span>Articles:</span>
                    <strong>{stats.byType.Consommable.count}</strong>
                  </div>
                  <div className="type-stat">
                    <span>Quantité:</span>
                    <strong>{stats.byType.Consommable.quantity}</strong>
                  </div>
                  <div className="type-stat">
                    <span>Valeur:</span>
                    <strong>{stats.byType.Consommable.value.toLocaleString()} DH</strong>
                  </div>
                </div>
              </div>

              <div className="type-card retourable">
                <h4>🔄 Retourable (يرتجع)</h4>
                <div className="type-stats">
                  <div className="type-stat">
                    <span>Articles:</span>
                    <strong>{stats.byType.Retourable.count}</strong>
                  </div>
                  <div className="type-stat">
                    <span>Quantité:</span>
                    <strong>{stats.byType.Retourable.quantity}</strong>
                  </div>
                  <div className="type-stat">
                    <span>Valeur:</span>
                    <strong>{stats.byType.Retourable.value.toLocaleString()} DH</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Consumption Report */}
          <div className="card">
            <h3 className="section-title">📈 Consumption Analytics - استهلاك الشهر</h3>
            
            <div className="consumption-header">
              <div className="consumption-info">
                <span className="consumption-label">Consommation ce mois:</span>
                <span className="consumption-value">{stats.monthlyOutflow.toLocaleString()} DH</span>
              </div>
            </div>

            <div className="consumption-grid">
              {Object.entries(stats.consumptionByProduct).slice(0, 10).map(([productId, data]) => (
                <div key={productId} className="consumption-item">
                  <div className="consumption-name">
                    <span className="consumption-category">{data.category}</span>
                    {data.name}
                  </div>
                  <div className="consumption-data">
                    <span className="consumption-quantity">📦 {data.quantity}</span>
                    <span className="consumption-value">{data.value.toLocaleString()} DH</span>
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(stats.consumptionByProduct).length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">Aucune consommation ce mois</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="card">
          {/* Filters */}
          <div className="filters-bar">
            <input
              type="text"
              className="search-input"
              placeholder={stockT('stock.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">{stockT('stock.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">{stockT('stock.allTypes')}</option>
              <option value="Consommable">{stockT('stock.consumable')}</option>
              <option value="Retourable">{stockT('stock.returnable')}</option>
            </select>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{stockT('stock.itemName')}</th>
                  <th>{stockT('stock.category')}</th>
                  <th>{stockT('stock.type')}</th>
                  <th>{stockT('stock.stockLevel')}</th>
                  <th>{stockT('stock.price')}</th>
                  <th>{stockT('stock.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id} className={getStatusClass(item)}>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.description && (
                        <div className="item-description">{item.description}</div>
                      )}
                    </td>
                    <td>
                      <span className={`category-badge cat-${item.category.replace(/\s+/g, '-').replace(/'/g, '').toLowerCase()}`}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span className={`type-badge type-${item.type.toLowerCase()}`}>
                        {item.type === 'Consommable' ? '🏷️' : '🔄'} {item.type}
                      </span>
                    </td>
                    <td>
                      <span className={`stock-level ${item.quantity <= item.minQuantity ? 'low' : 'ok'}`}>
                        {item.quantity} / {item.minQuantity}
                      </span>
                    </td>
                    <td>{item.price ? `${item.price} DH` : '-'}</td>
                    <td>
                      <div className="actions-cell">
                        <button 
                          className="btn-icon btn-edit" 
                          onClick={() => openEditItem(item)}
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-icon btn-delete" 
                          onClick={() => handleDeleteItem(item)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredInventory.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <p className="empty-state-text">Aucun article trouvé</p>
            </div>
          )}
        </div>
      )}

      {/* Movements Tab - To be continued... */}
      {activeTab === 'movements' && (
        <div className="card">
          <h3 className="section-title">📊 Historique des Mouvements</h3>
          <p>Movements table will be implemented here...</p>
        </div>
      )}

      {/* Suppliers Tab - To be continued... */}
      {activeTab === 'suppliers' && (
        <div className="card">
          <h3 className="section-title">🚚 Fournisseurs</h3>
          <p>Suppliers list will be implemented here...</p>
        </div>
      )}

      {/* Modal - To be continued... */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalType === 'item' && (editingItem ? '✏️ Modifier Article' : '➕ Ajouter Article')}
                {modalType === 'movement' && '📤 Ajouter Mouvement'}
                {modalType === 'supplier' && '🚚 Ajouter Fournisseur'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Item Form */}
              {modalType === 'item' && (
                <form onSubmit={(e) => { e.preventDefault(); handleAddItem() }} className="form-grid">
                  <div className="form-group full-width">
                    <label>{stockT('stock.form.itemName')}</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="Ex: Ramette A4"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>{stockT('stock.description')}</label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.selectCategory')}</label>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as StockCategory })}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.selectType')}</label>
                    <select
                      value={itemForm.type}
                      onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as ProductType })}
                    >
                      <option value="Consommable">Consommable (لا يرتجع)</option>
                      <option value="Retourable">Retourable (يرتجع)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.selectUnit')}</label>
                    <select
                      value={itemForm.unit}
                      onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value as StockUnit })}
                    >
                      {units.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.initialQuantity')}</label>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.alertThreshold')}</label>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.minQuantity}
                      onChange={(e) => setItemForm({ ...itemForm, minQuantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.price')} (DH)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.location')}</label>
                    <input
                      type="text"
                      value={itemForm.location}
                      onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingItem ? 'Modifier' : 'Ajouter'}
                    </button>
                  </div>
                </form>
              )}

              {/* Movement Form */}
              {modalType === 'movement' && (
                <form onSubmit={(e) => { e.preventDefault(); handleAddMovement() }} className="form-grid">
                  <div className="form-group full-width">
                    <label>{stockT('stock.form.selectItem')}</label>
                    <select
                      required
                      value={movementForm.itemId}
                      onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })}
                    >
                      <option value="">Sélectionner un article</option>
                      {items.filter(i => i.isActive).map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.quantity} disponible) - {item.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>👨‍🏫 {stockT('stock.teacher')}</label>
                    <select
                      required
                      value={movementForm.teacherId}
                      onChange={(e) => setMovementForm({ ...movementForm, teacherId: e.target.value })}
                    >
                      <option value="">Sélectionner un professeur</option>
                      {teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{stockT('stock.form.quantityMoved')}</label>
                    <input
                      type="number"
                      min="1"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Type d'article</label>
                    <select
                      value={movementForm.type}
                      onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as ProductType })}
                    >
                      <option value="Consommable">Consommable (لا يرتجع)</option>
                      <option value="Retourable">Retourable (يرتجع)</option>
                    </select>
                  </div>

                  {movementForm.type === 'Retourable' && (
                    <div className="form-group full-width">
                      <label>📅 {stockT('stock.returnDate')} (obligatoire)</label>
                      <input
                        type="date"
                        required
                        value={movementForm.expectedReturnDate}
                        onChange={(e) => setMovementForm({ ...movementForm, expectedReturnDate: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      value={movementForm.notes}
                      onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Informations additionnelles..."
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}

              {/* Supplier Form */}
              {modalType === 'supplier' && (
                <form onSubmit={(e) => { e.preventDefault(); handleAddSupplier() }} className="form-grid">
                  <div className="form-group full-width">
                    <label>Nom du fournisseur *</label>
                    <input
                      type="text"
                      required
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      placeholder="Ex: Librairie Al Amal"
                    />
                  </div>

                  <div className="form-group">
                    <label>Téléphone *</label>
                    <input
                      type="tel"
                      required
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="05 22 00 00 00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Ville</label>
                    <input
                      type="text"
                      value={supplierForm.city}
                      onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                      placeholder="Casablanca"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Email</label>
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Contact</label>
                    <input
                      type="text"
                      value={supplierForm.contact}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                      placeholder="Nom de la personne contact"
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Stock

