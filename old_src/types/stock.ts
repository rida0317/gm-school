// src/types/stock.ts - Types pour la gestion de stock (Madrasa Privée Marocia)

// Categories principales pour école marocaine
export type StockCategory =
  | 'Hygiène'             // Soap, sanitizer, hygiene
  | 'Produit de ménage'   // Cleaning products (Javel, balai...)
  | 'Fournitures scolaires' // Pens, paper, toner, notebooks
  | 'Sport'
  | 'Pédagogique'
  | 'Informatique'
  | 'Autre';

// Type de produit - Core Business Logic
export type ProductType = 
  | 'Consommable'    // Quantity decreases permanently (لا يرتجع)
  | 'Retourable';    // Must be returned by due date (يرتجع)

export type TransactionType =
  | 'entrée'        // Achat, don, retour
  | 'sortie'        // Distribution, consommation
  | 'retour'        // Retour matériel (korat, ramel...)
  | 'perte'         // Perte, casse
  | 'ajustement';   // Correction inventaire

// Condition de retour - pour les items retourables
export type ReturnCondition = 
  | 'New'       // جديد - Like new
  | 'Good'      // بخير - Normal wear  
  | 'Fair'      // Moyen
  | 'Damaged';  // تالف - Broken/damaged

export type StockUnit = 
  | 'unité'
  | 'boîte'
  | 'ramette'
  | 'paquet'
  | 'litre'
  | 'kg'
  | 'mètre'
  | 'feuille'
  | 'cahier'
  | 'stylo'
  | 'autre';

export interface StockItem {
  id: string;
  name: string;
  description?: string;
  category: StockCategory;
  type: ProductType;            // NEW: Consommable or Retourable
  quantity: number;             // Quantité actuelle
  minQuantity: number;          // Seuil d'alerte
  maxQuantity?: number;         // Capacité max (optionnel)
  unit: StockUnit;
  price?: number;               // Prix unitaire (MAD)
  totalValue?: number;          // Valeur totale (quantity * price)
  location?: string;            // Emplacement (Magasin, Bureau, etc.)
  supplierId?: string;          // Fournisseur
  barcode?: string;             // Code-barres (optionnel)
  imageUrl?: string;            // Photo du produit
  isActive: boolean;            // Actif/Inactif
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;           // Date d'expiration (optionnel)
  notes?: string;               // Notes additionnelles
}

export interface StockTransaction {
  id: string;
  itemId: string;
  type: TransactionType;
  quantity: number;             // Positif pour entrée, négatif pour sortie
  previousQuantity: number;     // Quantité avant transaction
  newQuantity: number;          // Quantité après transaction
  userId: string;               // Qui a fait la transaction
  userName?: string;            // Nom de la personne
  date: string;
  reason: string;               // Motif (Achat, Distribution, Retour...)
  reference?: string;           // Référence (Bon de commande, Facture...)
  recipientId?: string;         // Pour qui (professeur, classe...)
  recipientType?: 'teacher' | 'student' | 'class' | 'staff';
  productType?: ProductType;    // Type de produit (Consommable/Retourable)
  dueDate?: string;             // Date de retour prévue (pour Retourable)
  returnDate?: string;          // Date de retour effective
  conditionOnReturn?: ReturnCondition;  // État au retour (New/Good/Damaged)
  notes?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  category: StockCategory;
  type: TransactionType;
  quantity: number;
  unit: StockUnit;
  userId: string;
  userName: string;
  date: string;
  reason: string;
  reference?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;            // Personne contact
  phone: string;
  email?: string;
  address?: string;
  rc?: string;                // Registre de Commerce (Maroc)
  ice?: string;               // Identifiant Commun de l'Entreprise
  city: string;               // Ville (Casablanca, Rabat...)
  isActive: boolean;
  createdAt: string;
  notes?: string;
}

export interface StockAlert {
  id: string;
  itemId: string;
  itemName: string;
  category: StockCategory;
  currentQuantity: number;
  minQuantity: number;
  alertLevel: 'critical' | 'warning';  // critical: <10%, warning: <25%
  message: string;
  createdAt: string;
}

export interface StockLoan {
  id: string;
  itemId: string;
  itemName: string;
  category: StockCategory;
  productType?: ProductType;    // Consommable or Retourable
  quantity: number;
  unit: StockUnit;
  studentId: string;            // Teacher ID (we use studentId for compatibility)
  studentName: string;          // Teacher name
  studentClassId?: string;
  studentClassName?: string;
  loanType: 'consumable' | 'returnable';
  loanDate: string;
  expectedReturnDate?: string;  // Date de retour prévue
  actualReturnDate?: string;    // Date de retour effective
  returnStatus: 'pending' | 'returned' | 'overdue' | 'lost';
  condition: 'new' | 'good' | 'fair' | 'damaged';  // Condition when borrowed
  conditionOnReturn?: ReturnCondition;  // Condition when returned (NEW!)
  notes?: string;
  borrowedBy?: string;  // Teacher/Staff who authorized the loan
}

export interface StockReturn {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: StockUnit;
  returnReason: 'unused' | 'exam_completed' | 'defective' | 'other';
  originalTransactionId?: string;  // Transaction d'origine
  returnedBy: string;              // Qui retourne
  returnedByName?: string;
  date: string;
  condition: 'excellent' | 'good' | 'damaged';
  notes?: string;
}

export interface StockInventory {
  id: string;
  date: string;
  performedBy: string;
  performedByName?: string;
  items: InventoryItem[];
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface InventoryItem {
  itemId: string;
  itemName: string;
  category: StockCategory;
  theoreticalQuantity: number;  // Quantité dans le système
  physicalQuantity: number;     // Quantité comptée
  difference: number;           // Écart
  unit: StockUnit;
  notes?: string;
}

export interface StockReport {
  period: {
    start: string;
    end: string;
  };
  totalItems: number;
  totalValue: number;
  totalEntries: number;
  totalExits: number;
  totalReturns: number;
  lowStockItems: number;
  expiredItems: number;
  topConsumedItems: StockItem[];
  transactionsByType: Record<TransactionType, number>;
  generatedAt: string;
  generatedBy: string;
}

export interface StockSettings {
  enableAlerts: boolean;
  alertThreshold: number;       // Pourcentage pour alerte (ex: 25)
  criticalThreshold: number;    // Pourcentage critique (ex: 10)
  enableExpirationTracking: boolean;
  enableBarcodeScanning: boolean;
  defaultCurrency: string;      // 'MAD'
  requireApprovalForExit: boolean;
  approverIds: string[];        // Users qui peuvent approuver
}

