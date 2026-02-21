'use client';

import { motion } from 'framer-motion';
import { UserX } from 'lucide-react';

interface KickedFromGroupNotificationProps {
  groupName: string;
  onClose: () => void;
}

export default function KickedFromGroupNotification({ groupName, onClose }: KickedFromGroupNotificationProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Notification */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md glass rounded-2xl p-6 shadow-2xl text-center"
      >
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
          <UserX size={32} className="text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2">Вас исключили из группы</h2>

        {/* Message */}
        <p className="text-gray-300 mb-6">
          Вы больше не являетесь участником группы "{groupName}"
        </p>

        {/* Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="w-full px-4 py-3 gradient-bg rounded-lg font-medium"
        >
          Понятно
        </motion.button>
      </motion.div>
    </div>
  );
}
