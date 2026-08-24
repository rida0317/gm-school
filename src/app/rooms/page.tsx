'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  DoorClosed,
  Plus,
  Monitor,
  FlaskConical,
  Dumbbell,
  Trash2,
  Edit2,
  X,
  Sparkles
} from 'lucide-react';

export default function RoomsPage() {
  const { t, dir } = useI18n();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    room_number: '',
    name: '',
    capacity: 32,
    type: 'Classroom',
  });

  const confirm = useConfirm();
  const notify = useNotify();

  async function loadRooms() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('rooms').select('*').order('room_number');
      if (data) setRooms(data);
      if (error) console.error(error);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ room_number: '', name: '', capacity: 32, type: 'Classroom' });
    setShowModal(true);
  };

  const openEditModal = (room: Room) => {
    setEditingId(room.id);
    setFormData({
      room_number: room.room_number,
      name: room.name,
      capacity: room.capacity,
      type: room.type || 'Classroom',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('rooms')
          .update({
            room_number: formData.room_number,
            name: formData.name,
            capacity: Number(formData.capacity),
            type: formData.type,
          })
          .eq('id', editingId);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'ROOM_UPDATED',
          entity_type: 'rooms',
          entity_id: editingId,
          details: {
            room_number: formData.room_number,
            name: formData.name,
            capacity: formData.capacity,
          },
        });

        notify({ title: 'Succès', message: 'Salle modifiée avec succès !', type: 'success' });
      } else {
        // Create new
        const { error } = await supabase.from('rooms').insert([formData]);
        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'ROOM_CREATED',
          entity_type: 'rooms',
          details: {
            room_number: formData.room_number,
            name: formData.name,
            capacity: formData.capacity,
          },
        });

        notify({ title: 'Succès', message: 'Salle créée avec succès !', type: 'success' });
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ room_number: '', name: '', capacity: 32, type: 'Classroom' });
      loadRooms();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer la salle',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer la salle "${name}" ? Cette action est irréversible.`
        : 'Êtes-vous sûr de vouloir supprimer cette salle ?',
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;

      logAuditEvent({
        action: 'ROOM_DELETED',
        entity_type: 'rooms',
        entity_id: id,
        details: { name: name || id },
      });

      notify({ title: 'Supprimée', message: 'La salle a été supprimée.', type: 'success' });
      loadRooms();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'Laboratory':
        return FlaskConical;
      case 'Computer Room':
        return Monitor;
      case 'Sports Room':
        return Dumbbell;
      default:
        return DoorClosed;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <DoorClosed className="w-4 h-4" />
              {t('rooms')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('rooms_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'تدبير القاعات الدراسية، المختبرات العلمية وقاعات الإعلاميات.' : "Gérez les divisions, salles de cours et laboratoires de l'établissement."}
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition-all hover:scale-105 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('add_room')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => {
            const Icon = getRoomIcon(room.type);
            return (
              <div
                key={room.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-2xl bg-sky-500/10 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300/40 shadow-sm">
                      {room.room_number}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{room.name}</h3>

                  <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>{dir === 'rtl' ? 'نوع القاعة :' : "Type d'espace :"}</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {dir === 'rtl'
                          ? room.type === 'Classroom'
                            ? 'قاعة دراسية'
                            : room.type === 'Laboratory'
                            ? 'مختبر علمي'
                            : room.type === 'Computer Room'
                            ? 'قاعة المعلوميات'
                            : room.type === 'Sports Room'
                            ? 'فضاء رياضي'
                            : 'قاعة اجتماعات'
                          : room.type}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{dir === 'rtl' ? 'الطاقة الاستيعابية :' : 'Capacité maximale :'}</span>
                      <strong className="text-slate-800 dark:text-slate-200">{room.capacity} {dir === 'rtl' ? 'مقعد' : 'Places'}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">{t('actions')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(room)}
                      title={dir === 'rtl' ? 'تعديل القاعة' : 'Modifier la salle'}
                      className="p-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-white rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, room.name)}
                      title={dir === 'rtl' ? 'حذف القاعة' : 'Supprimer la salle'}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Add/Edit Room */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-sky-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                    <DoorClosed className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId
                      ? dir === 'rtl' ? 'تعديل بيانات القاعة' : 'Modifier la Salle'
                      : dir === 'rtl' ? 'إضافة قاعة جديدة' : 'Ajouter une Nouvelle Salle'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'رمز / رقم القاعة (مثال: R101, LAB-1)' : 'Numéro / Code (ex: R101, LAB-1)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'اسم القاعة الوصفي' : 'Nom Descriptif'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'نوع القاعة' : 'Type'}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="Classroom">{dir === 'rtl' ? 'قاعة دراسية' : 'Salle de Cours'}</option>
                      <option value="Laboratory">{dir === 'rtl' ? 'مختبر علمي' : 'Laboratoire'}</option>
                      <option value="Computer Room">{dir === 'rtl' ? 'قاعة المعلوميات' : 'Informatique'}</option>
                      <option value="Sports Room">{dir === 'rtl' ? 'فضاء رياضي' : 'Sport'}</option>
                      <option value="Meeting Room">{dir === 'rtl' ? 'قاعة اجتماعات' : 'Réunion'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'الطاقة الاستيعابية' : 'Capacité'}
                    </label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
                  >
                    {editingId
                      ? dir === 'rtl' ? 'حفظ التعديلات' : 'Enregistrer les Modifications'
                      : dir === 'rtl' ? 'إنشاء القاعة' : 'Créer la Salle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
