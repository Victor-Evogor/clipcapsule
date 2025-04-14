// ClipboardHistory.tsx
import { useEffect, useState } from 'react';
import { GetHistory, UpdateHistory } from '../wailsjs/go/main/App';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: '8px',
    border: '1px solid gray',
    marginBottom: '4px',
    background: '#f9f9f9',
    borderRadius: '4px'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {id}
    </div>
  );
}

export default function ClipboardHistory() {
  const [items, setItems] = useState<string[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));

  const fetchHistory = async () => {
    const history = await GetHistory();
    setItems(history);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      await UpdateHistory(newItems);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-2">Clipboard History</h2>
      <button
        onClick={fetchHistory}
        className="mb-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Refresh
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((text) => (
            <SortableItem key={text} id={text} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
