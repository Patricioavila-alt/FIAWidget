import React from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { motion } from 'framer-motion';
import './MessageRenderer.css';

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  isStreaming = false,
}) => {
  // Check if content contains HTML tags
  const hasHtml = /<[a-z][\s\S]*>/i.test(content);

  if (hasHtml) {
    const clean = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p','br','strong','em','b','i','u','s','del','ins',
        'h1','h2','h3','h4','h5','h6',
        'ul','ol','li','blockquote','code','pre',
        'a','span','div','table','thead','tbody','tr','th','td',
        'hr','img',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
    });
    return (
      <motion.div
        className="markdown-content message-renderer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return (
    <motion.div
      className="markdown-content message-renderer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {isStreaming && <span className="cursor-blink">▌</span>}
    </motion.div>
  );
};
