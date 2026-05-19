"use client"

import { useNavigateBackKeyboard } from "@/hooks/useNavigateBackKeyboard"

export default function NavigateBackListener() {
  useNavigateBackKeyboard(true)
  return null
}
