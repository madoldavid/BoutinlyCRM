import React, { useState, useRef, useCallback } from 'react';
import type { User } from '../../types';
import { Avatar } from './index';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  users: User[];
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function parseMentionQuery(text: string, cursorPos: number): { query: string; start: number; end: number } | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@([\w.]*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: match.index!, end: cursorPos };
}

function insertMention(text: string, cursorPos: number, start: number, name: string): string {
  const before = text.slice(0, start);
  const after = text.slice(cursorPos);
  return `${before}@${name} ${after}`;
}

export default function MentionInput({
  value,
  onChange,
  placeholder,
  users,
  className = '',
  onKeyDown,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState<{ query: string; start: number; end: number; top: number; left: number } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = showDropdown
    ? users.filter(u =>
        u.name.toLowerCase().includes(showDropdown.query) ||
        u.email.toLowerCase().includes(showDropdown.query)
      ).slice(0, 5)
    : [];

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    const cursor = e.target.selectionStart ?? 0;
    const mention = parseMentionQuery(newVal, cursor);
    if (mention) {
      setShowDropdown({ ...mention, top: 0, left: 0 });
      setSelectedIdx(0);
    } else {
      setShowDropdown(null);
    }
  }, [onChange]);

  const applyMention = useCallback((user: User) => {
    if (!showDropdown) return;
    const newVal = insertMention(value, showDropdown.end, showDropdown.start, user.name);
    onChange(newVal);
    setShowDropdown(null);
    inputRef.current?.focus();
  }, [value, showDropdown, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => (i + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(filteredUsers[selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(null);
        return;
      }
    }
    onKeyDown?.(e);
  }, [showDropdown, filteredUsers, selectedIdx, applyMention, onKeyDown]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-theme-card border border-theme-border rounded-lg shadow-overlay z-50 overflow-hidden animate-overlay-in">
          {filteredUsers.map((u, i) => (
            <button
              key={u.id}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs cursor-pointer transition-colors ${
                i === selectedIdx ? 'bg-theme-accent-soft text-theme-accent' : 'text-theme-primary hover:bg-theme-hover'
              }`}
              onMouseDown={(e) => { e.preventDefault(); applyMention(u); }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <Avatar name={u.name} src={u.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="font-medium truncate">{u.name}</p>
                <p className="text-2xs text-theme-secondary truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
