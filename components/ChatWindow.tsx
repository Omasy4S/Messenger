'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Users, MessageSquare, User, MoreVertical, Edit2, Trash2, X, Check, CheckCheck, Paperclip, Image as ImageIcon, File, Download, Mic, ArrowLeft } from 'lucide-react';
import { supabase, type Profile, type Room, type Message, type TypingIndicator, type MessageAttachment } from '@/lib/supabase';
import Image from 'next/image';
import ChatInfoPanel from './ChatInfoPanel';
import VoiceRecorder from './VoiceRecorder';
import VoiceMessage from './VoiceMessage';

interface ChatWindowProps {
  user: Profile | null;
  room: Room | null;
  onRoomUpdated?: (room: Room) => void;
  onBack?: () => void;
}

export default function ChatWindow({ user, room, onRoomUpdated, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return lastSeenDate.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  useEffect(() => {
    if (room) {
      loadMessages();
      subscribeToMessages();
      subscribeToTyping();
      markAsRead();
      clearOldTypingIndicators();
    }

    return () => {
      // Очистка подписок при размонтировании
      if (room) {
        supabase.channel(`room:${room.id}:messages`).unsubscribe();
        supabase.channel(`room:${room.id}:typing`).unsubscribe();
      }
    };
  }, [room?.id]);

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!room) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (*)
        `)
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error loading messages:', error);
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  // Подписка на новые сообщения в реальном времени
  const subscribeToMessages = () => {
    if (!room) return;

    const channel = supabase
      .channel(`room:${room.id}:messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          // Получаем профиль отправителя
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.user_id)
            .single();

          const newMsg = { ...payload.new, profiles: profile } as Message;
          setMessages((prev) => [...prev, newMsg]);
          markAsRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          // Обновляем сообщение в списке
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? { ...msg, ...payload.new }
                : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          // Удаляем сообщение из списка
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  // Подписка на индикатор печати
  const subscribeToTyping = () => {
    if (!room) return;

    const channel = supabase
      .channel(`room:${room.id}:typing`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          // Добавляем индикатор только для других пользователей
          if (payload.new.user_id !== user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.user_id)
              .single();

            if (profile) {
              setTypingUsers((prev) => {
                // Проверяем, нет ли уже этого пользователя
                const exists = prev.find(t => t.user_id === payload.new.user_id);
                if (exists) return prev;
                return [...prev, { ...payload.new, profiles: profile } as TypingIndicator];
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          // Удаляем индикатор для любого пользователя
          const deletedUserId = payload.old.user_id;
          const deletedId = payload.old.id;
          
          setTypingUsers((prev) => {
            return prev.filter(t => {
              // Фильтруем по user_id если он есть, иначе по id
              if (deletedUserId) {
                return t.user_id !== deletedUserId;
              } else if (deletedId) {
                return t.id !== deletedId;
              }
              return true;
            });
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const markAsRead = async () => {
    if (!room || !user) return;

    await supabase
      .from('room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', room.id)
      .eq('user_id', user.id);
  };

  const clearOldTypingIndicators = async () => {
    if (!room) return;

    // Удаляем все старые индикаторы печати (старше 5 секунд)
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    await supabase
      .from('typing_indicators')
      .delete()
      .eq('room_id', room.id)
      .lt('started_at', fiveSecondsAgo);
    
    // Также удаляем все индикаторы для текущего пользователя
    if (user) {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id);
    }
  };

  const handleTyping = async (value: string) => {
    if (!room || !user) return;

    // Если поле пустое, сразу удаляем индикатор
    if (!value.trim()) {
      // Очищаем все таймеры
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (isTypingRef.current) {
        isTypingRef.current = false;
        try {
          await supabase
            .from('typing_indicators')
            .delete()
            .eq('room_id', room.id)
            .eq('user_id', user.id);
        } catch (error) {
          // Игнорируем ошибки
        }
      }
      return;
    }

    // Если еще не печатаем, добавляем индикатор
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      
      try {
        // Удаляем старый индикатор (если есть)
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('room_id', room.id)
          .eq('user_id', user.id);

        // Добавляем новый
        await supabase
          .from('typing_indicators')
          .insert({
            room_id: room.id,
            user_id: user.id,
            started_at: new Date().toISOString(),
          });
      } catch (error) {
        // Игнорируем ошибки
      }
    }

    // Обновляем таймаут удаления
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Удаляем индикатор через 2 секунды бездействия
    typingTimeoutRef.current = setTimeout(async () => {
      isTypingRef.current = false;
      try {
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('room_id', room.id)
          .eq('user_id', user.id);
      } catch (error) {
        // Игнорируем ошибки
      }
    }, 2000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !room || !user || loading) return;

    setLoading(true);
    setUploadingFiles(true);

    try {
      // Удаляем индикатор печати
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id);

      // Загружаем файлы, если есть
      const attachments: MessageAttachment[] = [];
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-files')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Ошибка загрузки файла:', uploadError);
            continue;
          }

          // Получаем публичный URL
          const { data: { publicUrl } } = supabase.storage
            .from('message-files')
            .getPublicUrl(fileName);

          attachments.push({
            name: file.name,
            url: publicUrl,
            type: file.type,
            size: file.size,
          });
        }
      }

      // Отправляем сообщение
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          content: newMessage.trim() || '',
          attachments: attachments.length > 0 ? attachments : undefined,
        });

      if (error) throw error;

      // Обновляем время последнего обновления комнаты
      await supabase
        .from('rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', room.id);

      setNewMessage('');
      setSelectedFiles([]);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editingMessage.content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: editingMessage.content.trim(),
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMessage.id);

      if (error) throw error;

      // Обновляем локальное состояние
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessage.id
            ? { ...msg, content: editingMessage.content.trim(), is_edited: true }
            : msg
        )
      );

      setEditingMessage(null);
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Удалить это сообщение?')) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      // Удаляем из локального состояния
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setContextMenu(null);
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
    }
  };

  const openContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      messageId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const canEditMessage = (message: Message) => {
    return message.user_id === user?.id;
  };

  const canDeleteMessage = (message: Message) => {
    // Пользователь может удалить свое сообщение
    if (message.user_id === user?.id) return true;
    // Админ группы может удалить любое сообщение
    if (room?.type === 'group' && room.created_by === user?.id) return true;
    return false;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Ограничение: максимум 5 файлов за раз
      const limitedFiles = files.slice(0, 5);
      setSelectedFiles(prev => [...prev, ...limitedFiles].slice(0, 5));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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

  const handleVoiceSend = async (audioBlob: Blob, duration: number) => {
    if (!room || !user) return;

    setUploadingFiles(true);

    try {
      // Загружаем голосовое сообщение
      const fileName = `${user.id}/${Date.now()}-voice.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, audioBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'audio/webm',
        });

      if (uploadError) {
        console.error('Ошибка загрузки голосового:', uploadError);
        alert('Не удалось загрузить голосовое сообщение');
        setIsRecordingVoice(false);
        return;
      }

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);

      const attachment: MessageAttachment = {
        name: 'Голосовое сообщение',
        url: publicUrl,
        type: 'audio/webm',
        size: audioBlob.size,
        duration: duration,
      };

      // Отправляем сообщение
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          content: '',
          attachments: [attachment],
        });

      if (error) throw error;

      // Обновляем время последнего обновления комнаты
      await supabase
        .from('rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', room.id);

      setIsRecordingVoice(false);
    } catch (error) {
      console.error('Ошибка отправки голосового:', error);
      alert('Не удалось отправить голосовое сообщение');
    } finally {
      setUploadingFiles(false);
    }
  };

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 glass rounded-full flex items-center justify-center">
            <Users size={40} className="text-gray-400" />
          </div>
          <p className="text-xl text-gray-300 mb-2">Выбери чат</p>
          <p className="text-sm text-gray-500">Начни общение с командой</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Шапка чата */}
      <div className="p-4 glass border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Кнопка "Назад" для мобильных */}
          {onBack && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="md:hidden p-2 glass-hover rounded-lg"
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowInfoPanel(true)}
            className="flex-1 flex items-center gap-3 text-left transition"
          >
          <div className="relative">
            <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
              {room.type === 'direct' && room.partner_profile?.avatar_url ? (
                <Image
                  src={room.partner_profile.avatar_url}
                  alt={room.partner_profile.username || 'Avatar'}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : room.avatar_url ? (
                <Image
                  src={`${room.avatar_url}?t=${room.updated_at}`}
                  alt={room.name || 'Group'}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : room.type === 'group' ? (
                <Users size={24} />
              ) : (
                <MessageSquare size={24} />
              )}
            </div>
            {/* Индикатор онлайн для личных чатов */}
            {room.type === 'direct' && room.partner_profile && (
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f] status-${room.partner_profile.status || 'offline'}`} />
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">
              {room.type === 'direct' && room.partner_profile
                ? room.partner_profile.username || 'Пользователь'
                : room.name || 'Личный чат'}
            </h2>
            <p className="text-xs text-gray-400">
              {room.type === 'direct' && room.partner_profile
                ? room.partner_profile.status === 'online'
                  ? 'в сети'
                  : `был(а) ${formatLastSeen(room.partner_profile.last_seen)}`
                : room.type === 'group'
                ? 'Группа'
                : 'Личное сообщение'}
            </p>
          </div>
        </motion.button>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => {
            const isOwn = message.user_id === user?.id;
            const sender = message.profiles;
            const isEditing = editingMessage?.id === message.id;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}
              >
                {/* Аватарка отправителя */}
                {!isOwn && (
                  <div className="w-8 h-8 gradient-bg rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {sender?.avatar_url ? (
                      <Image
                        src={sender.avatar_url}
                        alt={sender.username || 'Avatar'}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                )}

                {/* Сообщение */}
                <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isOwn && (
                    <span className="text-xs text-gray-400 mb-1 px-2">
                      {sender?.username || 'Пользователь'}
                    </span>
                  )}
                  <div className="relative">
                    {isEditing ? (
                      // Режим редактирования
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingMessage.content}
                          onChange={(e) =>
                            setEditingMessage({ ...editingMessage, content: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditMessage();
                            if (e.key === 'Escape') setEditingMessage(null);
                          }}
                          className="px-4 py-2 glass rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                          autoFocus
                        />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleEditMessage}
                          className="p-2 glass-hover rounded-lg text-green-400"
                        >
                          <Check size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setEditingMessage(null)}
                          className="p-2 glass-hover rounded-lg text-red-400"
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    ) : (
                      // Обычное отображение
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'gradient-bg rounded-br-sm'
                            : 'glass rounded-bl-sm bg-white/10'
                        }`}
                      >
                        {/* Вложения */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mb-2 space-y-2">
                            {message.attachments.map((attachment, idx) => (
                              <div key={idx}>
                                {isVoiceMessage(attachment.type) ? (
                                  // Голосовое сообщение
                                  <VoiceMessage
                                    url={attachment.url}
                                    duration={attachment.duration || 0}
                                    isOwn={isOwn}
                                  />
                                ) : isImageFile(attachment.type) ? (
                                  // Превью изображения
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <Image
                                      src={attachment.url}
                                      alt={attachment.name}
                                      width={300}
                                      height={200}
                                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition"
                                      unoptimized
                                    />
                                  </a>
                                ) : (
                                  // Файл
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 glass-hover rounded-lg hover:bg-white/5 transition"
                                  >
                                    <File size={20} className="flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">{attachment.name}</p>
                                      <p className="text-xs opacity-60">{formatFileSize(attachment.size)}</p>
                                    </div>
                                    <Download size={16} className="flex-shrink-0 opacity-60" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Текст сообщения */}
                        {message.content && <p className="break-words">{message.content}</p>}
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-xs opacity-70">
                            {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {message.is_edited && (
                            <span className="text-xs opacity-60 italic">изменено</span>
                          )}
                          {/* Галочки прочитанности (только для своих сообщений) */}
                          {isOwn && (
                            message.is_read ? (
                              <CheckCheck size={16} className="opacity-80 text-blue-400" />
                            ) : (
                              <Check size={16} className="opacity-70" />
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Кнопка меню (показывается при наведении) */}
                    {!isEditing && (canEditMessage(message) || canDeleteMessage(message)) && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 glass-hover rounded-lg`}
                        onClick={(e) => openContextMenu(e, message.id)}
                      >
                        <MoreVertical size={14} />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Индикатор печати */}
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-gray-400"
          >
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
            </div>
            <span>
              {typingUsers[0].profiles?.username || 'Кто-то'} печатает...
            </span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Контекстное меню */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-50 glass rounded-lg shadow-xl overflow-hidden border border-white/10 min-w-[160px]"
          style={{
            left: contextMenu.x + 160 > window.innerWidth ? contextMenu.x - 160 : contextMenu.x,
            top: contextMenu.y + 100 > window.innerHeight ? contextMenu.y - 100 : contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {canEditMessage(messages.find((m) => m.id === contextMenu.messageId)!) && (
            <button
              onClick={() => {
                const message = messages.find((m) => m.id === contextMenu.messageId);
                if (message) {
                  setEditingMessage({ id: message.id, content: message.content });
                  setContextMenu(null);
                }
              }}
              className="w-full px-4 py-2 text-left hover:bg-white/5 transition flex items-center gap-2 whitespace-nowrap"
            >
              <Edit2 size={14} />
              Редактировать
            </button>
          )}
          {canDeleteMessage(messages.find((m) => m.id === contextMenu.messageId)!) && (
            <button
              onClick={() => handleDeleteMessage(contextMenu.messageId)}
              className="w-full px-4 py-2 text-left hover:bg-white/5 transition flex items-center gap-2 text-red-400 whitespace-nowrap"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          )}
        </motion.div>
      )}

      {/* Форма отправки */}
      {isRecordingVoice ? (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setIsRecordingVoice(false)}
        />
      ) : (
        <div className="p-4 glass border-t border-white/10">
          {/* Превью выбранных файлов */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <div className="glass rounded-lg p-2 pr-8 flex items-center gap-2">
                    {isImageFile(file.type) ? (
                      <ImageIcon size={16} className="text-purple-400" />
                    ) : (
                      <File size={16} className="text-blue-400" />
                    )}
                    <div className="text-xs">
                      <p className="max-w-[150px] truncate">{file.name}</p>
                      <p className="text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full"
                  >
                    <X size={12} />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
          
          <form onSubmit={sendMessage} className="flex gap-2">
            {/* Скрытый input для файлов */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {/* Кнопка прикрепления файлов */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles || selectedFiles.length >= 5}
              className="p-3 glass-hover rounded-lg transition disabled:opacity-50"
              title="Прикрепить файл"
            >
              <Paperclip size={20} />
            </motion.button>
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping(e.target.value);
              }}
              placeholder="Напиши сообщение..."
              className="flex-1 px-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
            
            {/* Кнопка голосового сообщения */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="p-3 glass-hover rounded-lg transition"
              title="Записать голосовое"
            >
              <Mic size={20} />
            </motion.button>
            
            {/* Кнопка отправки */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={(!newMessage.trim() && selectedFiles.length === 0) || loading}
              className="px-6 py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {uploadingFiles ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </motion.button>
          </form>
        </div>
      )}

      {/* Панель информации о чате */}
      {showInfoPanel && user && room && (
        <ChatInfoPanel
          room={room}
          currentUserId={user.id}
          onClose={() => setShowInfoPanel(false)}
          onRoomUpdated={onRoomUpdated}
        />
      )}
    </div>
  );
}
