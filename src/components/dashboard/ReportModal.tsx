"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Edit2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_HTML } from "./reportContent";
import { PasswordModal } from "@/components/dashboard/PasswordModal";
import { useToast } from "@/components/ui/toast";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [content, setContent] = useState<string>(REPORT_HTML);
  const [isEditMode, setIsEditMode] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/report-html")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && typeof data.html === "string" && data.html.length > 0) {
          setContent(data.html);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
      setPasswordModalOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditMode && contentEditableRef.current) {
      // 편집 모드 진입 시 한 번만 content를 div에 설정
      contentEditableRef.current.innerHTML = content;
    }
  }, [isEditMode, content]);

  const startEdit = () => {
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    // 편집 내용을 원래 content로 되돌림
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = content;
    }
  };

  const requestSave = () => {
    setPasswordModalOpen(true);
  };

  const handlePasswordConfirm = async (password: string) => {
    const editedHtml = contentEditableRef.current?.innerHTML || content;
    const res = await fetch("/api/report-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, html: editedHtml }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setContent(editedHtml);
      setIsEditMode(false);
      setPasswordModalOpen(false);
      addToast({ type: "success", message: "보고서가 저장되었습니다." });
    } else {
      addToast({ type: "error", message: data.error || "비밀번호가 올바르지 않습니다." });
      throw new Error(data.error || "비밀번호 불일치");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className="relative w-[95vw] h-[95vh] bg-white rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">2026년 중국법인 예산구조진단 보고서</h2>
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <Button variant="outline" size="sm" onClick={startEdit} className="gap-1">
                <Edit2 className="w-4 h-4" />
                편집
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1">
                  <RotateCcw className="w-4 h-4" />
                  취소
                </Button>
                <Button size="sm" onClick={requestSave} className="gap-1">
                  <Save className="w-4 h-4" />
                  저장
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="flex-1 overflow-auto p-4 min-h-0"
          style={{ zoom: 1.5 } as React.CSSProperties}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">로딩 중...</div>
          ) : isEditMode ? (
            <div
              ref={contentEditableRef}
              contentEditable={true}
              className="w-full min-h-[400px] border-2 border-blue-300 bg-blue-50/5 rounded p-2 outline-none focus:border-blue-500 focus:bg-blue-50/10"
              suppressContentEditableWarning
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
      </div>

      <PasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  );
}
