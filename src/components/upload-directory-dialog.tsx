"use client";

import { FolderOpen } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UploadDirectoryDialogProps = {
  isUploading?: boolean;
  onSelectDirectory: () => Promise<void>;
  trigger: ReactElement;
};

export function UploadDirectoryDialog({
  isUploading = false,
  onSelectDirectory,
  trigger,
}: UploadDirectoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  async function selectDirectory() {
    setIsSelecting(true);
    try {
      await onSelectDirectory();
      setOpen(false);
    } finally {
      setIsSelecting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSelecting) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>导入文件夹资料</DialogTitle>
          <DialogDescription>
            选择代码、文档或数据目录，系统会按相对路径整理可上传文件。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          只会读取你在系统选择器里确认的文件夹内容。
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={isSelecting} type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button disabled={isUploading || isSelecting} onClick={selectDirectory} type="button">
            <FolderOpen data-icon="inline-start" />
            {isSelecting ? "正在打开..." : "选择文件夹"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
