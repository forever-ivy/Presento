"use client";

import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  BookmarkPlus,
  Clock3,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  forwardRef,
  type FormEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { cn } from "@/components/presento-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type RichScriptEditorHandle = {
  appendContent: (html: string) => void;
  getHTML: () => string;
  insertAnswerCard: () => void;
  insertPause: () => void;
  insertTeacherQuestion: () => void;
  replaceContent: (html: string) => void;
};

type RichScriptEditorProps = {
  className?: string;
  initialContent: string;
  minHeight?: number;
  placeholder?: string;
  showFooterMeta?: boolean;
  showScriptTools?: boolean;
  statusLabel?: string;
  title?: string;
  variant?: "script" | "answer" | "review";
};

const toolbarGroups = [
  [
    { label: "段落", type: "paragraph" as const },
    { icon: Heading1, label: "H1", type: "h1" as const },
    { icon: Heading2, label: "H2", type: "h2" as const },
    { icon: Heading3, label: "H3", type: "h3" as const },
  ],
  [
    { icon: Bold, label: "加粗", type: "bold" as const },
    { icon: Italic, label: "斜体", type: "italic" as const },
  ],
  [
    { icon: List, label: "无序列表", type: "bulletList" as const },
    { icon: ListOrdered, label: "有序列表", type: "orderedList" as const },
  ],
  [
    { icon: Quote, label: "引用", type: "blockquote" as const },
    { icon: Code2, label: "代码", type: "codeBlock" as const },
    { icon: Link2, label: "链接", type: "link" as const },
  ],
  [
    { icon: Undo2, label: "撤销", type: "undo" as const },
    { icon: Redo2, label: "重做", type: "redo" as const },
  ],
] as const;

function formatSavedTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function runToolbarCommand(
  editor: Editor,
  type: (typeof toolbarGroups)[number][number]["type"],
  openLinkDialog?: () => void,
) {
  if (type === "link") {
    openLinkDialog?.();
    return;
  }

  const chain = editor.chain().focus();

  if (type === "paragraph") chain.setParagraph().run();
  if (type === "h1") chain.toggleHeading({ level: 1 }).run();
  if (type === "h2") chain.toggleHeading({ level: 2 }).run();
  if (type === "h3") chain.toggleHeading({ level: 3 }).run();
  if (type === "bold") chain.toggleBold().run();
  if (type === "italic") chain.toggleItalic().run();
  if (type === "bulletList") chain.toggleBulletList().run();
  if (type === "orderedList") chain.toggleOrderedList().run();
  if (type === "blockquote") chain.toggleBlockquote().run();
  if (type === "codeBlock") chain.toggleCodeBlock().run();
  if (type === "undo") chain.undo().run();
  if (type === "redo") chain.redo().run();
}

function isToolbarActive(editor: Editor, type: (typeof toolbarGroups)[number][number]["type"]) {
  if (type === "paragraph") return editor.isActive("paragraph");
  if (type === "h1") return editor.isActive("heading", { level: 1 });
  if (type === "h2") return editor.isActive("heading", { level: 2 });
  if (type === "h3") return editor.isActive("heading", { level: 3 });
  if (type === "bold") return editor.isActive("bold");
  if (type === "italic") return editor.isActive("italic");
  if (type === "bulletList") return editor.isActive("bulletList");
  if (type === "orderedList") return editor.isActive("orderedList");
  if (type === "blockquote") return editor.isActive("blockquote");
  if (type === "codeBlock") return editor.isActive("codeBlock");
  if (type === "link") return editor.isActive("link");
  return false;
}

function insertToken(editor: Editor, label: string, tone: "pause" | "question" | "card") {
  const toneCopy = {
    pause: "停顿提示",
    question: "老师可能追问",
    card: "答辩卡片",
  }[tone];

  editor
    .chain()
    .focus()
    .insertContent(`<p><mark data-presento-token="${tone}">${toneCopy}：${label}</mark></p>`)
    .run();
}

export const RichScriptEditor = forwardRef<RichScriptEditorHandle, RichScriptEditorProps>(
  function RichScriptEditor({
    className,
    initialContent,
    minHeight = 360,
    placeholder = "开始编辑你的答辩表达...",
    showFooterMeta = true,
    showScriptTools = true,
    statusLabel = "本地草稿",
    title,
    variant = "script",
  }, ref) {
    const [lastSavedAt, setLastSavedAt] = useState("刚刚");
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("https://");
    const editor = useEditor({
      content: initialContent,
      editorProps: {
        attributes: {
          class: "presento-rich-editor-prose",
        },
      },
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          link: false,
        }),
        Highlight.configure({ multicolor: true }),
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
        }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
      ],
      immediatelyRender: false,
      onUpdate: () => setLastSavedAt(formatSavedTime(new Date())),
    });
    const characterCount = editor?.storage.characterCount.characters() ?? 0;
    const wordLabel = useMemo(() => `${characterCount} 字`, [characterCount]);

    useEffect(() => {
      setLastSavedAt(formatSavedTime(new Date()));
    }, []);

    function openLinkDialog() {
      if (!editor) return;
      const previousUrl = editor.getAttributes("link").href as string | undefined;
      setLinkUrl(previousUrl ?? "https://");
      setIsLinkDialogOpen(true);
    }

    function submitLink(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!editor) return;

      const url = linkUrl.trim();
      const chain = editor.chain().focus().extendMarkRange("link");

      if (url === "") {
        chain.unsetLink().run();
      } else {
        chain.setLink({ href: url }).run();
      }

      setIsLinkDialogOpen(false);
    }

    useEffect(() => {
      if (!editor || editor.getHTML() === initialContent) return;
      editor.commands.setContent(initialContent, { emitUpdate: false });
      setLastSavedAt(formatSavedTime(new Date()));
    }, [editor, initialContent]);

    useImperativeHandle(ref, () => ({
      appendContent(html) {
        editor?.chain().focus().insertContent(html).run();
      },
      getHTML() {
        return editor?.getHTML() ?? "";
      },
      insertAnswerCard() {
        if (!editor) return;
        insertToken(editor, "把这段整理成我的最终答辩卡片。", "card");
      },
      insertPause() {
        if (!editor) return;
        insertToken(editor, "这里停顿 2 秒，等老师看完图。", "pause");
      },
      insertTeacherQuestion() {
        if (!editor) return;
        insertToken(editor, "老师可能会问：这部分证据来自哪里？", "question");
      },
      replaceContent(html) {
        editor?.commands.setContent(html, { emitUpdate: true });
        setLastSavedAt(formatSavedTime(new Date()));
      },
    }), [editor]);

    return (
      <section className={cn("presento-rich-editor", `presento-rich-editor-${variant}`, className)}>
        {title ? (
          <header className="presento-rich-editor-topline">
            <div>
              <span>{statusLabel}</span>
              <strong>{title}</strong>
            </div>
            <small>已自动保存 {lastSavedAt}</small>
          </header>
        ) : null}

        <div className="presento-rich-toolbar" aria-label="讲稿编辑工具栏">
          {toolbarGroups.map((group, groupIndex) => (
            <div className="presento-rich-toolbar-group" key={`group-${groupIndex}`}>
              {group.map((item) => {
                const Icon = "icon" in item ? item.icon : null;
                const active = editor ? isToolbarActive(editor, item.type) : false;

                return (
                  <button
                    aria-label={item.label}
                    className={cn("presento-rich-tool", active && "presento-rich-tool-active")}
                    disabled={!editor}
                    key={item.type}
                    onClick={() => editor && runToolbarCommand(editor, item.type, openLinkDialog)}
                    title={item.label}
                    type="button"
                  >
                    {Icon ? <Icon aria-hidden="true" /> : <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {showScriptTools ? (
            <div className="presento-rich-toolbar-group presento-rich-toolbar-group-script">
              <button
                className="presento-rich-tool presento-rich-tool-labeled"
                disabled={!editor}
                onClick={() => editor?.chain().focus().setHighlight({ color: "#dcfce7" }).run()}
                type="button"
              >
                <Highlighter aria-hidden="true" />
                关键词
              </button>
              <button
                className="presento-rich-tool presento-rich-tool-labeled"
                disabled={!editor}
                onClick={() => editor?.chain().focus().setHighlight({ color: "#e0f2fe" }).run()}
                type="button"
              >
                <Highlighter aria-hidden="true" />
                重点句
              </button>
              <button
                className="presento-rich-tool presento-rich-tool-labeled"
                disabled={!editor}
                onClick={() => editor && insertToken(editor, "这里停顿 2 秒，等老师看完图。", "pause")}
                type="button"
              >
                <Clock3 aria-hidden="true" />
                停顿
              </button>
              <button
                className="presento-rich-tool presento-rich-tool-labeled"
                disabled={!editor}
                onClick={() => editor && insertToken(editor, "老师可能会问：这部分证据来自哪里？", "question")}
                type="button"
              >
                <HelpCircle aria-hidden="true" />
                追问
              </button>
              <button
                className="presento-rich-tool presento-rich-tool-labeled"
                disabled={!editor}
                onClick={() => editor && insertToken(editor, "把这段整理成我的最终答辩卡片。", "card")}
                type="button"
              >
                <BookmarkPlus aria-hidden="true" />
                答辩卡
              </button>
            </div>
          ) : null}
        </div>

        <EditorContent
          className="presento-rich-editor-surface"
          editor={editor}
          style={{ minHeight }}
        />

        {showFooterMeta ? (
          <footer className="presento-rich-editor-footer">
            <span>{wordLabel}</span>
            <span>{statusLabel} · 已自动保存 {lastSavedAt}</span>
          </footer>
        ) : null}

        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogContent>
            <form className="flex flex-col gap-4" onSubmit={submitLink}>
              <DialogHeader>
                <DialogTitle>添加链接</DialogTitle>
                <DialogDescription>
                  输入链接地址；留空保存会移除当前选中文本上的链接。
                </DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://example.com"
                value={linkUrl}
              />
              <DialogFooter>
                <Button
                  onClick={() => setIsLinkDialogOpen(false)}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
                <Button type="submit">保存</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    );
  },
);
