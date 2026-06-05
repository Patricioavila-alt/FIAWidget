import React from 'react';
import './Avatar.css';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  isAgent?: boolean;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  src,
  isAgent = false,
}) => {
  return (
    <div className={`avatar avatar--${size} ${isAgent ? 'avatar--agent' : ''}`}>
      {src ? (
        <img src={src} alt={name} className="avatar__img" />
      ) : (
        <span className="avatar__initials">{isAgent ? '🤖' : getInitials(name)}</span>
      )}
    </div>
  );
};
