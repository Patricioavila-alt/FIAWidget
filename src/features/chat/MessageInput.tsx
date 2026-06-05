import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgent } from '@/shared/hooks/useAgent';
import { useChatStore } from '@/shared/stores/chatStore';
import type { MessagePart } from '@/shared/types';
import './MessageInput.css';

const MAX_IMAGE_SIZE_MB = 4;

export const MessageInput: React.FC = () => {
  const { send, abort }    = useAgent();
  const { isAgentTyping }  = useChatStore();

  const [text,      setText]      = useState('');
  const [images,    setImages]    = useState<{ file: File; preview: string; base64: string; mimeType: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const newImages = await Promise.all(
      arr.slice(0, 3).map(async (file) => {
        if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return null;
        const base64  = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        return { file, preview, base64, mimeType: file.type };
      }),
    );
    setImages((prev) => [...prev, ...newImages.filter(Boolean)] as typeof images);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = useCallback(async () => {
    if ((!text.trim() && images.length === 0) || isAgentTyping) return;

    const parts: MessagePart[] = [
      ...images.map((img): MessagePart => ({
        type: 'image',
        mimeType: img.mimeType,
        data: img.base64,
        previewUrl: img.preview,
      })),
      ...(text.trim() ? [{ type: 'text' as const, text: text.trim() }] : []),
    ];

    setText('');
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await send(parts);
  }, [text, images, isAgentTyping, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = ()                      => setIsDragging(false);
  const handleDrop      = (e: React.DragEvent)   => {
    e.preventDefault();
    setIsDragging(false);
    void addImages(e.dataTransfer.files);
  };

  return (
    <div
      className={`message-input-wrap ${isDragging ? 'message-input-wrap--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Image previews */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            className="message-input__previews"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {images.map((img, i) => (
              <div key={i} className="message-input__preview">
                <img src={img.preview} alt={`Preview ${i + 1}`} />
                <button
                  className="message-input__preview-remove"
                  onClick={() => removeImage(i)}
                  aria-label="Quitar imagen"
                >
                  ✕
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="message-input glass">
        {/* Attach button */}
        <button
          id="attach-image-btn"
          className="message-input__action-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Adjuntar imagen"
          title="Adjuntar imagen"
          disabled={isAgentTyping}
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && void addImages(e.target.files)}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="message-input__textarea"
          placeholder="Escribe un mensaje… (Shift+Enter para nueva línea)"
          value={text}
          rows={1}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={isAgentTyping}
          aria-label="Campo de mensaje"
        />

        {/* Send / Stop */}
        {isAgentTyping ? (
          <button
            id="stop-agent-btn"
            className="message-input__send-btn message-input__send-btn--stop"
            onClick={abort}
            aria-label="Detener respuesta"
            title="Detener"
          >
            ⏹
          </button>
        ) : (
          <button
            id="send-message-btn"
            className="message-input__send-btn"
            onClick={() => void handleSend()}
            disabled={!text.trim() && images.length === 0}
            aria-label="Enviar mensaje"
            title="Enviar (Enter)"
          >
            ➤
          </button>
        )}
      </div>

      {isDragging && (
        <div className="message-input__drop-zone">
          <span>📷 Suelta aquí la imagen</span>
        </div>
      )}
    </div>
  );
};
