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
  onDeleteRoom?: (roomId: string, deleteForEveryone: boolean) => void;
}

export default function ChatWindow({ user, room, onRoomUpdated, onBack, onDeleteRoom }: ChatWindowProps) {
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
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
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
      const unsubMessages = subscribeToMessages();
      const unsubTyping = subscribeToTyping();
      markAsRead();
      clearOldTypingIndicators();

      return () => {
        unsubMessages?.();
        unsubTyping?.();
      };
    }
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
    if (messages.length > 0) {
      markAsRead();
    }
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
        async (payload: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.user_id)
            .single();

          const newMsg = { ...payload.new, profiles: profile } as Message;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
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
        (payload: any) => {
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
        (payload: any) => {
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
        async (payload: any) => {
          if (payload.new.user_id !== user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.user_id)
              .single();

            if (profile) {
              setTypingUsers((prev) => {
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
        (payload: any) => {
          const deletedUserId = payload.old.user_id;
          const deletedId = payload.old.id;
          
          setTypingUsers((prev) => {
            return prev.filter(t => {
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

    const now = new Date().toISOString();
    
    await supabase
      .from('room_members')
      .update({ last_read_at: now })
      .eq('room_id', room.id)
      .eq('user_id', user.id);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('room_id', room.id)
      .neq('user_id', user.id)
      .eq('is_read', false);
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

    if (!value.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (isTypingRef.current) {
        isTypingRef.current = false;
        supabase
          .from('typing_indicators')
          .delete()
          .eq('room_id', room.id)
          .eq('user_id', user.id)
          .then(() => {});
      }
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      
      supabase
        .from('typing_indicators')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .then(() => {
          return supabase
            .from('typing_indicators')
            .insert({
              room_id: room.id,
              user_id: user.id,
              started_at: new Date().toISOString(),
            });
        });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      supabase
        .from('typing_indicators')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .then(() => {});
    }, 2000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !room || !user || loading) return;

    const messageContent = newMessage.trim();
    const filesToUpload = [...selectedFiles];
    
    setNewMessage('');
    setSelectedFiles([]);
    setLoading(true);
    setUploadingFiles(true);

    try {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      supabase
        .from('typing_indicators')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .then(() => {});

      const attachments: MessageAttachment[] = [];
      
      if (filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('message-files')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Ошибка загрузки файла:', uploadError);
            continue;
          }

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

      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          content: messageContent || '',
          attachments: attachments.length > 0 ? attachments : undefined,
        });

      if (error) throw error;
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
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setShowDeleteModal(null);
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
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#09090b] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm px-6">
          <div className="w-20 h-20 mb-6 bg-zinc-800 border border-white/5 rounded-3xl flex items-center justify-center shadow-2xl rotate-3">
            <MessageSquare size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-100 mb-2">Добро пожаловать в Messenger</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">Выберите чат в меню слева или создайте новую группу, чтобы начать общение.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-[#09090b]">
      <div className="h-[72px] px-4 sm:px-6 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01] backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBack && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="md:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowInfoPanel(true)}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 bg-zinc-800 rounded-full overflow-hidden flex items-center justify-center">
                {room.type === 'direct' && room.partner_profile?.avatar_url ? (
                  <Image
                    src={room.partner_profile.avatar_url}
                    alt={room.partner_profile.username || 'Avatar'}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : room.avatar_url ? (
                  <Image
                    src={`${room.avatar_url}?t=${room.updated_at}`}
                    alt={room.name || 'Group'}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : room.type === 'group' ? (
                  <Users size={20} className="text-zinc-400" />
                ) : (
                  <MessageSquare size={20} className="text-zinc-400" />
                )}
              </div>
              {room.type === 'direct' && room.partner_profile && (
                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#09090b] status-${room.partner_profile.status || 'offline'}`} />
              )}
            </div>
            <div className="min-w-0 text-left">
              <h2 className="font-semibold text-sm text-zinc-100 truncate">
                {room.type === 'direct' && room.partner_profile
                  ? room.partner_profile.username || 'Пользователь'
                  : room.name || 'Личный чат'}
              </h2>
              <p className="text-xs text-emerald-400 truncate">
                {room.type === 'direct' && room.partner_profile
                  ? room.partner_profile.status === 'online'
                    ? 'В сети'
                    : `был(а) ${formatLastSeen(room.partner_profile.last_seen)}`
                  : room.type === 'group'
                  ? 'Группа'
                  : 'Личное сообщение'}
              </p>
            </div>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                className={`flex gap-3 ${isOwn ? 'ml-auto flex-row-reverse' : ''} group`}
              >
                {!isOwn && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-auto">
                    {sender?.avatar_url ? (
                      <Image
                        src={sender.avatar_url}
                        alt={sender.username || 'Avatar'}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                )}

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-[11px] text-zinc-500 mb-1 ml-1">
                      {sender?.username || 'Пользователь'}
                    </span>
                  )}
                  <div className="relative">
                    {isEditing ? (
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
                          className="px-4 py-2.5 bg-zinc-800 text-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-white/5"
                          autoFocus
                        />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleEditMessage}
                          className="p-2 text-green-400 hover:bg-white/5 rounded-lg"
                        >
                          <Check size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setEditingMessage(null)}
                          className="p-2 text-red-400 hover:bg-white/5 rounded-lg"
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    ) : (
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isOwn
                            ? 'bg-indigo-500 text-white rounded-br-sm shadow-md'
                            : 'bg-zinc-800 text-zinc-100 rounded-bl-sm border border-white/5 shadow-sm'
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
                        
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[10px] opacity-70">
                            {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {message.is_edited && (
                            <span className="text-[10px] opacity-60 italic">изменено</span>
                          )}
                          {isOwn && (
                            message.is_read ? (
                              <CheckCheck size={14} className={isOwn ? 'opacity-80 text-indigo-200' : 'opacity-80 text-blue-400'} />
                            ) : (
                              <Check size={14} className="opacity-70" />
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {!isEditing && (canEditMessage(message) || canDeleteMessage(message)) && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/5 rounded-lg`}
                        onClick={(e) => openContextMenu(e, message.id)}
                      >
                        <MoreVertical size={14} />
                      </motion.button>
                    )}
                  </div>
                  {isOwn && (
                    <span className="text-[10px] text-zinc-500 mt-1 mr-1">
                      {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-zinc-400"
          >
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200" />
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
              onClick={() => {
                setShowDeleteModal(contextMenu.messageId);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left hover:bg-white/5 transition flex items-center gap-2 text-red-400 whitespace-nowrap"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          )}
        </motion.div>
      )}

      <div className="p-4 bg-transparent">
        <div className="max-w-4xl mx-auto">
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <div className="bg-zinc-800 rounded-lg p-2 pr-8 flex items-center gap-2 border border-white/5">
                    {isImageFile(file.type) ? (
                      <ImageIcon size={16} className="text-indigo-400" />
                    ) : (
                      <File size={16} className="text-blue-400" />
                    )}
                    <div className="text-xs">
                      <p className="max-w-[150px] truncate text-zinc-200">{file.name}</p>
                      <p className="text-zinc-500">{formatFileSize(file.size)}</p>
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
          
          <form onSubmit={sendMessage} className="px-4 pb-4">
            <div className="bg-zinc-800/80 border border-white/10 rounded-2xl p-2 flex items-end gap-2 shadow-lg focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all max-w-full">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles || selectedFiles.length >= 5}
                className="p-2.5 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition flex-shrink-0 disabled:opacity-50"
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
                placeholder="Написать сообщение..."
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none outline-none py-2.5 px-2 min-w-0"
              />
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2.5 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition flex-shrink-0"
                title="Записать голосовое"
              >
                <Mic size={20} />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || loading}
                className="bg-indigo-500 hover:bg-indigo-600 text-white p-2.5 rounded-xl transition shadow-md flex-shrink-0 disabled:opacity-50"
              >
                {uploadingFiles ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={20} className="ml-0.5" />
                )}
              </motion.button>
            </div>
          </form>

          {isRecordingVoice && (
            <VoiceRecorder
              onSend={handleVoiceSend}
              onCancel={() => setIsRecordingVoice(false)}
            />
          )}
        </div>
      </div>

      {showInfoPanel && user && room && (
        <ChatInfoPanel
          room={room}
          currentUserId={user.id}
          onClose={() => setShowInfoPanel(false)}
          onRoomUpdated={onRoomUpdated}
          onDeleteRoom={(roomId, deleteForEveryone) => {
            if (onDeleteRoom) {
              onDeleteRoom(roomId, deleteForEveryone);
            }
          }}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Удалить сообщение?</h3>
            <p className="text-sm text-zinc-400 mb-6">Это действие нельзя отменить</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl transition"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeleteMessage(showDeleteModal)}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
