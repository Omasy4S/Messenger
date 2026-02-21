'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, File, Download, Calendar, Mic } from 'lucide-react';
import { supabase, type Room, type Message, type MessageAttachment } from '@/lib/supabase';
import Image from 'next/image';

interface ChatMediaPanelProps {
  room: Room;
  onClose: () => void;
}

type MediaTab = 'photos' | 'files' | 'voice' | 'all';

export default function ChatMediaPanel({ room, onClose }: ChatMediaPanelProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('photos');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMediaMessages();
  }, [room.id]);

  const loadMediaMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      // Загружаем все сообщения из комнаты
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (*)
        `)
        .eq('room_id', room.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Фильтруем только сообщения с вложениями на клиенте
      const messagesWithAttachments = (data || []).filter(msg => 
        msg.attachments && 
        Array.isArray(msg.attachments) && 
        msg.attachments.length > 0
      );

      setMessages(messagesWithAttachments);
    } catch (err) {
      console.error('Ошибка загрузки медиа:', err);
      setError('Не удалось загрузить медиа');
      setMessages([]); // Устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageFile = (type: string) => {
    return type.startsWith('image/');
  };

  const isVoiceMessage = (type: string) => {
    return type === 'audio/webm' || type === 'audio/ogg' || type === 'audio/mpeg';
  };

  // Фильтруем сообщения по типу вложений
  const filteredMessages = messages.filter(msg => {
    if (!msg.attachments || msg.attachments.length === 0) return false;
    
    if (activeTab === 'all') return true;
    
    if (activeTab === 'photos') {
      return msg.attachments.some(att => isImageFile(att.type));
    }
    
    if (activeTab === 'voice') {
      return msg.attachments.some(att => isVoiceMessage(att.type));
    }
    
    if (activeTab === 'files') {
      return msg.attachments.some(att => !isImageFile(att.type) && !isVoiceMessage(att.type));
    }
    
    return false;
  });

  // Собираем все вложения из отфильтрованных сообщений
  const allAttachments: Array<{ attachment: MessageAttachment; message: Message }> = [];
  filteredMessages.forEach(msg => {
    msg.attachments?.forEach(att => {
      if (activeTab === 'photos' && !isImageFile(att.type)) return;
      if (activeTab === 'voice' && !isVoiceMessage(att.type)) return;
      if (activeTab === 'files' && (isImageFile(att.type) || isVoiceMessage(att.type))) return;
      allAttachments.push({ attachment: att, message: msg });
    });
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Затемнение фона */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Панель медиа */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl h-[80vh] glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
        >
          {/* Заголовок */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Медиа и файлы</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {room.type === 'direct' && room.partner_profile
                    ? room.partner_profile.username
                    : room.name || 'Чат'}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 glass-hover rounded-lg transition"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Табы */}
            <div className="flex gap-2 mt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('photos')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'photos'
                    ? 'gradient-bg'
                    : 'glass-hover'
                }`}
              >
                <ImageIcon size={16} className="inline mr-2" />
                Фото
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'files'
                    ? 'gradient-bg'
                    : 'glass-hover'
                }`}
              >
                <File size={16} className="inline mr-2" />
                Файлы
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('voice')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'voice'
                    ? 'gradient-bg'
                    : 'glass-hover'
                }`}
              >
                <Mic size={16} className="inline mr-2" />
                Голосовые
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'all'
                    ? 'gradient-bg'
                    : 'glass-hover'
                }`}
              >
                Все
              </motion.button>
            </div>
          </div>

          {/* Контент */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 glass rounded-full flex items-center justify-center mb-4">
                  <X size={40} className="text-red-400" />
                </div>
                <p className="text-gray-300 mb-2">Ошибка загрузки</p>
                <p className="text-sm text-gray-500 mb-4">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={loadMediaMessages}
                  className="px-4 py-2 gradient-bg rounded-lg"
                >
                  Попробовать снова
                </motion.button>
              </div>
            ) : allAttachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 glass rounded-full flex items-center justify-center mb-4">
                  {activeTab === 'photos' ? (
                    <ImageIcon size={40} className="text-gray-400" />
                  ) : (
                    <File size={40} className="text-gray-400" />
                  )}
                </div>
                <p className="text-gray-300 mb-2">
                  Нет {activeTab === 'photos' ? 'фотографий' : activeTab === 'voice' ? 'голосовых' : 'файлов'}
                </p>
                <p className="text-sm text-gray-500">
                  {activeTab === 'photos' 
                    ? 'Отправленные фото появятся здесь'
                    : activeTab === 'voice'
                    ? 'Отправленные голосовые появятся здесь'
                    : 'Отправленные файлы появятся здесь'}
                </p>
              </div>
            ) : activeTab === 'photos' ? (
              // Сетка фотографий
              <div className="grid grid-cols-3 gap-2">
                {allAttachments.map(({ attachment, message }, idx) => (
                  <motion.a
                    key={idx}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="aspect-square relative group overflow-hidden rounded-lg"
                  >
                    <Image
                      src={attachment.url}
                      alt={attachment.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-2">
                      <p className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(message.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </motion.a>
                ))}
              </div>
            ) : (
              // Список файлов
              <div className="space-y-2">
                {allAttachments.map(({ attachment, message }, idx) => (
                  <motion.a
                    key={idx}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-3 glass-hover rounded-lg hover:bg-white/5 transition group"
                  >
                    <div className="p-2 glass rounded-lg">
                      {isVoiceMessage(attachment.type) ? (
                        <Mic size={20} className="text-green-400" />
                      ) : isImageFile(attachment.type) ? (
                        <ImageIcon size={20} className="text-purple-400" />
                      ) : (
                        <File size={20} className="text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{attachment.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatFileSize(attachment.size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(message.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    <Download size={18} className="text-gray-400 group-hover:text-purple-400 transition" />
                  </motion.a>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
