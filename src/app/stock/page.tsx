'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { StockProduct, StockCategory, StockMovement, StockMovementType, Teacher } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { useConfirm, useNotify } from '@/lib/modal-service';
import {
  Boxes,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Search,
  Package,
  X,
  History,
  Send,
  UserCheck,
  Building2,
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  ShoppingBag,
  Clock,
  BookOpen,
  Laptop,
  Palette,
  Sparkle,
  Dumbbell,
  FlaskConical,
  SprayCan
} from 'lucide-react';

// Default Visual Categories with Icons & Color Palettes
const PRESET_CATEGORIES = [
  { id: 'ALL', name: 'Tous les Articles', icon: Boxes, color: 'from-blue-600 to-indigo-600' },
  { id: 'FOURNITURES', name: 'Fournitures & Papeterie', icon: BookOpen, color: 'from-sky-500 to-blue-600' },
  { id: 'INFORMATIQUE', name: 'Informatique & IT', icon: Laptop, color: 'from-violet-500 to-purple-600' },
  { id: 'PEDAGOGIE', name: 'Arts & Pédagogie', icon: Palette, color: 'from-pink-500 to-rose-600' },
  { id: 'SCIENCES', name: 'Sciences & Labo', icon: FlaskConical, color: 'from-emerald-500 to-teal-600' },
  { id: 'HYGIENE', name: 'Hygiène & Entretien', icon: SprayCan, color: 'from-teal-500 to-cyan-600' },
  { id: 'SPORT', name: 'Sport & EPS', icon: Dumbbell, color: 'from-amber-500 to-orange-600' },
];

// Realistic Sample School Inventory
const DEFAULT_PRODUCTS: Partial<StockProduct>[] = [
  {
    id: 'prod-1',
    name: 'Rames de Papier A4 (80g - Blanc)',
    sku: 'PAP-A4-80G',
    quantity: 45,
    minimum_quantity: 10,
    unit: 'Rame',
    purchase_price: 42,
    value_price: 42,
    status: 'IN_STOCK',
    image_url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=500&auto=format&fit=crop&q=60',
    category: { id: 'FOURNITURES', name: 'Fournitures & Papeterie' },
  },
  {
    id: 'prod-2',
    name: 'Marqueurs Tableau Blanc (Lot de 4 couleurs)',
    sku: 'MRK-TB-4C',
    quantity: 32,
    minimum_quantity: 8,
    unit: 'Boîte',
    purchase_price: 25,
    value_price: 25,
    status: 'IN_STOCK',
    image_url: 'https://images.unsplash.com/photo-1585336261026-77894a4c6a6f?w=500&auto=format&fit=crop&q=60',
    category: { id: 'FOURNITURES', name: 'Fournitures & Papeterie' },
  },
  {
    id: 'prod-3',
    name: 'Vidéoprojecteur Epson HD HDMI',
    sku: 'IT-PROJ-EPS',
    quantity: 4,
    minimum_quantity: 2,
    unit: 'Unité',
    purchase_price: 3800,
    value_price: 3800,
    status: 'IN_STOCK',
    image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=60',
    category: { id: 'INFORMATIQUE', name: 'Informatique & IT' },
  },
  {
    id: 'prod-4',
    name: 'Kit Gouache & Peinture Écolier (12 tubes)',
    sku: 'ART-GOU-12',
    quantity: 3,
    minimum_quantity: 6,
    unit: 'Lot',
    purchase_price: 35,
    value_price: 35,
    status: 'LOW_STOCK',
    image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&auto=format&fit=crop&q=60',
    category: { id: 'PEDAGOGIE', name: 'Arts & Pédagogie' },
  },
  {
    id: 'prod-5',
    name: 'Gel Hydroalcoolique 5 Litres + Pompe',
    sku: 'HYG-GEL-5L',
    quantity: 12,
    minimum_quantity: 4,
    unit: 'Bidon',
    purchase_price: 95,
    value_price: 95,
    status: 'IN_STOCK',
    image_url: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=500&auto=format&fit=crop&q=60',
    category: { id: 'HYGIENE', name: 'Hygiène & Entretien' },
  },
  {
    id: 'prod-6',
    name: 'Ballons de Basketball Mikasa Officiel',
    sku: 'SPT-BAL-BSK',
    quantity: 8,
    minimum_quantity: 3,
    unit: 'Unité',
    purchase_price: 180,
    value_price: 180,
    status: 'IN_STOCK',
    image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&auto=format&fit=crop&q=60',
    category: { id: 'SPORT', name: 'Sport & EPS' },
  },
  {
    id: 'prod-7',
    name: 'Microscopes Optiques Monoculaire 400x',
    sku: 'SCI-MIC-400',
    quantity: 2,
    minimum_quantity: 2,
    unit: 'Unité',
    purchase_price: 1250,
    value_price: 1250,
    status: 'LOW_STOCK',
    image_url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=500&auto=format&fit=crop&q=60',
    category: { id: 'SCIENCES', name: 'Sciences & Labo' },
  },
  {
    id: 'prod-8',
    name: 'Rouleaux Papier Essuie-mains Bobine 450m',
    sku: 'HYG-ESS-450',
    quantity: 0,
    minimum_quantity: 5,
    unit: 'Bobine',
    purchase_price: 28,
    value_price: 28,
    status: 'OUT_OF_STOCK',
    image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60',
    category: { id: 'HYGIENE', name: 'Hygiène & Entretien' },
  },
];

export function getArticleImage(product: Partial<StockProduct>): string {
  if (product.image_url && product.image_url.trim().length > 0 && !product.image_url.includes('example.com')) {
    return product.image_url;
  }

  const name = (product.name || '').toLowerCase();
  const sku = (product.sku || '').toLowerCase();
  const cat = (product.category?.name || (typeof product.category_id === 'string' ? product.category_id : '')).toLowerCase();

  // 1. Cables & HDMI / Connectique
  if (name.includes('hdmi') || name.includes('cable') || name.includes('câble') || sku.includes('hdmi') || sku.includes('cab')) {
    return '/stock/hdmi.svg';
  }

  // 2. Projectors & Screens / Vidéoprojecteur
  if (name.includes('projecteur') || name.includes('vidéo') || name.includes('video') || sku.includes('epson') || sku.includes('prj') || sku.includes('proj')) {
    return '/stock/projector.svg';
  }

  // 3. Paper / Ramettes / Cahiers / Cartons
  if (name.includes('papier') || name.includes('rame') || name.includes('ramette') || name.includes('carton') || sku.includes('pap') || sku.includes('a4')) {
    return '/stock/paper.svg';
  }

  // 4. Whiteboard Markers / Stylos / Marqueurs
  if (name.includes('marqueur') || name.includes('stylo') || name.includes('feutre') || name.includes('tableau') || sku.includes('mrq') || sku.includes('mrk')) {
    return '/stock/markers.svg';
  }

  // 5. Hand Sanitizer / Gel / Hygiène / Nettoyage / Savon
  if (name.includes('gel') || name.includes('hydro') || name.includes('savon') || name.includes('désinfectant') || name.includes('entretien') || sku.includes('gel') || sku.includes('hyg')) {
    return '/stock/gel.svg';
  }

  // Default School Supplies
  return '/stock/default.svg';
}

export default function StockPage() {
  const { t, dir } = useI18n();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'caisse' | 'movements'>('caisse');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modals
  const [showDispatchModal, setShowDispatchModal] = useState(false); // Chkoun talbo / Sortie
  const [showInflowModal, setShowInflowModal] = useState(false); // Entrée / Réappro
  const [showProductModal, setShowProductModal] = useState(false); // Add/Edit product
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null);
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'MONTH' | 'ALL' | 'YEAR'>('MONTH');
  const [reportViewTab, setReportViewTab] = useState<'INVENTORY' | 'DISPATCHES' | 'FULL'>('FULL');

  // Form states
  const [dispatchForm, setDispatchForm] = useState({
    quantity: 1,
    requested_by: '',
    department: 'Pédagogique',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [inflowForm, setInflowForm] = useState({
    quantity: 10,
    supplier: '',
    reason: 'Réapprovisionnement stock',
    date: new Date().toISOString().split('T')[0],
  });

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category_id: 'FOURNITURES',
    quantity: 10,
    minimum_quantity: 5,
    unit: 'Unité',
    purchase_price: 0,
    value_price: 0,
    image_url: '',
  });

  const confirm = useConfirm();
  const notify = useNotify();

  // Load Products, Teachers, Categories & Movements
  async function loadStockData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: prods }, { data: cats }, { data: tchs }] = await Promise.all([
        supabase.from('stock_products').select('*, category:stock_categories(*)').order('name'),
        supabase.from('stock_categories').select('*').order('name'),
        supabase.from('teachers').select('*').order('last_name'),
      ]);

      if (prods) {
        setProducts(prods);
      }
      
      if (cats) {
        setCategories(cats);
      }
      if (tchs) {
        setTeachers(tchs);
      }

      // Load Movements History from Supabase
      const { data: movs } = await supabase
        .from('stock_movements')
        .select('*, product:stock_products(*)')
        .order('created_at', { ascending: false });

      if (movs) {
        setMovements(movs);
      }
    } catch (err) {
      console.error('Error loading stock data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStockData();
  }, []);


  // -------------------------------------------------------------
  // ACTION 1: DISPATCH / SORTIE DE STOCK (CHKOUN TALBO)
  // -------------------------------------------------------------
  const handleOpenDispatchModal = (product: StockProduct) => {
    setSelectedProduct(product);
    setDispatchForm({
      quantity: 1,
      requested_by: teachers[0] ? `${teachers[0].first_name} ${teachers[0].last_name}` : '',
      department: 'Pédagogique',
      reason: t('stock.reason_besoins_cours'),
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowDispatchModal(true);
  };

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyOut = Number(dispatchForm.quantity);
    if (qtyOut <= 0) {
      notify({ title: t('stock.alert_attention'), message: t('stock.msg_quantity_positive'), type: 'warning' });
      return;
    }

    if (qtyOut > selectedProduct.quantity) {
      notify({
        title: t('stock.alert_insufficient'),
        message: `Quantité demandée (${qtyOut}) dépasse le stock disponible (${selectedProduct.quantity} ${selectedProduct.unit}s).`,
        type: 'danger',
      });
      return;
    }

    const previousQty = selectedProduct.quantity;
    const newQty = previousQty - qtyOut;
    const newStatus = newQty === 0 ? 'OUT_OF_STOCK' : newQty <= selectedProduct.minimum_quantity ? 'LOW_STOCK' : 'IN_STOCK';

    // 1. Create movement record
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      product_id: selectedProduct.id,
      movement_type: 'OUT',
      quantity: qtyOut,
      previous_quantity: previousQty,
      new_quantity: newQty,
      requested_by: dispatchForm.requested_by.trim() || 'Personnel Établissement',
      department: dispatchForm.department,
      reason: dispatchForm.reason.trim() || 'Sortie Standard',
      voucher_number: `BS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: dispatchForm.notes.trim() || undefined,
      created_at: `${dispatchForm.date}T${new Date().toLocaleTimeString('fr-FR')}`,
      product: selectedProduct,
    };

    // 2. Update Product Quantity
    const updatedProducts = products.map((p) =>
      p.id === selectedProduct.id ? { ...p, quantity: newQty, status: newStatus } : p
    );

    // 3. Persist to DB and update local state
    try {
      const supabase = createClient();
      const [{ error: updateErr }, { error: insertErr }] = await Promise.all([
        supabase
          .from('stock_products')
          .update({ quantity: newQty, status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', selectedProduct.id),
        supabase.from('stock_movements').insert([
          {
            product_id: selectedProduct.id,
            movement_type: 'OUT',
            quantity: qtyOut,
            previous_quantity: previousQty,
            new_quantity: newQty,
            requested_by: dispatchForm.requested_by.trim() || 'Personnel Établissement',
            department: dispatchForm.department,
            reason: dispatchForm.reason.trim() || 'Sortie Standard',
            voucher_number: `BS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            notes: dispatchForm.notes.trim() || null,
          },
        ]),
      ]);

      if (updateErr) throw updateErr;
      if (insertErr) throw insertErr;

      // Update local state on success
      setProducts(updatedProducts);
      // Refresh movements from DB to get exact records and IDs
      loadStockData();
    } catch (err: unknown) {
      console.error('Failed to sync dispatch to remote db:', err);
      const msg = err instanceof Error ? err.message : 'Erreur de synchronisation';
      notify({ title: 'Erreur Serveur', message: msg, type: 'danger' });
      return;
    }

    setShowDispatchModal(false);
    notify({
      title: t('stock.success_dispatch'),
      message: `${qtyOut} ${selectedProduct.unit}(s) de "${selectedProduct.name}" remis(es) à "${dispatchForm.requested_by}".`,
      type: 'success',
    });
  };

  // -------------------------------------------------------------
  // ACTION 2: INFLOW / RÉAPPROVISIONNEMENT (+IN)
  // -------------------------------------------------------------
  const handleOpenInflowModal = (product: StockProduct) => {
    setSelectedProduct(product);
    setInflowForm({
      quantity: 10,
      supplier: 'Fournisseur Agréé',
      reason: 'Livraison / Réapprovisionnement',
      date: new Date().toISOString().split('T')[0],
    });
    setShowInflowModal(true);
  };

  const handleConfirmInflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyIn = Number(inflowForm.quantity);
    if (qtyIn <= 0) return;

    const previousQty = selectedProduct.quantity;
    const newQty = previousQty + qtyIn;
    const newStatus = newQty <= selectedProduct.minimum_quantity ? 'LOW_STOCK' : 'IN_STOCK';

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      product_id: selectedProduct.id,
      movement_type: 'IN',
      quantity: qtyIn,
      previous_quantity: previousQty,
      new_quantity: newQty,
      requested_by: `Entrée Stock (${inflowForm.supplier})`,
      department: 'Logistique',
      reason: inflowForm.reason,
      voucher_number: `BE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: `${inflowForm.date}T${new Date().toLocaleTimeString('fr-FR')}`,
      product: selectedProduct,
    };

    const updatedProducts = products.map((p) =>
      p.id === selectedProduct.id ? { ...p, quantity: newQty, status: newStatus } : p
    );

    try {
      const supabase = createClient();
      const [{ error: updateErr }, { error: insertErr }] = await Promise.all([
        supabase
          .from('stock_products')
          .update({ quantity: newQty, status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', selectedProduct.id),
        supabase.from('stock_movements').insert([
          {
            product_id: selectedProduct.id,
            movement_type: 'IN',
            quantity: qtyIn,
            previous_quantity: previousQty,
            new_quantity: newQty,
            requested_by: `Entrée Stock (${inflowForm.supplier})`,
            department: 'Logistique',
            reason: inflowForm.reason,
            voucher_number: `BE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          },
        ]),
      ]);

      if (updateErr) throw updateErr;
      if (insertErr) throw insertErr;

      setProducts(updatedProducts);
      loadStockData();
    } catch (err: unknown) {
      console.error('DB update error:', err);
      const msg = err instanceof Error ? err.message : 'Erreur de synchronisation';
      notify({ title: 'Erreur Serveur', message: msg, type: 'danger' });
      return;
    }

    setShowInflowModal(false);
    notify({
      title: t('stock.success_restock'),
      message: `+${qtyIn} ${selectedProduct.unit}(s) ajoutés au stock de "${selectedProduct.name}".`,
      type: 'success',
    });
  };

  // -------------------------------------------------------------
  // ACTION 3: CREATE / EDIT PRODUCT
  // -------------------------------------------------------------
  const handleOpenAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: `ART-${Date.now().toString().slice(-4)}`,
      category_id: 'FOURNITURES',
      quantity: 10,
      minimum_quantity: 5,
      unit: 'Unité',
      purchase_price: 0,
      value_price: 0,
      image_url: '',
    });
    setShowProductModal(true);
  };

  const handleOpenEditProductModal = (product: StockProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      category_id: product.category_id || product.category?.id || 'FOURNITURES',
      quantity: product.quantity,
      minimum_quantity: product.minimum_quantity,
      unit: product.unit || 'Unité',
      purchase_price: product.purchase_price || 0,
      value_price: product.value_price || 0,
      image_url: product.image_url || '',
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      const statusValue = Number(productForm.quantity) === 0
              ? 'OUT_OF_STOCK'
              : Number(productForm.quantity) <= Number(productForm.minimum_quantity)
              ? 'LOW_STOCK'
              : 'IN_STOCK';

      if (editingProduct) {
        // UPDATE
        const { error } = await supabase.from('stock_products').update({
          name: productForm.name.trim(),
          sku: productForm.sku.trim(),
          category_id: productForm.category_id,
          quantity: Number(productForm.quantity),
          minimum_quantity: Number(productForm.minimum_quantity),
          unit: productForm.unit.trim(),
          purchase_price: Number(productForm.purchase_price),
          value_price: Number(productForm.purchase_price),
          image_url: productForm.image_url.trim() || null,
          status: statusValue,
          updated_at: new Date().toISOString()
        }).eq('id', editingProduct.id);

        if (error) throw error;

        notify({
          title: 'Article Mis à Jour',
          message: `Les détails de "${productForm.name}" ont été actualisés.`,
          type: 'success',
        });
      } else {
        // INSERT
        const { error } = await supabase.from('stock_products').insert([{
          name: productForm.name.trim(),
          sku: productForm.sku.trim(),
          category_id: productForm.category_id,
          quantity: Number(productForm.quantity),
          minimum_quantity: Number(productForm.minimum_quantity),
          unit: productForm.unit.trim() || 'Unité',
          purchase_price: Number(productForm.purchase_price),
          value_price: Number(productForm.purchase_price),
          image_url: productForm.image_url.trim() || null,
          status: statusValue,
        }]);

        if (error) throw error;

        notify({
          title: 'Nouvel Article Ajouté',
          message: `L'article "${productForm.name}" est désormais dans l'inventaire.`,
          type: 'success',
        });
      }

      setShowProductModal(false);
      loadStockData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur Serveur', message: msg, type: 'danger' });
    }
  };

  const handleDeleteProduct = async (product: StockProduct) => {
    const ok = await confirm({
      title: t('stock.confirm_delete_title'),
      message: `Êtes-vous sûr de vouloir supprimer "${product.name}" de l'inventaire ?`,
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('stock_products').delete().eq('id', product.id);
      
      if (error) throw error;
      
      notify({ title: 'Supprimé', message: 'Article retiré de l\'inventaire.', type: 'success' });
      loadStockData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur Serveur', message: msg, type: 'danger' });
    }
  };

  // -------------------------------------------------------------
  // FILTERED PRODUCTS (POS SEARCH & CATEGORY)
  // -------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter with normalized exact matching
      let matchCat = true;
      if (selectedCategory !== 'ALL') {
        const rawCatId = (p.category_id || p.category?.id || '').toLowerCase();
        const rawCatName = (p.category?.name || '').toLowerCase();
        const prodName = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();

        const combined = `${rawCatId} ${rawCatName} ${prodName} ${sku}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''); // Remove accents (e.g. equipements -> equipements, hygiène -> hygiene)

        switch (selectedCategory) {
          case 'INFORMATIQUE':
            matchCat =
              combined.includes('informatique') ||
              combined.includes('ordinateur') ||
              combined.includes('laptop') ||
              combined.includes('cable') ||
              combined.includes('hdmi') ||
              combined.includes('projecteur') ||
              combined.includes('epson') ||
              /\b(it|pc|usb|tech|ecran|souris|clavier)\b/.test(combined);
            break;

          case 'FOURNITURES':
            matchCat =
              combined.includes('fourniture') ||
              combined.includes('papeterie') ||
              combined.includes('papier') ||
              combined.includes('rame') ||
              combined.includes('marqueur') ||
              combined.includes('stylo') ||
              combined.includes('cahier') ||
              combined.includes('classeur') ||
              combined.includes('bureautique');
            break;

          case 'HYGIENE':
            matchCat =
              combined.includes('hygiene') ||
              combined.includes('entretien') ||
              combined.includes('nettoyage') ||
              combined.includes('gel') ||
              combined.includes('savon') ||
              combined.includes('desinfectant') ||
              combined.includes('javel') ||
              combined.includes('essuie');
            break;

          case 'PEDAGOGIE':
            matchCat =
              combined.includes('pedagogie') ||
              combined.includes('art') ||
              combined.includes('dessin') ||
              combined.includes('peinture') ||
              combined.includes('gouache') ||
              combined.includes('pinceau') ||
              combined.includes('feutre') ||
              combined.includes('bricolage');
            break;

          case 'SCIENCES':
            matchCat =
              combined.includes('science') ||
              combined.includes('labo') ||
              combined.includes('microscope') ||
              combined.includes('chimie') ||
              combined.includes('physique') ||
              combined.includes('eprouvette');
            break;

          case 'SPORT':
            matchCat =
              combined.includes('sport') ||
              combined.includes('eps') ||
              combined.includes('ballon') ||
              combined.includes('basket') ||
              combined.includes('foot') ||
              combined.includes('gym');
            break;

          default:
            matchCat =
              rawCatId.includes(selectedCategory.toLowerCase()) ||
              rawCatName.includes(selectedCategory.toLowerCase());
        }
      }

      // Status filter
      let matchStatus = true;
      if (stockStatusFilter === 'IN_STOCK') {
        matchStatus = p.quantity > p.minimum_quantity;
      } else if (stockStatusFilter === 'LOW_STOCK') {
        matchStatus = p.quantity > 0 && p.quantity <= p.minimum_quantity;
      } else if (stockStatusFilter === 'OUT_OF_STOCK') {
        matchStatus = p.quantity === 0;
      }

      // Search term
      const matchSearch =
        searchTerm === '' ||
        `${p.name} ${p.sku} ${p.category?.name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCat && matchStatus && matchSearch;
    });
  }, [products, selectedCategory, stockStatusFilter, searchTerm]);

  // Real-time KPI Stats
  const stockStats = useMemo(() => {
    const totalArticles = products.length;
    const totalItemsCount = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.minimum_quantity).length;
    const outOfStockCount = products.filter((p) => p.quantity === 0).length;
    const totalDispatchesThisMonth = movements.filter((m) => m.movement_type === 'OUT').length;
    return { totalArticles, totalItemsCount, lowStockCount, outOfStockCount, totalDispatchesThisMonth };
  }, [products, movements]);

  // Beneficiary Master List for Instant Autocomplete
  const beneficiaryOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string; category: string; department: string }> = [];

    // 1. Teachers
    teachers.forEach((t) => {
      list.push({
        id: `tch-${t.id}`,
        name: `${t.first_name} ${t.last_name}`,
        role: t.specialization ? `Enseignant (${t.specialization})` : 'Enseignant',
        category: 'ENSEIGNANT',
        department: t('stock.department_pedagogique'),
      });
    });

    // 2. Administration Staff
    [
      { name: 'M. Le Directeur Général', role: 'Direction', department: 'Direction' },
      { name: 'Secrétariat & Accueil', role: 'Administration', department: 'Administration' },
      { name: 'Vie Scolaire & Surveillants Généraux', role: 'Surveillance', department: 'Vie Scolaire' },
      { name: 'Service Économat & Matériel', role: 'Gestion', department: 'Économat' },
      { name: 'Direction Pédagogique', role: 'Pédagogie', department: 'Pédagogique' },
    ].forEach((item, idx) => {
      list.push({
        id: `adm-${idx}`,
        name: item.name,
        role: item.role,
        category: 'ADMIN',
        department: item.department,
      });
    });

    // 3. Support & Maintenance Staff
    [
      { name: 'Fatima Zahra (Assistante Maternelle)', role: 'Assistante', department: 'Maternelle' },
      { name: 'Aicha Bennis (Équipe Entretien & Ménage)', role: 'Agent d\'entretien', department: 'Entretien' },
      { name: 'Mohamed Tazi (Chauffeur Transport)', role: 'Transport Scolaire', department: 'Transport' },
      { name: 'Brahim Naciri (Sécurité & Gardiennage)', role: 'Agent de Sécurité', department: 'Sécurité' },
    ].forEach((item, idx) => {
      list.push({
        id: `sup-${idx}`,
        name: item.name,
        role: item.role,
        category: 'SUPPORT',
        department: item.department,
      });
    });

    // 4. Classes & Special Rooms
    [
      { name: 'Classe Maternelle GS-A', role: 'Classe Maternelle', department: 'Maternelle' },
      { name: 'Classe CP-A (Primaire)', role: 'Classe Primaire', department: 'Primaire' },
      { name: 'Classe CE1-A (Primaire)', role: 'Classe Primaire', department: 'Primaire' },
      { name: 'Classe 1AC-1 (Collège)', role: 'Classe Collège', department: 'Collège' },
      { name: 'Classe Tronc Commun Sciences', role: 'Classe Lycée', department: 'Lycée' },
      { name: 'Laboratoire de Physique-Chimie & SVT', role: 'Laboratoire', department: 'Sciences' },
      { name: 'Salle Informatique & Multimédia', role: 'Salle IT', department: 'Informatique' },
      { name: 'Salle des Professeurs', role: 'Espace Enseignants', department: 'Pédagogique' },
      { name: 'Bibliothèque & Centre de Documentation', role: 'CDI / Bibliothèque', department: 'Culture' },
      { name: 'Terrain de Sport & Gymnase', role: 'Complexe EPS', department: 'Sport' },
    ].forEach((item, idx) => {
      list.push({
        id: `cls-${idx}`,
        name: item.name,
        role: item.role,
        category: 'CLASSE',
        department: item.department,
      });
    });

    return list;
  }, [teachers]);

  // Filtered Autocomplete Suggestions based on typing
  const matchedBeneficiaries = useMemo(() => {
    const query = dispatchForm.requested_by.trim().toLowerCase();
    if (!query) {
      return beneficiaryOptions.slice(0, 8);
    }
    return beneficiaryOptions
      .filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.role.toLowerCase().includes(query) ||
          b.category.toLowerCase().includes(query) ||
          b.department.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [beneficiaryOptions, dispatchForm.requested_by]);

  const handlePrintReport = () => {
    if (typeof window === 'undefined') return;
    const originalTitle = document.title;
    const today = new Date().toISOString().split('T')[0];
    document.title = `Rapport_Inventaire_Stock_GM_${today}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  const handleExportExcel = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const headers = [
        'Réf SKU',
        'Désignation de l\'Article',
        'Catégorie',
        'Quantité en Stock',
        'Unité',
        'Seuil Minimum d\'Alerte',
        'Prix Unitaire Achat (MAD)',
        'Valeur Totale Stock (MAD)',
        'Statut du Stock',
        'Fournisseur Référent',
        'Date d\'Édition'
      ];

      const rows = products.map((p) => {
        const isOut = p.quantity === 0;
        const isLow = p.quantity > 0 && p.quantity <= p.minimum_quantity;
        const statut = isOut ? 'RUPTURE DE STOCK' : isLow ? 'STOCK FAIBLE' : 'DISPONIBLE';
        const totalVal = ((p.unit_price || 0) * (p.quantity || 0)).toFixed(2);

        return [
          `"${p.sku}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.category?.name || 'Général').replace(/"/g, '""')}"`,
          p.quantity,
          `"${p.unit || 'Unité'}"`,
          p.minimum_quantity,
          (p.unit_price || 0).toFixed(2),
          totalVal,
          `"${statut}"`,
          `"${(p.supplier?.name || 'Fournisseur GM').replace(/"/g, '""')}"`,
          `"${today}"`
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Inventaire_Stock_GM_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify({ type: 'success', title: 'Export Réussi', message: 'Le fichier Excel/CSV a été téléchargé avec succès.' });
    } catch (err) {
      console.error('Error exporting stock:', err);
      notify({ type: 'error', title: 'Erreur d\'export', message: 'Impossible de générer le fichier d\'export.' });
    }
  };

  return (
    <DashboardLayout>
      {/* Official Print Stylesheet for Stock Inventory & Disbursement Report */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm 12mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          .print-stock-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 275mm !important;
            max-height: 275mm !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      <div className="space-y-6 print:hidden">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              <Boxes className="w-4 h-4" />
              <span>{t('economat_logistics')} &bull; {t('store_suppliers')}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {t('stock_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'واجهة بصرية تفاعلية لتسيير المواد والمخزون، وتتبع تسليم التجهيزات للأطر والأساتذة.' : "Interface visuelle (Mode Caisse / Magasin), suivi des dotations par enseignant/service et déstockage en 1 clic."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{dir === 'rtl' ? 'تصدير Excel' : 'Exporter Excel'}</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 font-bold text-xs shadow-xs hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{dir === 'rtl' ? 'تصدير PDF' : 'Exporter PDF'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-white shrink-0" />
              <span>{dir === 'rtl' ? 'تقرير وحصيلة' : 'Rapport & Bilan'}</span>
            </button>

            <button
              onClick={handleOpenAddProductModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-slate-950 shrink-0" />
              <span>{t('add_article')}</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stockStats.totalArticles}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('articles_referenced')}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stockStats.totalItemsCount.toLocaleString()}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{dir === 'rtl' ? 'مجموع الوحدات في المخزن' : 'Unités Globales en Stock'}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {stockStats.lowStockCount + stockStats.outOfStockCount}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {dir === 'rtl' ? 'تنبيهات النفاذ' : 'Alertes'} ({stockStats.outOfStockCount} {dir === 'rtl' ? 'نافذة' : 'ruptures'})
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {stockStats.totalDispatchesThisMonth}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('dispatches_out')}</div>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
          <button
            onClick={() => setActiveTab('caisse')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'caisse'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'واجهة التوزيع والمخزن البصري' : 'Mode Caisse & Rayonnage Visuel'}</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'سجل الحركات والتسليم' : 'Historique des Sorties & Mouvements'} ({movements.length})</span>
          </button>
        </div>

        {/* TAB 1: POS / CAISSE VISUAL TILES */}
        {activeTab === 'caisse' && (
          <div className="space-y-4">
            {/* Filter Ribbon: Categories + Search + Status */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
              {/* Category Pills (POS Style) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {PRESET_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search + Stock Status Bar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par libellé, référence SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">État :</span>
                  <select
                    value={stockStatusFilter}
                    onChange={(e) => setStockStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  >
                    <option value="ALL">Tous les états</option>
                    <option value="IN_STOCK">🟢 En stock uniquement</option>
                    <option value="LOW_STOCK">🟠 Stock faible</option>
                    <option value="OUT_OF_STOCK">🔴 Rupture de stock</option>
                  </select>
                </div>
              </div>
            </div>

            {/* POS VISUAL PRODUCT GRID (B7AL LA CAISSE) */}
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-semibold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                Aucun article ne correspond à votre recherche.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.quantity === 0;
                  const isLow = product.quantity > 0 && product.quantity <= product.minimum_quantity;

                  return (
                    <div
                      key={product.id}
                      className={`group relative rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-xl ${
                        isOutOfStock
                          ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20'
                          : isLow
                          ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/20 hover:border-amber-400'
                          : 'border-slate-200 dark:border-slate-800 hover:border-sky-500'
                      }`}
                    >
                      {/* Product Visual Box Header */}
                      <div>
                        {/* Image Container with Dynamic Photo */}
                        <div className="relative h-40 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                          <img
                            src={getArticleImage(product)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.src.includes('default.svg')) {
                                target.src = '/stock/default.svg';
                              }
                            }}
                          />

                          {/* Category Badge Floating */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-950/80 backdrop-blur-md text-white shadow-xs">
                              {product.category?.name || 'Général'}
                            </span>
                          </div>

                          {/* SKU Badge Floating */}
                          <div className="absolute top-2.5 right-2.5">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-xs">
                              {product.sku}
                            </span>
                          </div>

                          {/* Stock Status Badge */}
                          <div className="absolute bottom-2.5 right-2.5">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-600 text-white shadow-md animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Rupture
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500 text-slate-950 shadow-md">
                                <AlertTriangle className="w-3 h-3" />
                                Stock Faible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-md">
                                <CheckCircle2 className="w-3 h-3" />
                                En Stock
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Article Info */}
                        <div className="p-4 space-y-2">
                          <h3
                            className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug"
                            title={product.name}
                          >
                            {product.name}
                          </h3>

                          {/* Quantity Counter Box (POS Style) */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Disponible :
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`text-lg font-black ${
                                  isOutOfStock
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isLow
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {product.quantity}
                              </span>
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {product.unit}s
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                            <span>Seuil Alerte : {product.minimum_quantity} {product.unit}s</span>
                            <span>{formatCurrency(product.purchase_price)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions (POS Style) */}
                      <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                        {/* MAIN PROMINENT DISPATCH BUTTON ("CHKOUN TALBO / SORTIE") */}
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleOpenDispatchModal(product)}
                          className={`w-full py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                            isOutOfStock
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 active:scale-98'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Sortie / Déstocker (Donner)</span>
                        </button>

                        {/* Secondary Actions (Entrée + Modifier) */}
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenInflowModal(product)}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            title="Ajouter du stock reçu d'un fournisseur"
                          >
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>+ Entrée</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditProductModal(product)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Modifier les détails de l'article"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Supprimer cet article"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MOVEMENTS & DISPATCH HISTORY */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registre des Décharges &amp; Sorties de Matériel
                </h3>
                <p className="text-xs text-slate-500">
                  Traçabilité complète : demandeur (chkoun talbo), date, quantité remise et motif.
                </p>
              </div>

              <div className="text-xs font-bold text-slate-500">
                Total mouvements : <span className="text-slate-900 dark:text-white font-black">{movements.length}</span>
              </div>
            </div>

            <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="w-full">
                <table className="w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] sm:text-[11px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-slate-800 tracking-wider">
                    <tr>
                      <th className="w-[12%] px-3 py-3.5 truncate">RÉF. BON</th>
                      <th className="w-[14%] px-3 py-3.5 truncate">DATE &amp; HEURE</th>
                      <th className="w-[11%] px-2.5 py-3.5 truncate text-center">TYPE</th>
                      <th className="w-[19%] px-3 py-3.5 truncate">ARTICLE</th>
                      <th className="w-[9%] px-2.5 py-3.5 truncate text-center">QTÉ</th>
                      <th className="w-[17%] px-3 py-3.5 truncate text-blue-600 dark:text-blue-400 font-black">
                        DEMANDEUR (TALBO)
                      </th>
                      <th className="w-[11%] px-2.5 py-3.5 truncate">MOTIF</th>
                      <th className="w-[7%] px-2 py-3.5 truncate text-center">RESTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-semibold">
                          Aucun mouvement de stock enregistré pour le moment.
                        </td>
                      </tr>
                    ) : (
                      movements.map((mov) => {
                        const isOut = mov.movement_type === 'OUT';

                        return (
                          <tr key={mov.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-3.5 font-mono font-black text-xs text-slate-700 dark:text-slate-300 truncate" title={mov.voucher_number || `BS-${mov.id.slice(-4)}`}>
                              {mov.voucher_number || `BS-${mov.id.slice(-4)}`}
                            </td>
                            <td className="px-3 py-3.5 font-medium text-slate-600 dark:text-slate-300 text-xs truncate">
                              <span>{new Date(mov.created_at).toLocaleDateString('fr-FR')}</span>
                              <span className="text-[10px] text-slate-400 ml-1 font-mono">
                                {new Date(mov.created_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="px-2.5 py-3.5 text-center">
                              {isOut ? (
                                <span className="inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 truncate w-full">
                                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                                  <span>Sortie</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 truncate w-full">
                                  <ArrowDownLeft className="w-3 h-3 shrink-0" />
                                  <span>Entrée</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 font-bold text-xs text-slate-900 dark:text-white truncate" title={mov.product?.name || 'Article'}>
                              {mov.product?.name || 'Article'}
                            </td>
                            <td className="px-2.5 py-3.5 font-black text-xs sm:text-sm text-center truncate">
                              <span className={isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {isOut ? `-${mov.quantity}` : `+${mov.quantity}`}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 truncate" title={mov.requested_by || 'Non spécifié'}>
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs truncate max-w-full">
                                <UserCheck className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                                <span className="truncate">{mov.requested_by || 'Non spécifié'}</span>
                              </div>
                            </td>
                            <td className="px-2.5 py-3.5 text-xs text-slate-500 truncate" title={mov.reason || 'Besoins internes'}>
                              {mov.reason || 'Dotation'}
                            </td>
                            <td className="px-2 py-3.5 font-black text-xs text-slate-900 dark:text-white text-center truncate">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                                {mov.new_quantity}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL 1: SORTIE DE MATÉRIEL / DÉSTOCKAGE (CHKOUN TALBO) */}
        {/* ------------------------------------------------------------- */}
        {showDispatchModal && selectedProduct && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-[95vw] max-w-lg md:max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      Sortie &amp; Décharge de Matériel
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      Enregistrer qui demande cet article et déduire du stock
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDispatchModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Product Quick Banner */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={selectedProduct.name}>
                      {selectedProduct.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">Réf: {selectedProduct.sku}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-400 font-medium">En Stock :</div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {selectedProduct.quantity} {selectedProduct.unit}s
                  </div>
                </div>
              </div>

              {/* Dispatch Form */}
              <form onSubmit={handleConfirmDispatch} className="space-y-3.5 w-full">
                {/* 1. Demandeur (Chkoun Talbo) with Live Autocomplete Search */}
                <div className="relative w-full">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Demandeur / Bénéficiaire (Chkoun Talbo) * :</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 shrink-0 hidden sm:inline">Tapez un nom ou sélectionnez</span>
                  </label>

                  <div className="relative w-full">
                    <input
                      type="text"
                      required
                      placeholder="Tapez le nom de l'enseignant, personnel ou classe..."
                      value={dispatchForm.requested_by}
                      onFocus={() => setShowBeneficiaryDropdown(true)}
                      onChange={(e) => {
                        setDispatchForm({ ...dispatchForm, requested_by: e.target.value });
                        setShowBeneficiaryDropdown(true);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs truncate"
                    />

                    {dispatchForm.requested_by && (
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchForm({ ...dispatchForm, requested_by: '' });
                          setShowBeneficiaryDropdown(true);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* LIVE AUTOCOMPLETE DROPDOWN */}
                    {showBeneficiaryDropdown && matchedBeneficiaries.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Suggestions correspondantes ({matchedBeneficiaries.length})</span>
                          <span>Cliquer pour choisir</span>
                        </div>

                        {matchedBeneficiaries.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={() => {
                              setDispatchForm({
                                ...dispatchForm,
                                requested_by: item.name,
                                department: item.department || dispatchForm.department,
                              });
                              setShowBeneficiaryDropdown(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-500 group-hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0 transition-colors">
                                {item.category === 'ENSEIGNANT' ? '👨‍🏫' : item.category === 'ADMIN' ? '🏢' : item.category === 'SUPPORT' ? '🧹' : '📚'}
                              </div>
                              <div className="truncate flex-1">
                                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">{item.role}</div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60 group-hover:text-emerald-800 dark:group-hover:text-emerald-200 shrink-0">
                              {item.category}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Quantité demandée & Date */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Quantité ({selectedProduct.unit}s) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct.quantity}
                      required
                      value={dispatchForm.quantity}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: Number(e.target.value) })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs text-center"
                    />
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Date de Remise
                    </label>
                    <input
                      type="date"
                      required
                      value={dispatchForm.date}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, date: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                {/* 3. Motif & Remarques */}
                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Motif / Usage Prévu :
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Préparation examens, Cours de dessin, Nettoyage étage 2..."
                    value={dispatchForm.reason}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, reason: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-600/25 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valider la Sortie ({dispatchForm.quantity} {selectedProduct.unit}s)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL 2: ENTRÉE DE STOCK (+IN) */}
        {/* ------------------------------------------------------------- */}
        {showInflowModal && selectedProduct && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-[95vw] max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-blue-500/15 shrink-0">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      Entrée / Réapprovisionnement
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{selectedProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInflowModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmInflow} className="space-y-3.5 w-full">
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Quantité Reçue ({selectedProduct.unit}s) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inflowForm.quantity}
                    onChange={(e) => setInflowForm({ ...inflowForm, quantity: Number(e.target.value) })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs text-center"
                  />
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Fournisseur / Origine :
                  </label>
                  <input
                    type="text"
                    value={inflowForm.supplier}
                    onChange={(e) => setInflowForm({ ...inflowForm, supplier: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    placeholder="Ex: Librairie Atlas, CleanPro..."
                  />
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Date de Réception :
                  </label>
                  <input
                    type="date"
                    required
                    value={inflowForm.date}
                    onChange={(e) => setInflowForm({ ...inflowForm, date: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                  <button
                    type="button"
                    onClick={() => setShowInflowModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer shrink-0"
                  >
                    Ajouter au Stock (+{inflowForm.quantity})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL 3: CRÉER / MODIFIER ARTICLE */}
        {/* ------------------------------------------------------------- */}
        {showProductModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-[95vw] max-w-lg md:max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-amber-500 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {editingProduct ? 'Modifier l\'Article' : 'Nouveau Produit en Stock'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {editingProduct ? `Mise à jour de "${editingProduct.name}"` : 'Enregistrement dans le catalogue'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3.5 w-full">
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Désignation de l&apos;Article *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                    placeholder="Ex: Rames de Papier A4, Marqueurs, Vidéoprojecteur..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Catégorie *
                    </label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-xs truncate"
                    >
                      {PRESET_CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Référence / SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Quantité Initiale
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={productForm.quantity}
                      onChange={(e) => setProductForm({ ...productForm, quantity: Number(e.target.value) })}
                      className="w-full h-11 px-2.5 sm:px-3 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white shadow-xs"
                    />
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Seuil Alerte
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={productForm.minimum_quantity}
                      onChange={(e) =>
                        setProductForm({ ...productForm, minimum_quantity: Number(e.target.value) })
                      }
                      className="w-full h-11 px-2.5 sm:px-3 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white shadow-xs"
                    />
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Unité (U, Rame...)
                    </label>
                    <input
                      type="text"
                      required
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="w-full h-11 px-2.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white shadow-xs truncate"
                      placeholder="Rame, Boîte..."
                    />
                  </div>
                </div>

                <div className="w-full min-w-0 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    Image de l&apos;Article / Photo (URL ou Fichier) :
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                      placeholder="Coller l'URL de l'image (Ex: https://...)"
                    />
                    <label className="h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0">
                      <span>📁 Parcourir</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              if (typeof reader.result === 'string') {
                                setProductForm({ ...productForm, image_url: reader.result });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {productForm.image_url && (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs">
                      <img src={productForm.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, image_url: '' })}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full hover:bg-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                  >
                    {editingProduct ? 'Enregistrer les Modifications' : 'Créer l\'Article'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL 4: RAPPORT & BILAN GÉNÉRAL D'INVENTAIRE (1 PAGE COMPACT) */}
        {/* ------------------------------------------------------------- */}
        {showReportModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto print:hidden">
            <div className="w-[95vw] max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo GM" className="w-10 h-10 object-contain shrink-0 rounded-lg p-0.5 bg-white border border-slate-200 dark:border-slate-700 shadow-xs" />
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                      Rapport &amp; Bilan d&apos;Inventaire &amp; Décharges (1 Page)
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Format compact officiel &bull; Tableau récapitulatif &bull; Prêt pour impression A4 directe
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Ribbons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">Période :</span>
                  <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80 dark:bg-slate-700">
                    {(['MONTH', 'YEAR', 'ALL'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setReportPeriod(p)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          reportPeriod === p
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {p === 'MONTH' ? 'Ce Mois-ci' : p === 'YEAR' ? 'Année Scolaire' : 'Historique Complet'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">Vue :</span>
                  <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80 dark:bg-slate-700">
                    {(['FULL', 'INVENTORY', 'DISPATCHES'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setReportViewTab(t)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          reportViewTab === t
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {t === 'FULL' ? 'Bilan Complet' : t === 'INVENTORY' ? 'Inventaire' : 'Décharges'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INTEGRATED KPI SUMMARY TABLE */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-center text-xs table-fixed">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">📦 Total Articles</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">📊 Unités en Magasin</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">📤 Décharges Réalisées</th>
                      <th className="p-2">⚠️ Alertes &amp; Ruptures</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 font-black text-sm">
                    <tr>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400">
                        {stockStats.totalArticles} Références
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                        {stockStats.totalItemsCount.toLocaleString()} U
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400">
                        {movements.filter((m) => m.movement_type === 'OUT').length} Sorties
                      </td>
                      <td className="p-2 text-rose-600 dark:text-rose-400">
                        {stockStats.lowStockCount + stockStats.outOfStockCount} Alertes
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 1. TABLEAU 1: ÉTAT D'INVENTAIRE DU STOCK */}
              {(reportViewTab === 'FULL' || reportViewTab === 'INVENTORY') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-amber-500" />
                      <span>1. État Détaillé du Stock par Article</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">{products.length} articles</span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs table-fixed">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="w-[14%] p-2">Réf / SKU</th>
                          <th className="w-[34%] p-2">Désignation</th>
                          <th className="w-[18%] p-2">Catégorie</th>
                          <th className="w-[14%] p-2 text-center">Stock Dispo</th>
                          <th className="w-[10%] p-2 text-center">Seuil</th>
                          <th className="w-[10%] p-2 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {products.map((p) => {
                          const isOut = p.quantity === 0;
                          const isLow = p.quantity > 0 && p.quantity <= p.minimum_quantity;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-2 font-mono font-bold text-slate-500 text-[11px] truncate">{p.sku}</td>
                              <td className="p-2 font-bold text-slate-900 dark:text-white text-[11px] truncate">{p.name}</td>
                              <td className="p-2 text-slate-600 dark:text-slate-300 text-[11px] truncate">{p.category?.name || 'Général'}</td>
                              <td className="p-2 text-center font-black text-slate-900 dark:text-white text-xs">
                                {p.quantity} {p.unit}s
                              </td>
                              <td className="p-2 text-center text-slate-500 text-[11px]">{p.minimum_quantity}</td>
                              <td className="p-2 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    isOut
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                      : isLow
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  }`}
                                >
                                  {isOut ? 'Rupture' : isLow ? 'Faible' : 'OK'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. TABLEAU 2: REGISTRE DES DÉCHARGES & SORTIES */}
              {(reportViewTab === 'FULL' || reportViewTab === 'DISPATCHES') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-500" />
                      <span>2. Registre des Décharges &amp; Sorties de Matériel</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {movements.filter((m) => m.movement_type === 'OUT').length} décharges
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs table-fixed">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="w-[12%] p-2">N° Bon</th>
                          <th className="w-[14%] p-2">Date</th>
                          <th className="w-[24%] p-2">Demandeur (Chkoun Talbo)</th>
                          <th className="w-[26%] p-2">Article Remis</th>
                          <th className="w-[10%] p-2 text-center">Qté</th>
                          <th className="w-[14%] p-2">Motif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {movements.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-3 text-center text-slate-400 text-xs">
                              Aucune décharge enregistrée.
                            </td>
                          </tr>
                        ) : (
                          movements
                            .filter((m) => m.movement_type === 'OUT')
                            .map((mov) => (
                              <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-2 font-mono font-bold text-slate-500 text-[11px] truncate">
                                  {mov.voucher_number || `BS-${mov.id.slice(-4)}`}
                                </td>
                                <td className="p-2 text-slate-600 dark:text-slate-300 text-[11px] truncate">
                                  {new Date(mov.created_at).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="p-2 font-bold text-blue-600 dark:text-blue-400 text-[11px] truncate">
                                  {mov.requested_by || 'Personnel'}
                                </td>
                                <td className="p-2 font-bold text-slate-900 dark:text-white text-[11px] truncate">
                                  {mov.product?.name || 'Article'}
                                </td>
                                <td className="p-2 text-center font-black text-rose-600 dark:text-rose-400 text-xs truncate">
                                  -{mov.quantity} {mov.product?.unit || 'U'}
                                </td>
                                <td className="p-2 text-slate-500 text-[11px] truncate">{mov.reason || 'Dotation'}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Signatures Boxes Preview */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    Responsable Économat
                  </div>
                  <div className="h-8"></div>
                  <div className="text-[9px] text-slate-400">Signature &amp; Date</div>
                </div>

                <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    Bénéficiaires (Demandeurs)
                  </div>
                  <div className="h-8"></div>
                  <div className="text-[9px] text-slate-400">Émargement / Réception</div>
                </div>

                <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    Direction Générale
                  </div>
                  <div className="h-8"></div>
                  <div className="text-[9px] text-slate-400">Visa &amp; Cachet</div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 w-full flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Fermer
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Exporter Excel (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Exporter PDF (1 Page A4)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* OFFICIAL PRINT SHEET (BILAN D'INVENTAIRE ET DÉCHARGES PLEINE PAGE A4) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:flex print:flex-col print:justify-between print-stock-sheet text-black bg-white">
        {/* TOP SECTION: HEADER + TITLE + KPI */}
        <div className="space-y-3">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo GM"
                className="w-16 h-16 object-contain shrink-0"
                style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
              />
              <div>
                <h1 className="text-base font-black uppercase tracking-wider">
                  GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES
                </h1>
                <p className="text-[10pt] text-gray-800 font-bold">
                  Direction Logistique &bull; Service Économat &amp; Gestion des Stocks
                </p>
                <p className="text-[9pt] text-gray-600">
                  Royaume du Maroc &bull; Année Scolaire 2025-2026 &bull; Établissement Privé
                </p>
              </div>
            </div>
            <div className="text-right border-2 border-black px-3 py-2 rounded-lg bg-gray-50">
              <div className="font-black text-xs uppercase tracking-wide">BILAN OFFICIEL DU STOCK</div>
              <div className="text-[9pt] font-semibold text-gray-800">Date : {new Date().toLocaleDateString('fr-FR')}</div>
              <div className="text-[8pt] text-gray-600 font-mono">Réf : BILAN-STK-{new Date().getFullYear()}</div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="text-center py-1 bg-gray-100 border border-black rounded-lg">
            <h2 className="text-sm font-black uppercase tracking-wide">
              RAPPORT GÉNÉRAL D&apos;INVENTAIRE &amp; REGISTRE DES DÉCHARGES DE MATÉRIEL
            </h2>
          </div>

          {/* Integrated KPI Summary Table */}
          <table className="w-full border-collapse border-2 border-black text-center">
            <thead>
              <tr className="bg-gray-200 font-black text-[9.5pt]">
                <th className="border border-black p-2 w-1/4">📦 Articles Référencés</th>
                <th className="border border-black p-2 w-1/4">📊 Unités Totales en Magasin</th>
                <th className="border border-black p-2 w-1/4">📤 Décharges &amp; Sorties</th>
                <th className="border border-black p-2 w-1/4">⚠️ Alertes de Rupture</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-black text-[12pt] bg-white">
                <td className="border border-black p-2 text-blue-900">{stockStats.totalArticles} Articles</td>
                <td className="border border-black p-2 text-emerald-800">{stockStats.totalItemsCount.toLocaleString()} Unités</td>
                <td className="border border-black p-2 text-purple-900">{movements.filter((m) => m.movement_type === 'OUT').length} Décharges</td>
                <td className="border border-black p-2 text-rose-800">{stockStats.lowStockCount + stockStats.outOfStockCount} Alertes</td>
              </tr>
            </tbody>
          </table>

          {/* Section 1: Stock Inventory */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1.5">
              <h3 className="font-black text-[10pt] uppercase tracking-wide">
                1. Inventaire Physique Détaillé du Stock en Magasin
              </h3>
              <span className="text-[8.5pt] font-bold text-gray-600">{products.length} références actives</span>
            </div>
            <table className="w-full border-collapse border-2 border-black text-[9pt]">
              <thead>
                <tr className="bg-gray-100 font-black">
                  <th className="border border-black p-1.5 text-left w-[15%]">Réf / SKU</th>
                  <th className="border border-black p-1.5 text-left w-[36%]">Désignation de l&apos;Article</th>
                  <th className="border border-black p-1.5 text-left w-[20%]">Catégorie</th>
                  <th className="border border-black p-1.5 text-center w-[15%]">Stock Actuel</th>
                  <th className="border border-black p-1.5 text-center w-[14%]">État</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border border-black">
                    <td className="border border-black p-1.5 font-mono font-bold text-[8.5pt]">{p.sku}</td>
                    <td className="border border-black p-1.5 font-bold text-[9pt]">{p.name}</td>
                    <td className="border border-black p-1.5 text-[8.5pt]">{p.category?.name || 'Général'}</td>
                    <td className="border border-black p-1.5 text-center font-black text-[9.5pt]">
                      {p.quantity} {p.unit}s
                    </td>
                    <td className="border border-black p-1.5 text-center font-bold text-[8pt]">
                      {p.quantity === 0 ? 'RUPTURE' : p.quantity <= p.minimum_quantity ? 'STOCK FAIBLE' : 'DISPONIBLE'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: Dispatches */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1.5">
              <h3 className="font-black text-[10pt] uppercase tracking-wide">
                2. Registre des Décharges &amp; Sorties de Matériel
              </h3>
              <span className="text-[8.5pt] font-bold text-gray-600">
                {movements.filter((m) => m.movement_type === 'OUT').length} dotations enregistrées
              </span>
            </div>
            <table className="w-full border-collapse border-2 border-black text-[9pt]">
              <thead>
                <tr className="bg-gray-100 font-black">
                  <th className="border border-black p-1.5 text-left w-[13%]">N° Bon</th>
                  <th className="border border-black p-1.5 text-left w-[13%]">Date</th>
                  <th className="border border-black p-1.5 text-left w-[26%]">Bénéficiaire (Demandeur)</th>
                  <th className="border border-black p-1.5 text-left w-[26%]">Article Remis</th>
                  <th className="border border-black p-1.5 text-center w-[10%]">Qté</th>
                  <th className="border border-black p-1.5 text-left w-[12%]">Émargement</th>
                </tr>
              </thead>
              <tbody>
                {movements.filter((m) => m.movement_type === 'OUT').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-black p-3 text-center text-gray-500 font-medium">
                      Aucune sortie de matériel enregistrée pour cette période.
                    </td>
                  </tr>
                ) : (
                  movements
                    .filter((m) => m.movement_type === 'OUT')
                    .slice(0, 5)
                    .map((mov) => (
                      <tr key={mov.id}>
                        <td className="border border-black p-1.5 font-mono font-bold text-[8.5pt]">{mov.voucher_number || 'BS-001'}</td>
                        <td className="border border-black p-1.5 text-[8.5pt]">{new Date(mov.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="border border-black p-1.5 font-bold text-[9pt]">{mov.requested_by || 'Personnel'}</td>
                        <td className="border border-black p-1.5 font-bold text-[9pt]">{mov.product?.name}</td>
                        <td className="border border-black p-1.5 font-black text-center text-[9.5pt]">
                          -{mov.quantity} {mov.product?.unit || 'U'}
                        </td>
                        <td className="border border-black p-1.5"></td>
                      </tr>
                    ))
                )}
                {/* Visual empty rows to balance the layout if few movements */}
                {movements.filter((m) => m.movement_type === 'OUT').length < 3 && (
                  <>
                    <tr className="border border-black h-7 text-gray-300 text-center text-[8pt]">
                      <td className="border border-black p-1 font-mono">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1"></td>
                    </tr>
                    <tr className="border border-black h-7 text-gray-300 text-center text-[8pt]">
                      <td className="border border-black p-1 font-mono">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1">---</td>
                      <td className="border border-black p-1"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM SECTION: OFFICIAL SIGNATURES & LEGAL FOOTER */}
        <div className="pt-2">
          <div className="grid grid-cols-3 gap-4 text-[8.5pt] mb-2">
            <div className="border-2 border-black p-2.5 h-28 flex flex-col justify-between rounded-lg bg-gray-50/50">
              <span className="font-black uppercase">1. Visa Responsable Économat :</span>
              <span className="text-[8pt] text-gray-500">Date, Signature &amp; Visa</span>
            </div>
            <div className="border-2 border-black p-2.5 h-28 flex flex-col justify-between rounded-lg bg-gray-50/50">
              <span className="font-black uppercase">2. Émargement des Bénéficiaires :</span>
              <span className="text-[8pt] text-gray-500">Décharge &amp; Réception conforme</span>
            </div>
            <div className="border-2 border-black p-2.5 h-28 flex flex-col justify-between rounded-lg bg-gray-50/50">
              <span className="font-black uppercase">3. Approbation Direction Générale :</span>
              <span className="text-[8pt] text-gray-500">Cachet Rond &amp; Signature Officielle</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[7.5pt] text-gray-600 border-t border-black pt-1">
            <span>Groupe Scolaire des Générations Montantes &bull; Système de Gestion &amp; Traçabilité des Stocks</span>
            <span className="font-bold">Page 1 / 1 &bull; Document d&apos;inventaire faisant foi</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
