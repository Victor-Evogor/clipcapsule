// ClipboardHistory.tsx
import { useEffect, useState, memo } from 'react';
import { GetHistory, UpdateHistory } from '../wailsjs/go/main/App';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Pre-rendered static SVG components with memoization
const ScrollBackground = memo(() => (
  <div className="absolute inset-0 bg-amber-50 opacity-90">
    {/* Simple texture pattern instead of complex SVG filter */}
    <div className="absolute inset-0 opacity-10" 
      style={{ 
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23805500\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'1\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")',
        backgroundSize: '20px 20px'
      }}
    />
    <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(120,80,40,0.2)]"></div>
  </div>
));

const InkwellIcon = memo(() => (
  <svg className="w-6 h-6 text-amber-900" viewBox="0 0 24 24">
    <path 
      d="M7,14 C5.8954305,14 5,13.1045695 5,12 C5,10.8954305 5.8954305,10 7,10 L17,10 C18.1045695,10 19,10.8954305 19,12 C19,13.1045695 18.1045695,14 17,14 L7,14 Z" 
      fill="currentColor"
    />
    <circle cx="12" cy="12" r="4" fill="#111" />
    <circle cx="12" cy="12" r="2" fill="#000" />
    <path 
      d="M8,8 C8,4.6862915 9.790861,2 12,2 C14.209139,2 16,4.6862915 16,8 L8,8 Z" 
      fill="#333"
    />
  </svg>
));

const QuillIcon = memo(() => (
  <svg className="w-5 h-5 text-amber-800" viewBox="0 0 24 24">
    <path 
      d="M5,19 L19,5 C20.1045695,5 21,5.8954305 21,7 L21,7 C21,8.1045695 20.1045695,9 19,9 L9,19 L5,19 Z" 
      fill="currentColor"
    />
    <path d="M9,19 L7,17 L17,7 L19,9 L9,19 Z" fill="#f0e6d2" />
    <path d="M5,19 L7,19 L8,18 L6,16 L5,17 L5,19 Z" fill="#5d5545" />
  </svg>
));

const DeleteIcon = memo(() => (
  <svg className="w-4 h-4 text-red-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
));

// Memoized sortable item component
const SortableItem = memo(({ id, onDelete }: { id: string, onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="relative mb-3 p-3 rounded bg-amber-50/80 border border-amber-700/30 cursor-grab shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-grow truncate pr-2">
          <QuillIcon />
          <div className="ml-2 font-serif text-amber-950 truncate">
            {id}
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
          title="Delete item"
        >
          <DeleteIcon />
        </button>
      </div>
      {/* Simplified decorative elements */}
      <div className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full bg-amber-800/20"></div>
    </div>
  );
});

// Main component with performance optimizations
export default function ClipboardHistory() {
  const [items, setItems] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5, // Small distance threshold to avoid accidental drags
    },
  }));

  const fetchHistory = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous requests
    
    setIsRefreshing(true);
    try {
      const history = await GetHistory();
      setItems(history);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      // Use requestAnimationFrame for smoother UI updates
      requestAnimationFrame(() => {
        setTimeout(() => setIsRefreshing(false), 300);
      });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;
    
    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      // Optimistic UI update, then sync with backend
      try {
        await UpdateHistory(newItems);
      } catch (error) {
        console.error("Failed to update history:", error);
        // Could revert items here on error
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    const newItems = items.filter(item => item !== id);
    setItems(newItems);
    
    try {
      await UpdateHistory(newItems);
    } catch (error) {
      console.error("Failed to delete item:", error);
      // Rollback on error
      await fetchHistory();
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Reset after 3 seconds
      return;
    }
    
    setIsClearing(true);
    try {
      await UpdateHistory([]);
      setItems([]);
      setConfirmClear(false);
    } catch (error) {
      console.error("Failed to clear all items:", error);
      await fetchHistory();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-amber-100 p-4 font-serif text-amber-950 overflow-hidden">
      <ScrollBackground />
      
      <div className="relative z-10 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-amber-950">
            ClipCapsule
          </h1>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={isRefreshing}
              className="flex items-center px-3 py-1 bg-amber-800/70 text-amber-50 rounded hover:bg-amber-800 transition-colors shadow-sm disabled:opacity-70"
            >
              <span>Refresh</span>
              {isRefreshing ? (
                <svg className="ml-2 w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="ml-2 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
            
            <button
              onClick={handleClearAll}
              disabled={isClearing || items.length === 0}
              className={`flex items-center px-3 py-1 rounded transition-colors shadow-sm disabled:opacity-70 ${
                confirmClear 
                  ? "bg-red-600 text-white hover:bg-red-700" 
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              {confirmClear ? "Confirm Clear" : "Clear All"}
            </button>
          </div>
        </div>
        
        <div className="mb-4 p-3 border border-amber-700/20 rounded bg-amber-50/50 shadow-sm">
          <div className="flex items-center mb-2">
            <InkwellIcon />
            <h2 className="ml-2 text-lg font-semibold">Clipboard History</h2>
          </div>
          <p className="text-sm text-amber-900/70">
            Use <span className="font-mono bg-amber-100 px-1 rounded text-xs">CTRL+SHIFT+[1-9]</span> to select an item
          </p>
        </div>

        <div className="relative" style={{ willChange: 'transform' }}>          
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {items.length > 0 ? (
                <div className="space-y-1">
                  {items.map((text) => (
                    <SortableItem 
                      key={text} 
                      id={text} 
                      onDelete={handleDeleteItem} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 italic text-amber-800/70 bg-amber-50/30 rounded border border-amber-700/10">
                  {isRefreshing ? "Loading..." : "No clipboard history found. Copy something to see it here."}
                </div>
              )}
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-4 p-2 border-t border-amber-700/20 text-center text-xs text-amber-900/60">
          <p>ClipCapsule &middot; A Vintage Clipboard Manager</p>
        </div>
      </div>
    </div>
  );
}