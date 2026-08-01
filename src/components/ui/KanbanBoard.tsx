/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drag-and-drop kanban board powered by @dnd-kit.
 * Used for the sales pipeline — drag deal cards between stages.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, DollarSign, User, Calendar } from 'lucide-react';

export interface KanbanCard {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  owner?: string;
  closeDate?: string;
  /** Arbitrary data passed back on move */
  meta?: Record<string, unknown>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  /** Total count / value header */
  count?: number;
  totalValue?: number;
  /** Column color accent */
  color?: string;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  /** Called when a card is dropped into a different column */
  onCardMove: (cardId: string, fromColumnId: string, toColumnId: string) => void | Promise<void>;
  /** Render a custom card (otherwise default card is used) */
  renderCard?: (card: KanbanCard) => React.ReactNode;
  /** Loading state */
  loading?: boolean;
}

function SortableCard({ card, renderFn }: { card: KanbanCard; renderFn?: (c: KanbanCard) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (renderFn) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {renderFn(card)}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-theme-card border border-theme-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-raised transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3 h-3 text-theme-secondary/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-theme-primary truncate">{card.title}</p>
          <div className="flex items-center gap-3 mt-1.5 text-2xs text-theme-secondary">
            {card.value !== undefined && (
              <span className="flex items-center gap-0.5 font-mono tabular-nums">
                <DollarSign className="w-2.5 h-2.5" />
                {card.value.toLocaleString()}
              </span>
            )}
            {card.owner && (
              <span className="flex items-center gap-0.5 truncate">
                <User className="w-2.5 h-2.5" />
                {card.owner}
              </span>
            )}
            {card.closeDate && (
              <span className="flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(card.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ columns, onCardMove, renderCard, loading }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columnMap = useMemo(() => {
    const map = new Map<string, KanbanColumn>();
    columns.forEach(c => map.set(c.id, c));
    return map;
  }, [columns]);

  const allCardIds = useMemo(() => columns.flatMap(c => c.cards.map(card => card.id)), [columns]);

  const getColumnForCard = useCallback((cardId: string): string | undefined => {
    for (const col of columns) {
      if (col.cards.some(c => c.id === cardId)) return col.id;
    }
    return undefined;
  }, [columns]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const cardId = String(event.active.id);
    for (const col of columns) {
      const card = col.cards.find(c => c.id === cardId);
      if (card) { setActiveCard(card); break; }
    }
  }, [columns]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const fromColId = getColumnForCard(cardId);
    if (!fromColId) return;

    // Find target column (over could be another card or a column droppable)
    let toColId = getColumnForCard(String(over.id));
    if (!toColId) {
      // over may be a column directly
      if (columnMap.has(String(over.id))) toColId = String(over.id);
    }
    if (!toColId || fromColId === toColId) return;

    setMovingCardId(cardId);
    try {
      await onCardMove(cardId, fromColId, toColId);
    } finally {
      setMovingCardId(null);
    }
  }, [getColumnForCard, columnMap, onCardMove]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto p-4">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-72 flex flex-col bg-theme-inset/50 rounded-xl border border-theme-border">
            {/* Column header */}
            <div
              className="px-3 py-2.5 border-b border-theme-border font-sans shrink-0"
              style={col.color ? { borderLeftColor: col.color, borderLeftWidth: 3 } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-theme-primary">{col.title}</span>
                <span className="text-2xs text-theme-secondary bg-theme-card border border-theme-border rounded-full px-1.5 py-0.5 tabular-nums">
                  {col.count ?? col.cards.length}
                </span>
              </div>
              {col.totalValue !== undefined && (
                <p className="text-2xs text-theme-secondary mt-0.5 font-mono tabular-nums">${col.totalValue.toLocaleString()}</p>
              )}
            </div>

            {/* Cards */}
            <SortableContext items={col.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                {col.cards.map(card => (
                  <SortableCard key={card.id} card={card} renderFn={renderCard} />
                ))}
                {col.cards.length === 0 && (
                  <div className="text-center py-8 text-2xs text-theme-secondary/60 font-sans">
                    No deals
                  </div>
                )}
                {movingCardId && col.cards.some(c => c.id === movingCardId) && (
                  <div className="text-center py-2 text-2xs text-theme-accent animate-pulse font-sans">
                    Moving…
                  </div>
                )}
              </div>
            </SortableContext>
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-center py-12 text-xs text-theme-secondary font-sans">
            Loading pipeline…
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCard && (
          <div className="opacity-90 rotate-2 scale-105">
            <div className="bg-theme-card border border-theme-accent rounded-lg p-3 shadow-overlay">
              <p className="text-xs font-medium text-theme-primary">{activeCard.title}</p>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
