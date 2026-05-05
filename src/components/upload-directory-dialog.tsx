"use client";

import { FolderOpen, ShieldCheck } from "lucide-react";
import {
  cloneElement,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UploadDirectoryDialogProps = {
  isUploading?: boolean;
  onSelectDirectory: () => Promise<void> | void;
  trigger: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;
};

export function UploadDirectoryDialog({
  isUploading = false,
  onSelectDirectory,
  trigger,
}: UploadDirectoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  function selectDirectory() {
    setIsSelecting(true);
    try {
      void onSelectDirectory();
      setOpen(false);
    } finally {
      setIsSelecting(false);
    }
  }

  const triggerElement = cloneElement(trigger, {
    onClick: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      trigger.props.onClick?.(event);
      if (!isSelecting) setOpen(true);
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSelecting) setOpen(nextOpen);
      }}
    >
      {triggerElement}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldCheck aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>导入文件夹资料</AlertDialogTitle>
          <AlertDialogDescription>
            系统会读取你确认选择的文件夹，并按相对路径整理代码、文档和数据文件。下一步浏览器还会显示一次安全确认，这是浏览器固定流程。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          只会上传支持的项目资料；依赖目录、隐藏配置和代码压缩包会自动跳过。
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSelecting}>取消</AlertDialogCancel>
          <AlertDialogAction disabled={isUploading || isSelecting} onClick={selectDirectory}>
            <FolderOpen data-icon="inline-start" />
            {isSelecting ? "正在打开..." : "选择文件夹"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
