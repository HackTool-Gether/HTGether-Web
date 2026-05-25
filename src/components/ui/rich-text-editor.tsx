'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { common, createLowlight } from 'lowlight';
import { Extension } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  FileCode2,
  Image as ImageIcon,
  Type,
  Plus,
  GripVertical,
  Table as TableIcon,
  Sparkles,
  Wand2,
  Loader2,
  X,
} from 'lucide-react';
import { useAiGeneration } from '@/lib/use-ai-generation';

const lowlight = createLowlight(common);

// --- Slash command items ---
interface SlashItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Texte',
    description: 'Paragraphe simple',
    icon: <Type size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Titre 1',
    description: 'Grand titre de section',
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Titre 2',
    description: 'Titre moyen',
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Titre 3',
    description: 'Petit titre',
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Liste a puces',
    description: 'Liste non ordonnee',
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Liste numerotee',
    description: 'Liste ordonnee',
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'To-do list',
    description: 'Liste de taches avec cases a cocher',
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Citation',
    description: 'Bloc de citation',
    icon: <Quote size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    title: 'Code',
    description: 'Bloc de code avec coloration syntaxique',
    icon: <FileCode2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: 'Separateur',
    description: 'Ligne horizontale',
    icon: <Minus size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Image',
    description: 'Inserer une image via URL',
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      const url = window.prompt("URL de l'image");
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
  {
    title: 'Tableau',
    description: 'Inserer un tableau',
    icon: <TableIcon size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: 'IA - Reformuler',
    description: "Reformuler le bloc courant avec l'IA",
    icon: <Sparkles size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const { from } = editor.state.selection;
      const resolved = editor.state.doc.resolve(from);
      const blockStart = resolved.before(1);
      const blockNode = editor.state.doc.nodeAt(blockStart);
      if (!blockNode || !blockNode.textContent.trim()) return;
      const blockEnd = blockStart + blockNode.nodeSize;
      editor.chain().focus().setTextSelection({ from: blockStart, to: blockEnd }).run();
      const event = new CustomEvent('ai-trigger', { detail: { action: 'reformulate' } });
      editor.view.dom.dispatchEvent(event);
    },
  },
  {
    title: 'IA - Generer',
    description: "Generer du contenu avec l'IA",
    icon: <Wand2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const prompt = window.prompt('Que souhaitez-vous générer ?');
      if (!prompt?.trim()) return;
      const event = new CustomEvent('ai-trigger', { detail: { action: 'generate', prompt: prompt.trim() } });
      editor.view.dom.dispatchEvent(event);
    },
  },
];

// --- Slash command menu component ---
function SlashCommandMenu({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="slash-menu">
        <div className="px-3 py-2 text-sm text-muted-foreground">Aucun resultat</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" ref={containerRef}>
      {items.map((item, index) => (
        <button
          key={item.title}
          className={`slash-menu-item ${index === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => onSelect(index)}
        >
          <div className="slash-menu-icon">{item.icon}</div>
          <div className="slash-menu-text">
            <span className="slash-menu-title">{item.title}</span>
            <span className="slash-menu-desc">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// --- Slash command suggestion config ---
const slashSuggestionPluginKey = new PluginKey('slashCommand');

function createSlashExtension() {
  return Extension.create({
    name: 'slashCommand',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          pluginKey: slashSuggestionPluginKey,
          command: ({ editor, range, props }: any) => {
            props.command({ editor, range });
          },
          items: ({ query }: { query: string }) => {
            return SLASH_ITEMS.filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.description.toLowerCase().includes(query.toLowerCase()),
            );
          },
          render: () => ({
            onStart() {},
            onUpdate() {},
            onExit() {},
            onKeyDown() {
              return false;
            },
          }),
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}

// --- Block handle (Notion-style + and ⋮⋮) ---
function BlockHandle({ editor, onAddClick }: { editor: any; onAddClick: (pos: { top: number; left: number }) => void }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const hoveredNodePos = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editor) return;

    const editorEl = editor.view.dom as HTMLElement;

    const handleMouseMove = (e: MouseEvent) => {
      // Find the closest top-level block node from mouse position
      const editorRect = editorEl.getBoundingClientRect();

      // Only show when mouse is near the editor area
      if (
        e.clientX < editorRect.left - 60 ||
        e.clientX > editorRect.right + 20 ||
        e.clientY < editorRect.top ||
        e.clientY > editorRect.bottom
      ) {
        setVisible(false);
        return;
      }

      // Get the ProseMirror position from coordinates
      const pmPos = editor.view.posAtCoords({ left: editorRect.left + 1, top: e.clientY });
      if (!pmPos) {
        setVisible(false);
        return;
      }

      // Resolve to the top-level block node
      const resolved = editor.state.doc.resolve(pmPos.pos);
      const depth = resolved.depth;

      // Walk up to the top-level node (depth 1)
      let blockPos = pmPos.pos;
      if (depth > 0) {
        blockPos = resolved.before(1);
      }

      const node = editor.state.doc.nodeAt(blockPos);
      if (!node) {
        setVisible(false);
        return;
      }

      // Get the DOM node for this block
      const domNode = editor.view.nodeDOM(blockPos) as HTMLElement;
      if (!domNode || !(domNode instanceof HTMLElement)) {
        setVisible(false);
        return;
      }

      const blockRect = domNode.getBoundingClientRect();
      hoveredNodePos.current = blockPos;

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      setPos({
        top: blockRect.top,
        left: editorRect.left - 52,
      });
      setVisible(true);
    };

    const handleMouseLeave = () => {
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 300);
    };

    editorEl.addEventListener('mousemove', handleMouseMove);
    editorEl.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      editorEl.removeEventListener('mousemove', handleMouseMove);
      editorEl.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor]);

  // Keep handle visible when hovering the handle itself
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => setVisible(false), 300);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (hoveredNodePos.current === null) return;

    // Find the end of the current block
    const node = editor.state.doc.nodeAt(hoveredNodePos.current);
    if (!node) return;

    const insertPos = hoveredNodePos.current + node.nodeSize;

    // Insert a new empty paragraph after the current block and place cursor
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: 'paragraph' })
      .setTextSelection(insertPos + 1)
      .run();

    // Trigger slash menu by inserting "/"
    // Small delay to let the paragraph render
    setTimeout(() => {
      editor.chain().focus().insertContent('/').run();
    }, 20);
  };

  const handleGripClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (hoveredNodePos.current === null) return;

    const node = editor.state.doc.nodeAt(hoveredNodePos.current);
    if (!node) return;

    // Select the entire block
    editor
      .chain()
      .focus()
      .setTextSelection({
        from: hoveredNodePos.current,
        to: hoveredNodePos.current + node.nodeSize,
      })
      .run();
  };

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      className="block-handle"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 40,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.15s ease',
      }}
    >
      <button
        type="button"
        className="block-handle-btn"
        onClick={handleAdd}
        title="Ajouter un bloc"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        className="block-handle-btn block-handle-grip"
        onClick={handleGripClick}
        title="Cliquer pour selectionner le bloc"
      >
        <GripVertical size={14} />
      </button>
    </div>
  );
}

// --- Floating toolbar button ---
function FloatingButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep selection
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-foreground/10 text-foreground'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// --- Floating toolbar ---
function FloatingToolbar({ editor, onAiTrigger, aiGenerating }: { editor: any; onAiTrigger?: (action: string) => void; aiGenerating?: boolean }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateToolbar = () => {
      const { from, to, empty } = editor.state.selection;

      if (empty || from === to) {
        setShow(false);
        return;
      }

      // Don't show on code blocks
      if (editor.isActive('codeBlock')) {
        setShow(false);
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setShow(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0) {
        setShow(false);
        return;
      }

      const toolbarWidth = toolbarRef.current?.offsetWidth || 300;
      const left = Math.max(8, rect.left + rect.width / 2 - toolbarWidth / 2);
      const top = rect.top - 48;

      setPos({ top, left });
      setShow(true);
    };

    editor.on('selectionUpdate', updateToolbar);
    editor.on('blur', () => {
      // Delay to allow button clicks
      setTimeout(() => {
        if (!editor.isFocused) setShow(false);
      }, 200);
    });

    return () => {
      editor.off('selectionUpdate', updateToolbar);
    };
  }, [editor]);

  if (!editor) return null;

  const handleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL du lien', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const s = 15;

  return (
    <div
      ref={toolbarRef}
      className="bubble-menu"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        transition: 'opacity 0.15s ease',
      }}
    >
      <FloatingButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Gras"
      >
        <Bold size={s} />
      </FloatingButton>
      <FloatingButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italique"
      >
        <Italic size={s} />
      </FloatingButton>
      <FloatingButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Souligne"
      >
        <UnderlineIcon size={s} />
      </FloatingButton>
      <FloatingButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Barre"
      >
        <Strikethrough size={s} />
      </FloatingButton>
      <div className="bubble-sep" />
      <FloatingButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Code"
      >
        <Code size={s} />
      </FloatingButton>
      <FloatingButton onClick={handleLink} active={editor.isActive('link')} title="Lien">
        <LinkIcon size={s} />
      </FloatingButton>
      {onAiTrigger && (
        <>
          <div className="bubble-sep" />
          <FloatingButton
            onClick={() => onAiTrigger('reformulate')}
            title="Reformuler avec l'IA"
          >
            {aiGenerating ? <Loader2 size={s} className="animate-spin" /> : <Sparkles size={s} />}
          </FloatingButton>
        </>
      )}
    </div>
  );
}

// --- Helpers ---
function parseInitialContent(content: string, mode: 'html' | 'json') {
  if (!content) return '';
  if (mode === 'json') {
    try {
      const parsed = JSON.parse(content);
      // ProseMirror JSON doc has type === 'doc'
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
        return parsed;
      }
      return '';
    } catch {
      // Not valid JSON — treat as plain text/html (legacy markdown content)
      return content;
    }
  }
  return content;
}

// --- Image paste/drop helpers ---
function compressImage(dataUrl: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function insertImageFile(editor: any, file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const src = file.size > 500 * 1024 ? await compressImage(dataUrl) : dataUrl;
  editor.chain().focus().setImage({ src }).run();
}

function extractSelectionContent(editor: any): { text: string; images: string[] } {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, '\n');
  const images: string[] = [];
  editor.state.doc.nodesBetween(from, to, (node: any) => {
    if (node.type.name === 'image' && node.attrs.src) {
      images.push(node.attrs.src);
    }
  });
  return { text, images };
}

// --- Main editor ---
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  extraExtensions?: any[];
  extraSlashItems?: SlashItem[];
  storageMode?: 'html' | 'json';
  projectId?: string;
}

export const RichTextEditor = forwardRef<any, RichTextEditorProps>(
  function RichTextEditor(
    { content, onChange, placeholder, extraExtensions = [], extraSlashItems = [], storageMode = 'html', projectId },
    ref,
  ) {
    // AI generation
    const { generating: aiGenerating, generate: aiGenerate, cancel: aiCancel } = useAiGeneration();

    // Slash command state
    const [slashOpen, setSlashOpen] = useState(false);
    const [slashItems, setSlashItems] = useState<SlashItem[]>([]);
    const [slashIndex, setSlashIndex] = useState(0);
    const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
    const slashCommandRef = useRef<any>(null);

    const onSlashStart = useCallback((props: any) => {
      slashCommandRef.current = props;
      setSlashItems(props.items);
      setSlashIndex(0);
      setSlashOpen(true);

      const rect = props.clientRect?.();
      if (rect) {
        setSlashPos({ top: rect.bottom + 8, left: rect.left });
      }
    }, []);

    const onSlashUpdate = useCallback((props: any) => {
      slashCommandRef.current = props;
      setSlashItems(props.items);
      setSlashIndex(0);

      const rect = props.clientRect?.();
      if (rect) {
        setSlashPos({ top: rect.bottom + 8, left: rect.left });
      }
    }, []);

    const onSlashExit = useCallback(() => {
      setSlashOpen(false);
      slashCommandRef.current = null;
    }, []);

    // Keep a ref for the latest items/index so onKeyDown always has fresh values
    const slashItemsRef = useRef(slashItems);
    const slashIndexRef = useRef(slashIndex);
    slashItemsRef.current = slashItems;
    slashIndexRef.current = slashIndex;

    const onSlashKeyDown = useCallback(
      ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSlashIndex(
            (prev) =>
              (prev - 1 + slashItemsRef.current.length) % slashItemsRef.current.length,
          );
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSlashIndex((prev) => (prev + 1) % slashItemsRef.current.length);
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const item = slashItemsRef.current[slashIndexRef.current];
          if (item && slashCommandRef.current) {
            slashCommandRef.current.command(item);
          }
          return true;
        }
        if (event.key === 'Escape') {
          setSlashOpen(false);
          return true;
        }
        return false;
      },
      [],
    );

    // Create the slash extension with live callbacks via ref
    const callbacksRef = useRef({ onSlashStart, onSlashUpdate, onSlashExit, onSlashKeyDown });
    callbacksRef.current = { onSlashStart, onSlashUpdate, onSlashExit, onSlashKeyDown };

    // Keep extra slash items fresh inside the suggestion factory closure
    const extraSlashItemsRef = useRef(extraSlashItems);
    extraSlashItemsRef.current = extraSlashItems;

    const [slashExtension] = useState(() =>
      Extension.create({
        name: 'slashCommand',
        addOptions() {
          return {
            suggestion: {
              char: '/',
              pluginKey: slashSuggestionPluginKey,
              command: ({ editor, range, props }: any) => {
                props.command({ editor, range });
              },
              items: ({ query }: { query: string }) => {
                const all = [...SLASH_ITEMS, ...(extraSlashItemsRef.current || [])];
                return all.filter(
                  (item) =>
                    item.title.toLowerCase().includes(query.toLowerCase()) ||
                    item.description.toLowerCase().includes(query.toLowerCase()),
                );
              },
              render: () => ({
                onStart: (props: any) => callbacksRef.current.onSlashStart(props),
                onUpdate: (props: any) => callbacksRef.current.onSlashUpdate(props),
                onExit: () => callbacksRef.current.onSlashExit(),
                onKeyDown: (props: any) => callbacksRef.current.onSlashKeyDown(props),
              }),
            },
          };
        },
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              ...this.options.suggestion,
            }),
          ];
        },
      }),
    );

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: false,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'notion-link' },
        }),
        Underline,
        Image.configure({
          HTMLAttributes: { class: 'notion-image' },
        }),
        CodeBlockLowlight.configure({ lowlight }),
        TableKit.configure({
          table: {
            resizable: true,
            HTMLAttributes: { class: 'notion-table' },
          },
        }),
        TaskList.configure({
          HTMLAttributes: { class: 'notion-task-list' },
        }),
        TaskItem.configure({
          nested: true,
        }),
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') {
              return `Titre ${node.attrs.level}`;
            }
            return placeholder || "Tapez '/' pour les commandes...";
          },
        }),
        slashExtension,
        ...extraExtensions,
      ],
      content: parseInitialContent(content, storageMode),
      immediatelyRender: false,
      onUpdate: ({ editor: e }) => {
        onChange(storageMode === 'json' ? JSON.stringify(e.getJSON()) : e.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'notion-editor',
        },
        handlePaste: (_view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) insertImageFile(editor!, file);
              return true;
            }
          }
          return false;
        },
        handleDrop: (_view, event) => {
          const files = event.dataTransfer?.files;
          if (!files || files.length === 0) return false;
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              insertImageFile(editor!, file);
              return true;
            }
          }
          return false;
        },
      },
    });

    useImperativeHandle(ref, () => editor, [editor]);

    const handleAiTrigger = useCallback((action: string, promptOverride?: string) => {
      if (!editor || aiGenerating) return;

      let content: string;
      let images: string[] = [];

      if (promptOverride) {
        content = promptOverride;
      } else {
        const sel = extractSelectionContent(editor);
        content = sel.text;
        images = sel.images;
        if (!content && images.length === 0) return;
        const { from, to } = editor.state.selection;
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      aiGenerate({
        content,
        images: images.length > 0 ? images : undefined,
        projectId,
        action: action as 'reformulate' | 'generate' | 'complete',
        onChunk: (chunk) => {
          editor.commands.insertContent(chunk);
        },
        onDone: () => {},
        onError: (err) => {
          editor.commands.insertContent(`\n[Erreur IA : ${err}]`);
        },
      });
    }, [editor, aiGenerating, aiGenerate, projectId]);

    useEffect(() => {
      if (!editor) return;
      const dom = editor.view.dom;
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.action) handleAiTrigger(detail.action, detail.prompt);
      };
      dom.addEventListener('ai-trigger', handler);
      return () => dom.removeEventListener('ai-trigger', handler);
    }, [editor, handleAiTrigger]);

    useEffect(() => {
      if (!editor || !aiGenerating) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          aiCancel();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [editor, aiGenerating, aiCancel]);

    if (!editor) return null;

    return (
      <div className={`notion-editor-wrapper ${aiGenerating ? 'ai-generating' : ''}`}>
        {/* Block handle (+ and grip) */}
        <BlockHandle editor={editor} onAddClick={() => {}} />

        {/* Floating toolbar on text selection */}
        <FloatingToolbar editor={editor} onAiTrigger={handleAiTrigger} aiGenerating={aiGenerating} />

        {/* AI generating indicator */}
        {aiGenerating && (
          <div className="ai-indicator">
            <Loader2 size={14} className="animate-spin" />
            <span>Generation IA en cours...</span>
            <button type="button" onClick={aiCancel} className="ai-cancel-btn" title="Annuler (Echap)">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Slash command popup */}
        {slashOpen && slashPos && (
          <div
            style={{
              position: 'fixed',
              top: slashPos.top,
              left: slashPos.left,
              zIndex: 50,
            }}
          >
            <SlashCommandMenu
              items={slashItems}
              selectedIndex={slashIndex}
              onSelect={(index) => {
                const item = slashItems[index];
                if (item && slashCommandRef.current) {
                  slashCommandRef.current.command(item);
                }
              }}
            />
          </div>
        )}

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>
    );
  },
);
